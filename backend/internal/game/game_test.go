package game

import (
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
