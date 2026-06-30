package game

import (
	"errors"
	"testing"

	"github.com/sras1599/wordit/backend/internal/room"
)

type testDictionary map[string]bool

func (d testDictionary) IsValidWord(word string) bool {
	return d[word]
}

func TestPlaceCardCompletesRowOnlyWhenDictionaryAcceptsWord(t *testing.T) {
	tests := []struct {
		name     string
		dict     testDictionary
		wantDone bool
	}{
		{name: "accepted word", dict: testDictionary{"cat": true}, wantDone: true},
		{name: "rejected word", dict: testDictionary{"dog": true}, wantDone: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := newPlacementTestState()

			for _, cardID := range []string{"card-c", "card-a", "card-t"} {
				slotIndex := len(state.Players[0].WordBoard.Rows[0].Slots) - len(state.Players[0].Hand)
				if err := PlaceCard(state, "player-1", cardID, 0, slotIndex, tt.dict); err != nil {
					t.Fatalf("place card %s: %v", cardID, err)
				}
			}

			row := state.Players[0].WordBoard.Rows[0]
			if row.IsComplete != tt.wantDone {
				t.Fatalf("row complete = %v, want %v", row.IsComplete, tt.wantDone)
			}
			if state.Players[0].WordBoard.AllComplete != tt.wantDone {
				t.Fatalf("board complete = %v, want %v", state.Players[0].WordBoard.AllComplete, tt.wantDone)
			}
		})
	}
}

func TestUnplaceCardAllowsOwnBoardEditsDuringDrawAndArrange(t *testing.T) {
	tests := []struct {
		name      string
		turnPhase room.TurnPhase
	}{
		{name: "draw phase", turnPhase: room.TurnPhaseDraw},
		{name: "arrange phase", turnPhase: room.TurnPhaseArrange},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := newUnplaceTestState(tt.turnPhase)

			if err := UnplaceCard(state, "player-2", 0, 0); err != nil {
				t.Fatalf("unplace card: %v", err)
			}

			player := state.Players[1]
			if got := player.WordBoard.Rows[0].Slots[0].Card; got != nil {
				t.Fatalf("slot card = %#v, want nil", got)
			}
			if got := len(player.Hand); got != 1 {
				t.Fatalf("hand length = %d, want 1", got)
			}
			if got := player.Hand[0].ID; got != "card-z" {
				t.Fatalf("unplaced card ID = %q, want card-z", got)
			}
			if player.WordBoard.Rows[0].IsComplete {
				t.Fatal("row complete = true, want false after unplace")
			}
			if player.WordBoard.AllComplete {
				t.Fatal("board complete = true, want false after unplace")
			}
		})
	}
}

func TestUnplaceCardRejectsIdleTurnPhase(t *testing.T) {
	state := newUnplaceTestState(room.TurnPhaseIdle)

	err := UnplaceCard(state, "player-2", 0, 0)
	if !errors.Is(err, ErrInvalidPhase) {
		t.Fatalf("error = %v, want %v", err, ErrInvalidPhase)
	}
}

func TestUnplaceCardRejectsNonPlayingGamePhase(t *testing.T) {
	tests := []struct {
		name  string
		phase room.GamePhase
	}{
		{name: "waiting", phase: room.GamePhaseWaiting},
		{name: "finished", phase: room.GamePhaseFinished},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := newUnplaceTestState(room.TurnPhaseArrange)
			state.Phase = tt.phase

			if err := UnplaceCard(state, "player-2", 0, 0); err == nil {
				t.Fatal("error = nil, want non-nil")
			}
		})
	}
}

func TestUnplaceCardValidatesSlotAndCard(t *testing.T) {
	tests := []struct {
		name      string
		rowIndex  int
		slotIndex int
		wantErr   error
		emptySlot bool
	}{
		{name: "row out of range", rowIndex: 2, slotIndex: 0, wantErr: ErrInvalidSlot},
		{name: "slot out of range", rowIndex: 0, slotIndex: 2, wantErr: ErrInvalidSlot},
		{name: "empty slot", rowIndex: 0, slotIndex: 1, wantErr: ErrInvalidCard, emptySlot: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := newUnplaceTestState(room.TurnPhaseArrange)
			if tt.emptySlot {
				state.Players[1].WordBoard.Rows[0].Slots[1].Card = nil
			}

			err := UnplaceCard(state, "player-2", tt.rowIndex, tt.slotIndex)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func newPlacementTestState() *room.GameState {
	return &room.GameState{
		RoomCode: "ABC123",
		Phase:    room.GamePhasePlaying,
		Turn: room.Turn{
			CurrentPlayerID: "player-1",
			Phase:           room.TurnPhaseArrange,
		},
		Players: []room.Player{
			{
				ID: "player-1",
				Hand: []room.Card{
					{ID: "card-c", Letter: "C"},
					{ID: "card-a", Letter: "A"},
					{ID: "card-t", Letter: "T"},
				},
				WordBoard: room.NewWordBoard(room.Variation{WordLengths: []int{3}}),
			},
		},
	}
}

func newUnplaceTestState(turnPhase room.TurnPhase) *room.GameState {
	board := room.NewWordBoard(room.Variation{WordLengths: []int{2}})
	board.Rows[0].Slots[0].Card = &room.Card{ID: "card-z", Letter: "Z"}
	board.Rows[0].IsComplete = true
	board.AllComplete = true

	return &room.GameState{
		RoomCode: "ABC123",
		Phase:    room.GamePhasePlaying,
		Turn: room.Turn{
			CurrentPlayerID: "player-1",
			Phase:           turnPhase,
		},
		Players: []room.Player{
			{
				ID:        "player-1",
				Hand:      []room.Card{},
				WordBoard: room.NewWordBoard(room.Variation{WordLengths: []int{2}}),
			},
			{
				ID:        "player-2",
				Hand:      []room.Card{},
				WordBoard: board,
			},
		},
	}
}
