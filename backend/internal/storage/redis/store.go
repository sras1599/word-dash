package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
	"github.com/sras1599/wordit/backend/internal/room"
)

const roomKeyPrefix = "room:"

// Store persists room state in Redis.
type Store struct {
	client *goredis.Client
}

var _ room.Store = (*Store)(nil)

func NewStore(client *goredis.Client) *Store {
	return &Store{client: client}
}

func roomKey(roomCode string) string {
	return roomKeyPrefix + roomCode
}

type persistedGameState struct {
	RoomCode       string         `json:"roomCode"`
	Variation      room.Variation `json:"variation"`
	Players        []room.Player  `json:"players"`
	DrawPileCount  int            `json:"drawPileCount"`
	DiscardPileTop *room.Card     `json:"discardPileTop"`
	Turn           room.Turn      `json:"turn"`
	Phase          room.GamePhase `json:"phase"`
	WinnerID       *string        `json:"winnerId"`
	TurnDurationMs int            `json:"turnDurationMs"`
	DrawPile       []room.Card    `json:"drawPile"`
	DiscardPile    []room.Card    `json:"discardPile"`
}

func encodeGameState(state *room.GameState) ([]byte, error) {
	if state == nil {
		return nil, errors.New("room state is nil")
	}
	payload := persistedGameState{
		RoomCode:       state.RoomCode,
		Variation:      state.Variation,
		Players:        state.Players,
		DrawPileCount:  state.DrawPileCount,
		DiscardPileTop: state.DiscardPileTop,
		Turn:           state.Turn,
		Phase:          state.Phase,
		WinnerID:       state.WinnerID,
		TurnDurationMs: state.TurnDurationMs,
		DrawPile:       append([]room.Card(nil), state.DrawPile...),
		DiscardPile:    append([]room.Card(nil), state.DiscardPile...),
	}
	return json.Marshal(payload)
}

func decodeGameState(data []byte) (*room.GameState, error) {
	var payload persistedGameState
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}
	state := &room.GameState{
		RoomCode:       payload.RoomCode,
		Variation:      payload.Variation,
		Players:        payload.Players,
		DrawPileCount:  len(payload.DrawPile),
		DiscardPileTop: payload.DiscardPileTop,
		Turn:           payload.Turn,
		Phase:          payload.Phase,
		WinnerID:       payload.WinnerID,
		TurnDurationMs: payload.TurnDurationMs,
		DrawPile:       append([]room.Card(nil), payload.DrawPile...),
		DiscardPile:    append([]room.Card(nil), payload.DiscardPile...),
	}
	if state.DiscardPileTop == nil && len(state.DiscardPile) > 0 {
		top := state.DiscardPile[len(state.DiscardPile)-1]
		state.DiscardPileTop = &top
	}
	return state, nil
}

func (s *Store) Put(state *room.GameState) error {
	if s == nil || s.client == nil {
		return errors.New("redis client is nil")
	}
	data, err := encodeGameState(state)
	if err != nil {
		return fmt.Errorf("encode room %s: %w", state.RoomCode, err)
	}
	return s.client.Set(context.Background(), roomKey(state.RoomCode), data, 0).Err()
}

func (s *Store) Get(roomCode string) (*room.GameState, error) {
	if s == nil || s.client == nil {
		return nil, errors.New("redis client is nil")
	}
	data, err := s.client.Get(context.Background(), roomKey(roomCode)).Bytes()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return nil, fmt.Errorf("%w: %s", room.ErrRoomNotFound, roomCode)
		}
		return nil, fmt.Errorf("load room %s: %w", roomCode, err)
	}
	state, err := decodeGameState(data)
	if err != nil {
		return nil, fmt.Errorf("decode room %s: %w", roomCode, err)
	}
	return state, nil
}

func (s *Store) mutate(roomCode string, mutateFn func(state *room.GameState) (room.GameState, bool, error)) (room.GameState, error) {
	if s == nil || s.client == nil {
		return room.GameState{}, errors.New("redis client is nil")
	}
	key := roomKey(roomCode)
	ctx := context.Background()
	var result room.GameState

	for attempts := 0; attempts < 8; attempts++ {
		err := s.client.Watch(ctx, func(tx *goredis.Tx) error {
			data, err := tx.Get(ctx, key).Bytes()
			if err != nil {
				if errors.Is(err, goredis.Nil) {
					return fmt.Errorf("%w: %s", room.ErrRoomNotFound, roomCode)
				}
				return fmt.Errorf("load room %s: %w", roomCode, err)
			}

			state, err := decodeGameState(data)
			if err != nil {
				return fmt.Errorf("decode room %s: %w", roomCode, err)
			}

			updated, deleteRoom, err := mutateFn(state)
			if err != nil {
				return err
			}
			result = updated

			_, err = tx.TxPipelined(ctx, func(pipe goredis.Pipeliner) error {
				if deleteRoom {
					pipe.Del(ctx, key)
					return nil
				}

				encoded, err := encodeGameState(state)
				if err != nil {
					return err
				}
				pipe.Set(ctx, key, encoded, 0)
				return nil
			})
			return err
		}, key)
		if err == goredis.TxFailedErr {
			continue
		}
		if err != nil {
			return room.GameState{}, err
		}
		return result, nil
	}

	return room.GameState{}, fmt.Errorf("update room %s: too much contention", roomCode)
}

func (s *Store) mutatePlayer(roomCode, playerID string, mutateFn func(*room.Player) error) (room.GameState, error) {
	return s.mutate(roomCode, func(state *room.GameState) (room.GameState, bool, error) {
		for i := range state.Players {
			if state.Players[i].ID == playerID {
				if err := mutateFn(&state.Players[i]); err != nil {
					return room.GameState{}, false, err
				}
				return *state, false, nil
			}
		}
		return room.GameState{}, false, fmt.Errorf("player %s not found in room %s", playerID, roomCode)
	})
}

func (s *Store) UpdateGameState(roomCode string, mutateFn func(*room.GameState) error) (room.GameState, error) {
	return s.mutate(roomCode, func(state *room.GameState) (room.GameState, bool, error) {
		if err := mutateFn(state); err != nil {
			return room.GameState{}, false, err
		}
		return *state, false, nil
	})
}

// MarkPlayerConnected sets the given player's IsConnected flag to true and
// returns a shallow copy of the game state as it stands after the update.
func (s *Store) MarkPlayerConnected(roomCode, playerID string) (room.GameState, error) {
	// a TTL of 15 minutes gets set for the room when all players leave
	// we remove this countdown when any player connects
	key := roomKey(roomCode)
	ctx := context.Background()
	s.client.Watch(ctx, func(tx *goredis.Tx) error {
		_, err := tx.TxPipelined(ctx, func(pipe goredis.Pipeliner) error {
			pipe.Persist(ctx, key)
			return nil
		})

		return err
	}, key)

	return s.mutatePlayer(roomCode, playerID, func(p *room.Player) error {
		p.IsConnected = true
		return nil
	})
}

// MarkPlayerDisconnected sets the given player's IsConnected flag to false,
// clears their ready state, and returns a shallow copy of the updated room.
func (s *Store) MarkPlayerDisconnected(roomCode, playerID string) (room.GameState, error) {
	return s.mutatePlayer(roomCode, playerID, func(p *room.Player) error {
		p.IsConnected = false
		p.IsReady = false
		return nil
	})
}

// MarkPlayerReady sets the given player's IsReady flag to true and returns a
// shallow copy of the game state after the update.
func (s *Store) MarkPlayerReady(roomCode, playerID string) (room.GameState, error) {
	return s.mutatePlayer(roomCode, playerID, func(p *room.Player) error {
		p.IsReady = true
		return nil
	})
}

// MarkPlayerUnready sets the given player's IsReady flag to false and returns
// a shallow copy of the updated room state.
func (s *Store) MarkPlayerUnready(roomCode, playerID string) (room.GameState, error) {
	return s.mutatePlayer(roomCode, playerID, func(p *room.Player) error {
		p.IsReady = false
		return nil
	})
}

// RemovePlayer removes the given player from the room. If the room becomes
// empty, it is deleted from the store and roomDeleted is returned as true.
func (s *Store) RemovePlayer(roomCode, playerID string) (room.GameState, bool, error) {
	if s == nil || s.client == nil {
		return room.GameState{}, false, errors.New("redis client is nil")
	}
	key := roomKey(roomCode)
	ctx := context.Background()
	var result room.GameState

	for attempts := 0; attempts < 8; attempts++ {
		err := s.client.Watch(ctx, func(tx *goredis.Tx) error {
			data, err := tx.Get(ctx, key).Bytes()
			if err != nil {
				if errors.Is(err, goredis.Nil) {
					return fmt.Errorf("%w: %s", room.ErrRoomNotFound, roomCode)
				}
				return fmt.Errorf("load room %s: %w", roomCode, err)
			}

			state, err := decodeGameState(data)
			if err != nil {
				return fmt.Errorf("decode room %s: %w", roomCode, err)
			}

			playerIndex := -1
			for i := range state.Players {
				if state.Players[i].ID == playerID {
					playerIndex = i
					break
				}
			}
			if playerIndex == -1 {
				return fmt.Errorf("player %s not found in room %s", playerID, roomCode)
			}

			state.Players = append(state.Players[:playerIndex], state.Players[playerIndex+1:]...)

			// set the lobby to expire after 15 minutes (set a TTL countdown)
			// if a room isn't expired when a player reconnects, we remove this countdown
			if len(state.Players) == 0 {
				result = room.GameState{RoomCode: roomCode}
				_, err = tx.TxPipelined(ctx, func(pipe goredis.Pipeliner) error {
					pipe.Expire(ctx, key, 15*time.Minute)
					return nil
				})
				return err
			}

			result = *state
			encoded, err := encodeGameState(state)
			if err != nil {
				return err
			}
			_, err = tx.TxPipelined(ctx, func(pipe goredis.Pipeliner) error {
				pipe.Set(ctx, key, encoded, 0)
				return nil
			})
			return err
		}, key)
		if err == goredis.TxFailedErr {
			continue
		}
		if err != nil {
			return room.GameState{}, false, err
		}
		if len(result.Players) == 0 {
			return result, true, nil
		}
		return result, false, nil
	}

	return room.GameState{}, false, fmt.Errorf("update room %s: too much contention", roomCode)
}

// StartGame transitions the room from waiting to playing. playerID must be the
// host (Players[0].ID). drawPile is a pre-shuffled deck; cards are dealt from
// the front. Returns the updated game state after initialization.
func (s *Store) StartGame(roomCode, playerID string, drawPile []room.Card) (room.GameState, error) {
	return s.mutate(roomCode, func(state *room.GameState) (room.GameState, bool, error) {
		if len(state.Players) == 0 || state.Players[0].ID != playerID {
			return room.GameState{}, false, room.ErrNotHost
		}
		if state.Phase != room.GamePhaseWaiting {
			return room.GameState{}, false, room.ErrGameAlreadyStarted
		}
		for _, p := range state.Players {
			if !p.IsReady {
				return room.GameState{}, false, room.ErrNotAllReady
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

		return *state, false, nil
	})
}

// NextTurn rotates the turn to the next player in the Players slice (wrapping
// around), resets the phase to draw, and resets TimeRemainingMs to the room's
// configured TurnDurationMs.
func (s *Store) NextTurn(roomCode string) (room.GameState, error) {
	return s.mutate(roomCode, func(state *room.GameState) (room.GameState, bool, error) {
		currentIndex := -1
		for i, p := range state.Players {
			if p.ID == state.Turn.CurrentPlayerID {
				currentIndex = i
				break
			}
		}
		if currentIndex == -1 {
			return room.GameState{}, false, fmt.Errorf("current player not found in room %s", roomCode)
		}

		nextIndex := (currentIndex + 1) % len(state.Players)
		state.Turn = room.Turn{
			CurrentPlayerID: state.Players[nextIndex].ID,
			Phase:           room.TurnPhaseDraw,
			TimeRemainingMs: state.TurnDurationMs,
		}

		return *state, false, nil
	})
}

// TickTimer decrements the current turn's TimeRemainingMs by one second and
// returns the new value. Returns 0 without error when the game is not playing.
func (s *Store) TickTimer(roomCode string) (int, error) {
	updated, err := s.mutate(roomCode, func(state *room.GameState) (room.GameState, bool, error) {
		if state.Phase != room.GamePhasePlaying {
			return *state, false, nil
		}

		if state.Turn.TimeRemainingMs > 1000 {
			state.Turn.TimeRemainingMs -= 1000
		} else {
			state.Turn.TimeRemainingMs = 0
		}

		return *state, false, nil
	})
	if err != nil {
		return 0, err
	}
	return updated.Turn.TimeRemainingMs, nil
}

// UpdateLobbySettings updates the variation and turn duration for a room that
// is still in the waiting phase. playerID must be the host (Players[0].ID).
func (s *Store) UpdateLobbySettings(roomCode, playerID string, variation room.Variation, turnDurationMs int) (room.GameState, error) {
	return s.mutate(roomCode, func(state *room.GameState) (room.GameState, bool, error) {
		if len(state.Players) == 0 || state.Players[0].ID != playerID {
			return room.GameState{}, false, room.ErrNotHost
		}
		if state.Phase != room.GamePhaseWaiting {
			return room.GameState{}, false, room.ErrGameAlreadyStarted
		}

		state.Variation = variation
		state.TurnDurationMs = turnDurationMs
		return *state, false, nil
	})
}

// IsPlayerConnected reports whether the given player is currently marked as
// connected in the given room. Returns false if the room or player is not found.
func (s *Store) IsPlayerConnected(roomCode, playerID string) bool {
	state, err := s.Get(roomCode)
	if err != nil {
		return false
	}
	for _, p := range state.Players {
		if p.ID == playerID {
			return p.IsConnected
		}
	}
	return false
}

// ResetConnections clears IsConnected for all players in every persisted room.
// This is intended to run once during server startup after a process restart.
func (s *Store) ResetConnections(ctx context.Context) error {
	if s == nil || s.client == nil {
		return errors.New("redis client is nil")
	}
	iter := s.client.Scan(ctx, 0, roomKeyPrefix+"*", 0).Iterator()
	for iter.Next(ctx) {
		key := iter.Val()
		data, err := s.client.Get(ctx, key).Bytes()
		if err != nil {
			if errors.Is(err, goredis.Nil) {
				continue
			}
			return fmt.Errorf("load room %s: %w", key, err)
		}

		state, err := decodeGameState(data)
		if err != nil {
			return fmt.Errorf("decode room %s: %w", key, err)
		}

		for i := range state.Players {
			state.Players[i].IsConnected = false
		}

		encoded, err := encodeGameState(state)
		if err != nil {
			return fmt.Errorf("encode room %s: %w", key, err)
		}
		if err := s.client.Set(ctx, key, encoded, 0).Err(); err != nil {
			return fmt.Errorf("save room %s: %w", key, err)
		}
	}
	if err := iter.Err(); err != nil {
		return err
	}
	return nil
}
