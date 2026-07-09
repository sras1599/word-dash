package ws

import (
	"testing"

	"github.com/sras1599/wordit/backend/internal/room"
)

func TestCardDrawnPayloadForIncludesTimerAndScopesCardVisibility(t *testing.T) {
	drawnCard := room.Card{ID: "card-a", Letter: "A"}
	state := &room.GameState{
		DrawPileCount: 12,
		Turn: room.Turn{
			CurrentPlayerID: "player-1",
			Phase:           room.TurnPhaseArrange,
			TimeRemainingMs: 42_000,
			DrawnCard:       &drawnCard,
		},
	}

	ownerPayload := cardDrawnPayloadFor(state, "player-1", "player-1", "draw", &drawnCard)
	if ownerPayload.TimeRemainingMs != 42_000 {
		t.Fatalf("owner payload timeRemainingMs = %d, want 42000", ownerPayload.TimeRemainingMs)
	}
	if ownerPayload.Card == nil || ownerPayload.Card.ID != drawnCard.ID {
		t.Fatalf("owner payload card = %#v, want drawn card", ownerPayload.Card)
	}

	opponentPayload := cardDrawnPayloadFor(state, "player-2", "player-1", "draw", &drawnCard)
	if opponentPayload.TimeRemainingMs != 42_000 {
		t.Fatalf("opponent payload timeRemainingMs = %d, want 42000", opponentPayload.TimeRemainingMs)
	}
	if opponentPayload.Card != nil {
		t.Fatalf("opponent payload card = %#v, want nil", opponentPayload.Card)
	}
}

func TestClearEventsAreRegistered(t *testing.T) {
	if eventHandlers["game:clear_word"] == nil {
		t.Fatal("game:clear_word handler is not registered")
	}
	if eventHandlers["game:clear_board"] == nil {
		t.Fatal("game:clear_board handler is not registered")
	}
}

func TestApplyClearWordCapturesBoardUpdate(t *testing.T) {
	state := newClearActionWSState()
	var update boardUpdate

	err := applyClearWord(state, "player-1", clearWordRequest{RowIndex: 0}, &update)
	if err != nil {
		t.Fatalf("apply clear word: %v", err)
	}

	if got := len(update.hand); got != 2 {
		t.Fatalf("update hand length = %d, want 2", got)
	}
	if update.hand[0].ID != "card-hand" || update.hand[1].ID != "card-a" {
		t.Fatalf("update hand = %#v, want card-hand then card-a", update.hand)
	}
	if update.board.Rows[0].Slots[0].Card != nil {
		t.Fatalf("cleared slot card = %#v, want nil", update.board.Rows[0].Slots[0].Card)
	}
	if update.board.AllComplete {
		t.Fatal("board allComplete = true, want false")
	}
}

func TestApplyClearBoardCapturesBoardUpdate(t *testing.T) {
	state := newClearActionWSState()
	var update boardUpdate

	err := applyClearBoard(state, "player-1", &update)
	if err != nil {
		t.Fatalf("apply clear board: %v", err)
	}

	if got := len(update.hand); got != 3 {
		t.Fatalf("update hand length = %d, want 3", got)
	}
	if update.hand[0].ID != "card-hand" || update.hand[1].ID != "card-a" || update.hand[2].ID != "card-b" {
		t.Fatalf("update hand = %#v, want card-hand/card-a/card-b", update.hand)
	}
	for rowIndex, row := range update.board.Rows {
		for slotIndex, slot := range row.Slots {
			if slot.Card != nil {
				t.Fatalf("row %d slot %d card = %#v, want nil", rowIndex, slotIndex, slot.Card)
			}
		}
	}
}

func newClearActionWSState() *room.GameState {
	board := room.NewWordBoard(room.Variation{WordLengths: []int{1, 1}})
	cardA := room.Card{ID: "card-a", Letter: "A"}
	cardB := room.Card{ID: "card-b", Letter: "B"}
	board.Rows[0].Slots[0].Card = &cardA
	board.Rows[0].IsComplete = true
	board.Rows[1].Slots[0].Card = &cardB
	board.Rows[1].IsComplete = true
	board.AllComplete = true

	return &room.GameState{
		Phase: room.GamePhasePlaying,
		Turn:  room.Turn{Phase: room.TurnPhaseArrange},
		Players: []room.Player{
			{
				ID:        "player-1",
				Hand:      []room.Card{{ID: "card-hand", Letter: "H"}},
				WordBoard: board,
			},
		},
	}
}
