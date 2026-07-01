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
