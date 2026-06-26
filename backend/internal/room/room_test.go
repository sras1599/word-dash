package room_test

import (
	"slices"
	"testing"

	"github.com/sras1599/wordit/backend/config"
	"github.com/sras1599/wordit/backend/internal/room"
	"github.com/sras1599/wordit/backend/internal/storage/memory"
)

func TestCreateInitializesRoomWithDefaults(t *testing.T) {
	store := memory.NewStore()

	roomCode, playerID, err := room.Create(store, "Alice")
	if err != nil {
		t.Fatalf("create room: %v", err)
	}
	if roomCode == "" {
		t.Fatal("roomCode is empty")
	}
	if playerID == "" {
		t.Fatal("playerID is empty")
	}

	state, err := store.Get(roomCode)
	if err != nil {
		t.Fatalf("get created room: %v", err)
	}

	if state.Phase != room.GamePhaseWaiting {
		t.Fatalf("phase = %q, want %q", state.Phase, room.GamePhaseWaiting)
	}
	if !slices.Equal(state.Variation.WordLengths, config.Cfg.DefaultWordLengths) {
		t.Fatalf("word lengths = %v, want %v", state.Variation.WordLengths, config.Cfg.DefaultWordLengths)
	}
	if state.TurnDurationMs != config.Cfg.TurnDurationMS {
		t.Fatalf("turn duration = %d, want %d", state.TurnDurationMs, config.Cfg.TurnDurationMS)
	}
	if len(state.Players) != 1 {
		t.Fatalf("players length = %d, want 1", len(state.Players))
	}

	host := state.Players[0]
	if host.ID != playerID {
		t.Fatalf("host ID = %q, want %q", host.ID, playerID)
	}
	if host.Name != "Alice" {
		t.Fatalf("host name = %q, want Alice", host.Name)
	}
	if host.IsReady {
		t.Fatal("host should not start ready")
	}
	if host.IsConnected {
		t.Fatal("host should not start connected")
	}
	if len(host.WordBoard.Rows) != len(config.Cfg.DefaultWordLengths) {
		t.Fatalf("word board rows = %d, want %d", len(host.WordBoard.Rows), len(config.Cfg.DefaultWordLengths))
	}
	for i, row := range host.WordBoard.Rows {
		wantLength := config.Cfg.DefaultWordLengths[i]
		if row.TargetLength != wantLength {
			t.Fatalf("row %d target length = %d, want %d", i, row.TargetLength, wantLength)
		}
		if len(row.Slots) != wantLength {
			t.Fatalf("row %d slots = %d, want %d", i, len(row.Slots), wantLength)
		}
	}
}
