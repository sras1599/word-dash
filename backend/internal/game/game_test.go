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

func TestAutoDiscardDrawnCardRemovesDrawnCardFromHand(t *testing.T) {
	state := newAutoDiscardTestState()

	discarded, nextPlayerID, err := AutoDiscardDrawnCard(state, "player-1")
	if err != nil {
		t.Fatalf("auto-discard drawn card: %v", err)
	}

	if discarded == nil || discarded.ID != "card-drawn" {
		t.Fatalf("discarded = %#v, want card-drawn", discarded)
	}
	if nextPlayerID != "player-2" {
		t.Fatalf("next player = %q, want player-2", nextPlayerID)
	}
	if got := len(state.Players[0].Hand); got != 1 {
		t.Fatalf("hand length = %d, want 1", got)
	}
	if state.Players[0].Hand[0].ID != "card-a" {
		t.Fatalf("remaining card = %q, want card-a", state.Players[0].Hand[0].ID)
	}
	if state.DiscardPileTop == nil || state.DiscardPileTop.ID != "card-drawn" {
		t.Fatalf("discard pile top = %#v, want card-drawn", state.DiscardPileTop)
	}
	if got := len(state.DiscardPile); got != 1 {
		t.Fatalf("discard pile length = %d, want 1", got)
	}
	if state.Turn.CurrentPlayerID != "player-2" {
		t.Fatalf("current player = %q, want player-2", state.Turn.CurrentPlayerID)
	}
	if state.Turn.Phase != room.TurnPhaseDraw {
		t.Fatalf("turn phase = %q, want draw", state.Turn.Phase)
	}
	if state.Turn.TimeRemainingMs != state.TurnDurationMs {
		t.Fatalf("time remaining = %d, want %d", state.Turn.TimeRemainingMs, state.TurnDurationMs)
	}
	if state.Turn.DrawnCard != nil {
		t.Fatalf("drawn card = %#v, want nil", state.Turn.DrawnCard)
	}
}

func TestAutoDiscardDrawnCardRemovesDrawnCardFromBoard(t *testing.T) {
	state := newAutoDiscardTestState()
	drawn := state.Players[0].Hand[1]
	state.Players[0].Hand = state.Players[0].Hand[:1]
	state.Players[0].WordBoard.Rows[0].Slots[0].Card = &drawn
	state.Players[0].WordBoard.Rows[0].IsComplete = true
	state.Players[0].WordBoard.AllComplete = true

	discarded, _, err := AutoDiscardDrawnCard(state, "player-1")
	if err != nil {
		t.Fatalf("auto-discard drawn card: %v", err)
	}

	if discarded == nil || discarded.ID != "card-drawn" {
		t.Fatalf("discarded = %#v, want card-drawn", discarded)
	}
	if got := state.Players[0].WordBoard.Rows[0].Slots[0].Card; got != nil {
		t.Fatalf("board slot card = %#v, want nil", got)
	}
	if state.Players[0].WordBoard.Rows[0].IsComplete {
		t.Fatal("row complete = true, want false after board discard")
	}
	if state.Players[0].WordBoard.AllComplete {
		t.Fatal("board complete = true, want false after board discard")
	}
}

func TestAutoDiscardDrawnCardValidatesState(t *testing.T) {
	tests := []struct {
		name       string
		mutate     func(*room.GameState)
		want       error
		wantAnyErr bool
	}{
		{
			name: "missing drawn card",
			mutate: func(state *room.GameState) {
				state.Turn.DrawnCard = nil
			},
			want: ErrInvalidCard,
		},
		{
			name: "wrong phase",
			mutate: func(state *room.GameState) {
				state.Turn.Phase = room.TurnPhaseDraw
			},
			want: ErrInvalidPhase,
		},
		{
			name: "wrong player",
			mutate: func(state *room.GameState) {
				state.Turn.CurrentPlayerID = "player-2"
			},
			want: ErrNotYourTurn,
		},
		{
			name: "non-playing game",
			mutate: func(state *room.GameState) {
				state.Phase = room.GamePhaseFinished
			},
			wantAnyErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := newAutoDiscardTestState()
			tt.mutate(state)

			_, _, err := AutoDiscardDrawnCard(state, "player-1")
			if tt.want != nil && !errors.Is(err, tt.want) {
				t.Fatalf("error = %v, want %v", err, tt.want)
			}
			if tt.wantAnyErr && err == nil {
				t.Fatal("error = nil, want non-nil")
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

func newAutoDiscardTestState() *room.GameState {
	drawnCard := room.Card{ID: "card-drawn", Letter: "D"}

	return &room.GameState{
		RoomCode: "ABC123",
		Phase:    room.GamePhasePlaying,
		Turn: room.Turn{
			CurrentPlayerID: "player-1",
			Phase:           room.TurnPhaseArrange,
			TimeRemainingMs: 0,
			DrawnCard:       &drawnCard,
		},
		Players: []room.Player{
			{
				ID:        "player-1",
				Hand:      []room.Card{{ID: "card-a", Letter: "A"}, drawnCard},
				WordBoard: room.NewWordBoard(room.Variation{WordLengths: []int{2}}),
			},
			{
				ID:        "player-2",
				Hand:      []room.Card{},
				WordBoard: room.NewWordBoard(room.Variation{WordLengths: []int{2}}),
			},
		},
		TurnDurationMs: 60_000,
		DrawPile:       []room.Card{{ID: "card-b", Letter: "B"}},
		DrawPileCount:  1,
		DiscardPile:    []room.Card{},
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
