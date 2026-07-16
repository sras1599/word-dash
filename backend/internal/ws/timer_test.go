package ws

import (
	"testing"
	"time"

	"github.com/sras1599/wordit/backend/internal/dictionary"
	"github.com/sras1599/wordit/backend/internal/room"
	"github.com/sras1599/wordit/backend/internal/storage/memory"
)

func TestHandleTurnTimeoutSkipsConnectedPlayerExpiredInDrawPhase(t *testing.T) {
	store := memory.NewStore()
	state := timerTestState(room.TurnPhaseDraw)
	if err := store.Put(state); err != nil {
		t.Fatalf("put state: %v", err)
	}
	hub := NewHub(store, dictionary.NopChecker{})
	hub.now = func() time.Time { return time.UnixMilli(100_000) }

	hub.handleTurnTimeout("ROOM1")

	got, err := store.Get("ROOM1")
	if err != nil {
		t.Fatalf("get state: %v", err)
	}
	if got.Turn.CurrentPlayerID != "player-2" {
		t.Fatalf("current player = %q, want player-2", got.Turn.CurrentPlayerID)
	}
	if got.Turn.Phase != room.TurnPhaseDraw {
		t.Fatalf("turn phase = %q, want draw", got.Turn.Phase)
	}
	if got.Turn.EndsAtUnixMs != 160_000 {
		t.Fatalf("deadline = %d, want 160000", got.Turn.EndsAtUnixMs)
	}
	if got.Turn.Sequence != 2 {
		t.Fatalf("sequence = %d, want 2", got.Turn.Sequence)
	}
}

func TestSkipDisconnectedTurnsStopsAfterFullTableCycle(t *testing.T) {
	store := memory.NewStore()
	state := timerTestState(room.TurnPhaseDraw)
	for i := range state.Players {
		state.Players[i].IsConnected = false
	}
	if err := store.Put(state); err != nil {
		t.Fatalf("put state: %v", err)
	}
	hub := NewHub(store, dictionary.NopChecker{})
	hub.now = func() time.Time { return time.UnixMilli(100_000) }

	hub.skipDisconnectedTurns("ROOM1")

	got, err := store.Get("ROOM1")
	if err != nil {
		t.Fatalf("get state: %v", err)
	}
	if got.Turn.CurrentPlayerID != "player-1" {
		t.Fatalf("current player = %q, want player-1 after bounded cycle", got.Turn.CurrentPlayerID)
	}
	if got.Turn.EndsAtUnixMs != 160_000 {
		t.Fatalf("deadline = %d, want 160000", got.Turn.EndsAtUnixMs)
	}
	if got.Turn.Sequence != 3 {
		t.Fatalf("sequence = %d, want 3", got.Turn.Sequence)
	}
}

func TestReconcileRoomDeadlineDoesNotResetActiveTurn(t *testing.T) {
	store := memory.NewStore()
	state := timerTestState(room.TurnPhaseDraw)
	state.Turn.EndsAtUnixMs = 120_000
	if err := store.Put(state); err != nil {
		t.Fatalf("put state: %v", err)
	}
	hub := NewHub(store, dictionary.NopChecker{})
	hub.now = func() time.Time { return time.UnixMilli(100_000) }

	hub.reconcileRoomDeadline("ROOM1")

	got, err := store.Get("ROOM1")
	if err != nil {
		t.Fatalf("get state: %v", err)
	}
	if got.Turn.EndsAtUnixMs != 120_000 || got.Turn.Sequence != 1 {
		t.Fatalf("deadline/sequence = %d/%d, want 120000/1", got.Turn.EndsAtUnixMs, got.Turn.Sequence)
	}
}

func TestUpdateBeforeDeadlineRejectsLateMutationAndReconciles(t *testing.T) {
	store := memory.NewStore()
	state := timerTestState(room.TurnPhaseDraw)
	if err := store.Put(state); err != nil {
		t.Fatalf("put state: %v", err)
	}
	hub := NewHub(store, dictionary.NopChecker{})
	hub.now = func() time.Time { return time.UnixMilli(100_000) }
	mutated := false

	_, err := hub.updateBeforeDeadline("ROOM1", func(*room.GameState) error {
		mutated = true
		return nil
	})
	if err == nil {
		t.Fatal("late mutation error = nil, want TURN_EXPIRED")
	}
	if mutated {
		t.Fatal("late mutation was applied")
	}
	got, getErr := store.Get("ROOM1")
	if getErr != nil {
		t.Fatalf("get state: %v", getErr)
	}
	if got.Turn.Sequence != 2 || got.Turn.CurrentPlayerID != "player-2" {
		t.Fatalf("reconciled turn = sequence %d player %q, want 2/player-2", got.Turn.Sequence, got.Turn.CurrentPlayerID)
	}
}

func timerTestState(turnPhase room.TurnPhase) *room.GameState {
	return &room.GameState{
		RoomCode: "ROOM1",
		Variation: room.Variation{
			WordLengths: []int{2},
		},
		Players: []room.Player{
			{
				ID:          "player-1",
				Name:        "Player 1",
				WordBoard:   room.NewWordBoard(room.Variation{WordLengths: []int{2}}),
				IsConnected: true,
			},
			{
				ID:          "player-2",
				Name:        "Player 2",
				WordBoard:   room.NewWordBoard(room.Variation{WordLengths: []int{2}}),
				IsConnected: true,
			},
		},
		Turn: room.Turn{
			CurrentPlayerID: "player-1",
			Phase:           turnPhase,
			EndsAtUnixMs:    100_000,
			Sequence:        1,
		},
		Phase:          room.GamePhasePlaying,
		TurnDurationMs: 60_000,
	}
}
