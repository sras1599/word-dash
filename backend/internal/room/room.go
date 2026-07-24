package room

import (
	"crypto/rand"
	"errors"
	"fmt"

	"github.com/sras1599/wordit/backend/config"
)

// Sentinel errors returned by Join and StartGame.
var (
	ErrRoomNotFound       = errors.New("room not found")
	ErrPlayerDuplicate    = errors.New("player already in room")
	ErrNotHost            = errors.New("only the host can start the game")
	ErrGameAlreadyStarted = errors.New("game already in progress")
	ErrNotEnoughPlayers   = errors.New("at least 2 players are required to start")
	ErrPlayerNotFound     = errors.New("player not found")
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
	EndsAtUnixMs    int64
	Sequence        uint64
	DrawnCard       *Card
}

type Player struct {
	ID            string
	Name          string
	Hand          []Card
	WordBoard     WordBoard
	BoardRevision uint64
	IsConnected   bool
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
	TurnDurationMs int

	// Internal server-side state — never sent to clients.
	DrawPile    []Card `json:"-"`
	DiscardPile []Card `json:"-"`
}

func (state *GameState) GetPlayer(playerId string) (*Player, error) {
	for i := range state.Players {
		if playerId == state.Players[i].ID {
			return &state.Players[i], nil
		}
	}

	return nil, ErrPlayerNotFound
}

// ValidateStart checks whether playerID may transition a waiting room into play.
func ValidateStart(state *GameState, playerID string) error {
	if len(state.Players) == 0 || state.Players[0].ID != playerID {
		return ErrNotHost
	}
	if state.Phase != GamePhaseWaiting {
		return ErrGameAlreadyStarted
	}
	if len(state.Players) < 2 {
		return ErrNotEnoughPlayers
	}
	return nil
}

// Store defines the persistence contract used by room orchestration and the
// HTTP/WebSocket layers. Concrete implementations live in infrastructure
// packages. A nil error from Get means the returned state is non-nil.
type Store interface {
	Put(state *GameState) error
	Get(roomCode string) (*GameState, error)
	UpdateGameState(roomCode string, mutateFn func(*GameState) error) (GameState, error)
	MarkPlayerConnected(roomCode, playerID string) (GameState, error)
	MarkPlayerDisconnected(roomCode, playerID string) (GameState, error)
	RemovePlayer(roomCode, playerID string) (GameState, bool, error)
	StartGame(roomCode, playerID string, drawPile []Card, endsAtUnixMs int64) (GameState, error)
	NextTurn(roomCode string, endsAtUnixMs int64) (GameState, error)
	UpdateLobbySettings(roomCode, playerID string, variation Variation, turnDurationMs int) (GameState, error)
	IsPlayerConnected(roomCode, playerID string) bool
}

// --- Room creation ---

const roomCodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// Create creates a new room with the given host name and configured default
// settings. It returns the generated roomCode and the host player ID.
func Create(store Store, hostName string) (roomCode string, playerID string, err error) {
	roomCode, err = generateRoomCode()
	if err != nil {
		return "", "", fmt.Errorf("generate room code: %w", err)
	}

	playerID, err = generateUUID()
	if err != nil {
		return "", "", fmt.Errorf("generate player ID: %w", err)
	}

	variation := Variation{WordLengths: append([]int(nil), config.Cfg.DefaultWordLengths...)}
	turnDurationMs := config.Cfg.TurnDurationMS

	host := Player{
		ID:          playerID,
		Name:        hostName,
		Hand:        []Card{},
		IsConnected: false,
	}

	state := &GameState{
		RoomCode:       roomCode,
		Variation:      variation,
		Players:        []Player{host},
		Phase:          GamePhaseWaiting,
		TurnDurationMs: turnDurationMs,
	}

	if err := store.Put(state); err != nil {
		return "", "", fmt.Errorf("save room: %w", err)
	}

	return roomCode, playerID, nil
}

// NewWordBoard builds an empty board from the provided variation info
func NewWordBoard(v Variation) WordBoard {
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
func Join(store Store, roomCode, playerName string) (string, error) {
	playerID, err := generateUUID()
	if err != nil {
		return "", fmt.Errorf("generate player ID: %w", err)
	}

	state, err := store.Get(roomCode)
	if err != nil {
		return "", fmt.Errorf("load room: %w", err)
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
		IsConnected: false,
	}
	state.Players = append(state.Players, player)
	if err := store.Put(state); err != nil {
		return "", fmt.Errorf("save room: %w", err)
	}
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
