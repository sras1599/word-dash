package room_test

import (
	"errors"
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
	if host.IsConnected {
		t.Fatal("host should not start connected")
	}
	if len(host.WordBoard.Rows) != 0 {
		t.Fatalf("word board rows = %d, want 0 before game start", len(host.WordBoard.Rows))
	}
}

func TestValidateStart(t *testing.T) {
	tests := []struct {
		name     string
		state    room.GameState
		playerID string
		wantErr  error
	}{
		{
			name:     "two players may start without readiness state",
			state:    room.GameState{Players: []room.Player{{ID: "host"}, {ID: "guest"}}, Phase: room.GamePhaseWaiting},
			playerID: "host",
		},
		{
			name:     "one player is not enough",
			state:    room.GameState{Players: []room.Player{{ID: "host"}}, Phase: room.GamePhaseWaiting},
			playerID: "host",
			wantErr:  room.ErrNotEnoughPlayers,
		},
		{
			name:     "non-host cannot start",
			state:    room.GameState{Players: []room.Player{{ID: "host"}, {ID: "guest"}}, Phase: room.GamePhaseWaiting},
			playerID: "guest",
			wantErr:  room.ErrNotHost,
		},
		{
			name:     "started game cannot start again",
			state:    room.GameState{Players: []room.Player{{ID: "host"}, {ID: "guest"}}, Phase: room.GamePhasePlaying},
			playerID: "host",
			wantErr:  room.ErrGameAlreadyStarted,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := room.ValidateStart(&tt.state, tt.playerID)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("ValidateStart() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestNewWordBoardBuildsRowsFromVariation(t *testing.T) {
	board := room.NewWordBoard(room.Variation{WordLengths: []int{5, 6}})

	if len(board.Rows) != 2 {
		t.Fatalf("word board rows = %d, want 2", len(board.Rows))
	}
	for i, wantLength := range []int{5, 6} {
		row := board.Rows[i]
		if row.TargetLength != wantLength {
			t.Fatalf("row %d target length = %d, want %d", i, row.TargetLength, wantLength)
		}
		if len(row.Slots) != wantLength {
			t.Fatalf("row %d slots = %d, want %d", i, len(row.Slots), wantLength)
		}
		for slotIndex, slot := range row.Slots {
			if slot.SlotIndex != slotIndex {
				t.Fatalf("row %d slot index = %d, want %d", i, slot.SlotIndex, slotIndex)
			}
		}
	}
}
