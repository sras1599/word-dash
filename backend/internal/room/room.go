package room

import (
	"crypto/rand"
	"fmt"
	"sync"
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
