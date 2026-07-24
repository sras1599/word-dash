package redis

import (
	"testing"

	"github.com/sras1599/wordit/backend/internal/room"
)

func TestEncodeDecodePreservesGameBoardDiscardAndWinner(t *testing.T) {
	winnerID := "player-1"
	state := &room.GameState{
		RoomCode: "ROOM1",
		Variation: room.Variation{
			WordLengths: []int{2},
		},
		Players: []room.Player{
			{
				ID:   "player-1",
				Name: "Player 1",
				Hand: []room.Card{
					{ID: "card-x", Letter: "X"},
				},
				WordBoard: room.WordBoard{
					Rows: []room.WordRow{
						{
							TargetLength: 2,
							Slots: []room.WordSlot{
								{SlotIndex: 0, Card: &room.Card{ID: "card-a", Letter: "A"}},
								{SlotIndex: 1, Card: &room.Card{ID: "card-t", Letter: "T"}},
							},
							IsComplete: true,
						},
					},
					AllComplete: true,
				},
				BoardRevision: 7,
				IsConnected:   true,
			},
		},
		DrawPileCount: 1,
		DiscardPileTop: &room.Card{
			ID:     "card-d",
			Letter: "D",
		},
		Turn: room.Turn{
			CurrentPlayerID: "player-1",
			Phase:           room.TurnPhaseIdle,
			EndsAtUnixMs:    123_456,
			Sequence:        9,
		},
		Phase:          room.GamePhaseFinished,
		WinnerID:       &winnerID,
		TurnDurationMs: 60_000,
		DrawPile: []room.Card{
			{ID: "card-z", Letter: "Z"},
		},
		DiscardPile: []room.Card{
			{ID: "card-d", Letter: "D"},
		},
	}

	data, err := encodeGameState(state)
	if err != nil {
		t.Fatalf("encode state: %v", err)
	}
	decoded, err := decodeGameState(data)
	if err != nil {
		t.Fatalf("decode state: %v", err)
	}

	slot := decoded.Players[0].WordBoard.Rows[0].Slots[1]
	if slot.Card == nil || slot.Card.ID != "card-t" {
		t.Fatalf("expected card-t in decoded board slot, got %#v", slot.Card)
	}
	if got := len(decoded.Players[0].Hand); got != 1 {
		t.Fatalf("expected one decoded hand card, got %d", got)
	}
	if got := decoded.Players[0].BoardRevision; got != 7 {
		t.Fatalf("decoded board revision = %d, want 7", got)
	}
	if decoded.DiscardPileTop == nil || decoded.DiscardPileTop.ID != "card-d" {
		t.Fatalf("expected decoded discard top card-d, got %#v", decoded.DiscardPileTop)
	}
	if got := len(decoded.DiscardPile); got != 1 {
		t.Fatalf("expected one decoded discard card, got %d", got)
	}
	if !decoded.Players[0].WordBoard.AllComplete {
		t.Fatal("expected decoded board completion")
	}
	if decoded.Phase != room.GamePhaseFinished {
		t.Fatalf("expected decoded finished phase, got %q", decoded.Phase)
	}
	if decoded.WinnerID == nil || *decoded.WinnerID != winnerID {
		t.Fatalf("expected decoded winner %q, got %#v", winnerID, decoded.WinnerID)
	}
	if decoded.Turn.EndsAtUnixMs != 123_456 || decoded.Turn.Sequence != 9 {
		t.Fatalf("decoded turn deadline/sequence = %d/%d, want 123456/9", decoded.Turn.EndsAtUnixMs, decoded.Turn.Sequence)
	}
}

func TestDecodeGameStateIgnoresLegacyReadinessField(t *testing.T) {
	decoded, err := decodeGameState([]byte(`{
		"roomCode":"ROOM1",
		"players":[{"ID":"player-1","Name":"Player 1","IsReady":true,"IsConnected":true}],
		"phase":"waiting"
	}`))
	if err != nil {
		t.Fatalf("decode legacy state: %v", err)
	}
	if len(decoded.Players) != 1 || decoded.Players[0].ID != "player-1" || !decoded.Players[0].IsConnected {
		t.Fatalf("decoded legacy players = %#v", decoded.Players)
	}
}
