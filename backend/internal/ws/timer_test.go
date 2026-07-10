package ws

import (
	"testing"

	"github.com/sras1599/wordit/backend/internal/dictionary"
	"github.com/sras1599/wordit/backend/internal/room"
	"github.com/sras1599/wordit/backend/internal/storage/memory"
)

func TestHandleTurnTimeoutSkipsConnectedPlayerExpiredInDrawPhase(t *testing.T) {
	store := memory.NewStore()
	state := timerTestState(room.TurnPhaseDraw)
	state.Turn.TimeRemainingMs = 0
	if err := store.Put(state); err != nil {
		t.Fatalf("put state: %v", err)
	}
	hub := NewHub(store, dictionary.NopChecker{})

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
	if got.Turn.TimeRemainingMs != got.TurnDurationMs {
		t.Fatalf("time remaining = %d, want %d", got.Turn.TimeRemainingMs, got.TurnDurationMs)
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

	hub.skipDisconnectedTurns("ROOM1")

	got, err := store.Get("ROOM1")
	if err != nil {
		t.Fatalf("get state: %v", err)
	}
	if got.Turn.CurrentPlayerID != "player-1" {
		t.Fatalf("current player = %q, want player-1 after bounded cycle", got.Turn.CurrentPlayerID)
	}
	if got.Turn.TimeRemainingMs != got.TurnDurationMs {
		t.Fatalf("time remaining = %d, want %d", got.Turn.TimeRemainingMs, got.TurnDurationMs)
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
			TimeRemainingMs: 60_000,
		},
		Phase:          room.GamePhasePlaying,
		TurnDurationMs: 60_000,
	}
}
