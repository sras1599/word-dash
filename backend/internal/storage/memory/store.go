package memory

import (
	"fmt"
	"sync"

	"github.com/sras1599/wordit/backend/internal/room"
)

// Store is an in-memory implementation of room.Store.
type Store struct {
	mu    sync.RWMutex
	rooms map[string]*room.GameState
}

var _ room.Store = (*Store)(nil)

func NewStore() *Store {
	return &Store{rooms: make(map[string]*room.GameState)}
}

func (s *Store) Put(state *room.GameState) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rooms[state.RoomCode] = state
	return nil
}

func (s *Store) Get(roomCode string) (*room.GameState, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	state, ok := s.rooms[roomCode]
	if !ok {
		return nil, room.ErrRoomNotFound
	}
	return state, nil
}

func (s *Store) UpdateGameState(roomCode string, mutateFn func(*room.GameState) error) (room.GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, ok := s.rooms[roomCode]
	if !ok {
		return room.GameState{}, fmt.Errorf("%w: %s", room.ErrRoomNotFound, roomCode)
	}
	if err := mutateFn(state); err != nil {
		return room.GameState{}, err
	}
	return *state, nil
}

func (s *Store) mutatePlayer(roomCode, playerID string, mutateFn func(*room.Player) error) (room.GameState, error) {
	state, ok := s.rooms[roomCode]
	if !ok {
		return room.GameState{}, fmt.Errorf("room %s not found", roomCode)
	}
	for i := range state.Players {
		if state.Players[i].ID == playerID {
			if err := mutateFn(&state.Players[i]); err != nil {
				return room.GameState{}, err
			}
			return *state, nil
		}
	}
	return room.GameState{}, fmt.Errorf("player %s not found in room %s", playerID, roomCode)
}

// MarkPlayerConnected sets the given player's IsConnected flag to true and
// returns a shallow copy of the game state as it stands after the update.
func (s *Store) MarkPlayerConnected(roomCode, playerID string) (room.GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.mutatePlayer(roomCode, playerID, func(p *room.Player) error {
		p.IsConnected = true
		return nil
	})
}

// MarkPlayerDisconnected sets the given player's IsConnected flag to false,
// clears their ready state, and returns a shallow copy of the updated room.
func (s *Store) MarkPlayerDisconnected(roomCode, playerID string) (room.GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.mutatePlayer(roomCode, playerID, func(p *room.Player) error {
		p.IsConnected = false
		p.IsReady = false
		return nil
	})
}

// MarkPlayerReady sets the given player's IsReady flag to true and returns a
// shallow copy of the game state after the update.
func (s *Store) MarkPlayerReady(roomCode, playerID string) (room.GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.mutatePlayer(roomCode, playerID, func(p *room.Player) error {
		p.IsReady = true
		return nil
	})
}

// MarkPlayerUnready sets the given player's IsReady flag to false and returns
// a shallow copy of the updated room state.
func (s *Store) MarkPlayerUnready(roomCode, playerID string) (room.GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.mutatePlayer(roomCode, playerID, func(p *room.Player) error {
		p.IsReady = false
		return nil
	})
}

// RemovePlayer removes the given player from the room. If the room becomes
// empty, it is deleted from the store and roomDeleted is returned as true.
func (s *Store) RemovePlayer(roomCode, playerID string) (state room.GameState, roomDeleted bool, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	roomState, ok := s.rooms[roomCode]
	if !ok {
		return room.GameState{}, false, fmt.Errorf("room %s not found", roomCode)
	}

	playerIndex := -1
	for i := range roomState.Players {
		if roomState.Players[i].ID == playerID {
			playerIndex = i
			break
		}
	}
	if playerIndex == -1 {
		return room.GameState{}, false, fmt.Errorf("player %s not found in room %s", playerID, roomCode)
	}

	roomState.Players = append(roomState.Players[:playerIndex], roomState.Players[playerIndex+1:]...)
	if len(roomState.Players) == 0 {
		delete(s.rooms, roomCode)
		return room.GameState{RoomCode: roomCode}, true, nil
	}

	return *roomState, false, nil
}

// StartGame transitions the room from waiting to playing. playerID must be the
// host (Players[0].ID). drawPile is a pre-shuffled deck; cards are dealt from
// the front. Returns the updated game state after initialization.
func (s *Store) StartGame(roomCode, playerID string, drawPile []room.Card) (room.GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, ok := s.rooms[roomCode]
	if !ok {
		return room.GameState{}, fmt.Errorf("%w: %s", room.ErrRoomNotFound, roomCode)
	}
	if len(state.Players) == 0 || state.Players[0].ID != playerID {
		return room.GameState{}, room.ErrNotHost
	}
	if state.Phase != room.GamePhaseWaiting {
		return room.GameState{}, room.ErrGameAlreadyStarted
	}
	for _, p := range state.Players {
		if !p.IsReady {
			return room.GameState{}, room.ErrNotAllReady
		}
	}

	// create the word boards for every player
	for i := range state.Players {
		state.Players[i].WordBoard = room.NewWordBoard(state.Variation)
	}

	// Compute hand size: each player starts with enough cards to fill their board.
	handSize := 0
	for _, l := range state.Variation.WordLengths {
		handSize += l
	}

	// Work from a local copy of the draw pile slice.
	pile := make([]room.Card, len(drawPile))
	copy(pile, drawPile)

	// Deal cards to each player.
	for i := range state.Players {
		state.Players[i].Hand = make([]room.Card, handSize)
		copy(state.Players[i].Hand, pile[:handSize])
		pile = pile[handSize:]
	}

	state.DrawPile = pile
	state.DiscardPile = []room.Card{}
	state.DrawPileCount = len(pile)
	state.DiscardPileTop = nil

	// Set up the first turn using the room's configured duration.
	state.Turn = room.Turn{
		CurrentPlayerID: state.Players[0].ID,
		Phase:           room.TurnPhaseDraw,
		TimeRemainingMs: state.TurnDurationMs,
	}
	state.Phase = room.GamePhasePlaying

	return *state, nil
}

// NextTurn rotates the turn to the next player in the Players slice (wrapping
// around), resets the phase to draw, and resets TimeRemainingMs to the room's
// configured TurnDurationMs.
func (s *Store) NextTurn(roomCode string) (room.GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, ok := s.rooms[roomCode]
	if !ok {
		return room.GameState{}, fmt.Errorf("room %s not found", roomCode)
	}

	currentIndex := -1
	for i, p := range state.Players {
		if p.ID == state.Turn.CurrentPlayerID {
			currentIndex = i
			break
		}
	}
	if currentIndex == -1 {
		return room.GameState{}, fmt.Errorf("current player not found in room %s", roomCode)
	}

	nextIndex := (currentIndex + 1) % len(state.Players)
	state.Turn = room.Turn{
		CurrentPlayerID: state.Players[nextIndex].ID,
		Phase:           room.TurnPhaseDraw,
		TimeRemainingMs: state.TurnDurationMs,
	}

	return *state, nil
}

// TickTimer decrements the active turn's TimeRemainingMs by one second and
// returns the current value. Returns 0 without error when the game is not playing.
func (s *Store) TickTimer(roomCode string) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, ok := s.rooms[roomCode]
	if !ok {
		return 0, fmt.Errorf("room %s not found", roomCode)
	}
	if state.Phase != room.GamePhasePlaying {
		return 0, nil
	}
	if state.Turn.Phase == room.TurnPhaseIdle {
		return state.Turn.TimeRemainingMs, nil
	}

	if state.Turn.TimeRemainingMs > 1000 {
		state.Turn.TimeRemainingMs -= 1000
	} else {
		state.Turn.TimeRemainingMs = 0
	}
	return state.Turn.TimeRemainingMs, nil
}

// UpdateLobbySettings updates the variation and turn duration for a room that
// is still in the waiting phase. playerID must be the host (Players[0].ID).
func (s *Store) UpdateLobbySettings(roomCode, playerID string, variation room.Variation, turnDurationMs int) (room.GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, ok := s.rooms[roomCode]
	if !ok {
		return room.GameState{}, fmt.Errorf("%w: %s", room.ErrRoomNotFound, roomCode)
	}
	if len(state.Players) == 0 || state.Players[0].ID != playerID {
		return room.GameState{}, room.ErrNotHost
	}
	if state.Phase != room.GamePhaseWaiting {
		return room.GameState{}, room.ErrGameAlreadyStarted
	}

	state.Variation = variation
	state.TurnDurationMs = turnDurationMs
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
