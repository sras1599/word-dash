package room

import (
	"crypto/rand"
	"errors"
	"fmt"
	"sync"
)

// Sentinel errors returned by Join and StartGame.
var (
	ErrRoomNotFound       = errors.New("room not found")
	ErrPlayerDuplicate    = errors.New("player already in room")
	ErrNotHost            = errors.New("only the host can start the game")
	ErrGameAlreadyStarted = errors.New("game already in progress")
	ErrNotAllReady        = errors.New("not all players are ready")
)

// --- Domain types ---

type Variation struct {
	WordLengths []int
}

type Card struct {
	ID     string
	Letter string
}

type WordSlot struct {
	SlotIndex int
	Card      *Card
}

type WordRow struct {
	TargetLength int
	Slots        []WordSlot
	IsComplete   bool
}

type WordBoard struct {
	Rows        []WordRow
	AllComplete bool
}

type TurnPhase string

const (
	TurnPhaseIdle    TurnPhase = "idle"
	TurnPhaseDraw    TurnPhase = "draw"
	TurnPhaseArrange TurnPhase = "arrange"
)

type Turn struct {
	CurrentPlayerID string
	Phase           TurnPhase
	TimeRemainingMs int
	DrawnCard       *Card
}

type Player struct {
	ID          string
	Name        string
	Hand        []Card
	WordBoard   WordBoard
	IsReady     bool
	IsConnected bool
}

type GamePhase string

const (
	GamePhaseWaiting  GamePhase = "waiting"
	GamePhasePlaying  GamePhase = "playing"
	GamePhaseFinished GamePhase = "finished"
)

type GameState struct {
	RoomCode       string
	Variation      Variation
	Players        []Player
	DrawPileCount  int
	DiscardPileTop *Card
	Turn           Turn
	Phase          GamePhase
	WinnerID       *string

	// Internal server-side state — never sent to clients.
	DrawPile    []Card `json:"-"`
	DiscardPile []Card `json:"-"`
}

// --- In-memory store ---

type Store struct {
	mu    sync.RWMutex
	rooms map[string]*GameState
}

func NewStore() *Store {
	return &Store{rooms: make(map[string]*GameState)}
}

func (s *Store) Put(state *GameState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rooms[state.RoomCode] = state
}

func (s *Store) Get(roomCode string) (*GameState, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	state, ok := s.rooms[roomCode]
	return state, ok
}

// MarkPlayerConnected sets the given player's IsConnected flag to true and
// returns a shallow copy of the game state as it stands after the update.
func (s *Store) MarkPlayerConnected(roomCode, playerID string) (GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.rooms[roomCode]
	if !ok {
		return GameState{}, fmt.Errorf("room %s not found", roomCode)
	}
	found := false
	for i := range state.Players {
		if state.Players[i].ID == playerID {
			state.Players[i].IsConnected = true
			found = true
			break
		}
	}
	if !found {
		return GameState{}, fmt.Errorf("player %s not found in room %s", playerID, roomCode)
	}
	// Return a value copy so callers read consistent data outside the lock.
	return *state, nil
}

// MarkPlayerReady sets the given player's IsReady flag to true and returns a
// shallow copy of the game state after the update.
func (s *Store) MarkPlayerReady(roomCode, playerID string) (GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.rooms[roomCode]
	if !ok {
		return GameState{}, fmt.Errorf("room %s not found", roomCode)
	}
	found := false
	for i := range state.Players {
		if state.Players[i].ID == playerID {
			state.Players[i].IsReady = true
			found = true
			break
		}
	}
	if !found {
		return GameState{}, fmt.Errorf("player %s not found in room %s", playerID, roomCode)
	}
	return *state, nil
}

// StartGame transitions the room from waiting to playing. playerID must be the
// host (Players[0].ID). drawPile is a pre-shuffled deck; cards are dealt from
// the front. Returns the updated game state after initialization.
func (s *Store) StartGame(roomCode, playerID string, drawPile []Card) (GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, ok := s.rooms[roomCode]
	if !ok {
		return GameState{}, fmt.Errorf("%w: %s", ErrRoomNotFound, roomCode)
	}
	if len(state.Players) == 0 || state.Players[0].ID != playerID {
		return GameState{}, ErrNotHost
	}
	if state.Phase != GamePhaseWaiting {
		return GameState{}, ErrGameAlreadyStarted
	}
	for _, p := range state.Players {
		if !p.IsReady {
			return GameState{}, ErrNotAllReady
		}
	}

	// Compute hand size: each player starts with enough cards to fill their board.
	handSize := 0
	for _, l := range state.Variation.WordLengths {
		handSize += l
	}

	// Work from a local copy of the draw pile slice.
	pile := make([]Card, len(drawPile))
	copy(pile, drawPile)

	// Deal cards to each player.
	for i := range state.Players {
		state.Players[i].Hand = make([]Card, handSize)
		copy(state.Players[i].Hand, pile[:handSize])
		pile = pile[handSize:]
	}

	state.DrawPile = pile
	state.DiscardPile = []Card{}
	state.DrawPileCount = len(pile)
	state.DiscardPileTop = nil

	// Set up the first turn.
	state.Turn = Turn{
		CurrentPlayerID: state.Players[0].ID,
		Phase:           TurnPhaseDraw,
		TimeRemainingMs: 60000,
	}
	state.Phase = GamePhasePlaying

	return *state, nil
}

// IsPlayerConnected reports whether the given player is currently marked as
// connected in the given room. Returns false if the room or player is not found.
func (s *Store) IsPlayerConnected(roomCode, playerID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	state, ok := s.rooms[roomCode]
	if !ok {
		return false
	}
	for _, p := range state.Players {
		if p.ID == playerID {
			return p.IsConnected
		}
	}
	return false
}

// --- Room creation ---

const roomCodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// Create creates a new room with the given host name and variation.
// It returns the generated roomCode and the host player ID.
func Create(store *Store, hostName string, variation Variation) (roomCode string, playerID string, err error) {
	roomCode, err = generateRoomCode()
	if err != nil {
		return "", "", fmt.Errorf("generate room code: %w", err)
	}

	playerID, err = generateUUID()
	if err != nil {
		return "", "", fmt.Errorf("generate player ID: %w", err)
	}

	host := Player{
		ID:          playerID,
		Name:        hostName,
		Hand:        []Card{},
		WordBoard:   buildWordBoard(variation),
		IsReady:     false,
		IsConnected: false,
	}

	state := &GameState{
		RoomCode:  roomCode,
		Variation: variation,
		Players:   []Player{host},
		Phase:     GamePhaseWaiting,
	}

	store.Put(state)
	return roomCode, playerID, nil
}

func buildWordBoard(v Variation) WordBoard {
	rows := make([]WordRow, len(v.WordLengths))
	for i, length := range v.WordLengths {
		slots := make([]WordSlot, length)
		for j := range slots {
			slots[j] = WordSlot{SlotIndex: j}
		}
		rows[i] = WordRow{TargetLength: length, Slots: slots}
	}
	return WordBoard{Rows: rows}
}

// Join adds a new player with the given name to an existing room and returns
// the generated player ID. Returns an error if the room does not exist.
func Join(store *Store, roomCode, playerName string) (string, error) {
	playerID, err := generateUUID()
	if err != nil {
		return "", fmt.Errorf("generate player ID: %w", err)
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	state, ok := store.rooms[roomCode]
	if !ok {
		return "", fmt.Errorf("%w: %s", ErrRoomNotFound, roomCode)
	}

	for _, p := range state.Players {
		if p.Name == playerName {
			return "", fmt.Errorf("%w: %q is already in room %s", ErrPlayerDuplicate, playerName, roomCode)
		}
	}

	player := Player{
		ID:          playerID,
		Name:        playerName,
		Hand:        []Card{},
		WordBoard:   buildWordBoard(state.Variation),
		IsReady:     false,
		IsConnected: false,
	}
	state.Players = append(state.Players, player)
	return playerID, nil
}

// generateRoomCode returns a 6-character uppercase alphanumeric room code.
func generateRoomCode() (string, error) {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i, c := range b {
		b[i] = roomCodeAlphabet[int(c)%len(roomCodeAlphabet)]
	}
	return string(b), nil
}

// generateUUID returns a random UUID v4 string.
func generateUUID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant bits
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:]), nil
}
