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

func TestPlaceCardAppendsDisplacedBoardCardWhenHandCardPlacedOnOccupiedSlot(t *testing.T) {
	state := newPlacementTestState()

	if err := PlaceCard(state, "player-1", "card-c", 0, 0, testDictionary{}); err != nil {
		t.Fatalf("place initial card: %v", err)
	}
	if err := PlaceCard(state, "player-1", "card-a", 0, 0, testDictionary{}); err != nil {
		t.Fatalf("replace occupied slot: %v", err)
	}

	player := state.Players[0]
	if got := player.WordBoard.Rows[0].Slots[0].Card; got == nil || got.ID != "card-a" {
		t.Fatalf("slot card = %#v, want card-a", got)
	}
	if got := cardIDs(player.Hand); !equalStrings(got, []string{"card-t", "card-c"}) {
		t.Fatalf("hand card IDs = %v, want [card-t card-c]", got)
	}
}

func TestPlaceCardSwapsBoardCardsInOccupiedSlots(t *testing.T) {
	state := newBoardSwapTestState([]int{3})

	if err := PlaceCard(state, "player-1", "card-b", 0, 0, testDictionary{}); err != nil {
		t.Fatalf("swap board cards: %v", err)
	}

	player := state.Players[0]
	if got := player.WordBoard.Rows[0].Slots[0].Card; got == nil || got.ID != "card-b" {
		t.Fatalf("slot 0 card = %#v, want card-b", got)
	}
	if got := player.WordBoard.Rows[0].Slots[1].Card; got == nil || got.ID != "card-a" {
		t.Fatalf("slot 1 card = %#v, want card-a", got)
	}
	if got := len(player.Hand); got != 0 {
		t.Fatalf("hand length = %d, want 0", got)
	}
}

func TestPlaceCardSwapsBoardCardsAcrossRows(t *testing.T) {
	state := newBoardSwapTestState([]int{2, 2})

	if err := PlaceCard(state, "player-1", "card-c", 0, 1, testDictionary{}); err != nil {
		t.Fatalf("swap board cards across rows: %v", err)
	}

	player := state.Players[0]
	if got := player.WordBoard.Rows[0].Slots[1].Card; got == nil || got.ID != "card-c" {
		t.Fatalf("row 0 slot 1 card = %#v, want card-c", got)
	}
	if got := player.WordBoard.Rows[1].Slots[0].Card; got == nil || got.ID != "card-b" {
		t.Fatalf("row 1 slot 0 card = %#v, want card-b", got)
	}
	if got := len(player.Hand); got != 0 {
		t.Fatalf("hand length = %d, want 0", got)
	}
}

func TestDrawCardPreservesTurnDeadline(t *testing.T) {
	state := newDrawCardTestState()
	state.Turn.EndsAtUnixMs = 5_000

	drawn, err := DrawCard(state, "player-1", "draw")
	if err != nil {
		t.Fatalf("draw card: %v", err)
	}

	if drawn == nil || drawn.ID != "card-drawn" {
		t.Fatalf("drawn card = %#v, want card-drawn", drawn)
	}
	if state.Turn.Phase != room.TurnPhaseArrange {
		t.Fatalf("turn phase = %q, want arrange", state.Turn.Phase)
	}
	if state.Turn.EndsAtUnixMs != 5_000 {
		t.Fatalf("deadline = %d, want 5000", state.Turn.EndsAtUnixMs)
	}
	if state.Turn.DrawnCard == nil || state.Turn.DrawnCard.ID != "card-drawn" {
		t.Fatalf("turn drawn card = %#v, want card-drawn", state.Turn.DrawnCard)
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

func TestClearWordReturnsRowCardsToHandInSlotOrder(t *testing.T) {
	state := newClearTestState(room.TurnPhaseArrange)

	if err := ClearWord(state, "player-2", 0); err != nil {
		t.Fatalf("clear word: %v", err)
	}

	player := state.Players[1]
	if got := cardIDs(player.Hand); !equalStrings(got, []string{"card-hand", "card-a", "card-b"}) {
		t.Fatalf("hand card IDs = %v, want [card-hand card-a card-b]", got)
	}
	for slotIndex, slot := range player.WordBoard.Rows[0].Slots {
		if slot.Card != nil {
			t.Fatalf("row 0 slot %d card = %#v, want nil", slotIndex, slot.Card)
		}
	}
	if player.WordBoard.Rows[0].IsComplete {
		t.Fatal("row 0 complete = true, want false")
	}
	if player.WordBoard.AllComplete {
		t.Fatal("board complete = true, want false")
	}
	if got := state.Players[1].WordBoard.Rows[1].Slots[0].Card; got == nil || got.ID != "card-c" {
		t.Fatalf("row 1 slot 0 card = %#v, want card-c", got)
	}
}

func TestClearWordAllowsEmptyRowsAsNoOp(t *testing.T) {
	state := newClearTestState(room.TurnPhaseDraw)

	if err := ClearWord(state, "player-2", 2); err != nil {
		t.Fatalf("clear empty word: %v", err)
	}

	player := state.Players[1]
	if got := cardIDs(player.Hand); !equalStrings(got, []string{"card-hand"}) {
		t.Fatalf("hand card IDs = %v, want [card-hand]", got)
	}
	if player.WordBoard.Rows[2].IsComplete {
		t.Fatal("empty row complete = true, want false")
	}
	if player.WordBoard.AllComplete {
		t.Fatal("board complete = true, want false")
	}
}

func TestClearBoardReturnsCardsToHandInRowMajorOrder(t *testing.T) {
	state := newClearTestState(room.TurnPhaseArrange)

	if err := ClearBoard(state, "player-2"); err != nil {
		t.Fatalf("clear board: %v", err)
	}

	player := state.Players[1]
	if got := cardIDs(player.Hand); !equalStrings(got, []string{"card-hand", "card-a", "card-b", "card-c"}) {
		t.Fatalf("hand card IDs = %v, want [card-hand card-a card-b card-c]", got)
	}
	for rowIndex, row := range player.WordBoard.Rows {
		if row.IsComplete {
			t.Fatalf("row %d complete = true, want false", rowIndex)
		}
		for slotIndex, slot := range row.Slots {
			if slot.Card != nil {
				t.Fatalf("row %d slot %d card = %#v, want nil", rowIndex, slotIndex, slot.Card)
			}
		}
	}
	if player.WordBoard.AllComplete {
		t.Fatal("board complete = true, want false")
	}
}

func TestClearActionsValidateState(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*room.GameState)
		run     func(*room.GameState) error
		want    error
		wantErr bool
	}{
		{
			name: "clear word rejects idle turn phase",
			mutate: func(state *room.GameState) {
				state.Turn.Phase = room.TurnPhaseIdle
			},
			run:  func(state *room.GameState) error { return ClearWord(state, "player-2", 0) },
			want: ErrInvalidPhase,
		},
		{
			name: "clear board rejects idle turn phase",
			mutate: func(state *room.GameState) {
				state.Turn.Phase = room.TurnPhaseIdle
			},
			run:  func(state *room.GameState) error { return ClearBoard(state, "player-2") },
			want: ErrInvalidPhase,
		},
		{
			name: "clear word rejects non-playing game phase",
			mutate: func(state *room.GameState) {
				state.Phase = room.GamePhaseFinished
			},
			run:     func(state *room.GameState) error { return ClearWord(state, "player-2", 0) },
			wantErr: true,
		},
		{
			name: "clear board rejects non-playing game phase",
			mutate: func(state *room.GameState) {
				state.Phase = room.GamePhaseWaiting
			},
			run:     func(state *room.GameState) error { return ClearBoard(state, "player-2") },
			wantErr: true,
		},
		{
			name: "clear word rejects invalid row",
			run:  func(state *room.GameState) error { return ClearWord(state, "player-2", 9) },
			want: ErrInvalidSlot,
		},
		{
			name: "clear word rejects unknown player",
			run:  func(state *room.GameState) error { return ClearWord(state, "missing-player", 0) },
			want: room.ErrPlayerNotFound,
		},
		{
			name: "clear board rejects unknown player",
			run:  func(state *room.GameState) error { return ClearBoard(state, "missing-player") },
			want: room.ErrPlayerNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := newClearTestState(room.TurnPhaseArrange)
			if tt.mutate != nil {
				tt.mutate(state)
			}

			err := tt.run(state)
			if tt.want != nil && !errors.Is(err, tt.want) {
				t.Fatalf("error = %v, want %v", err, tt.want)
			}
			if tt.wantErr && err == nil {
				t.Fatal("error = nil, want non-nil")
			}
		})
	}
}

func TestAutoDiscardDrawnCardRemovesDrawnCardFromHand(t *testing.T) {
	state := newAutoDiscardTestState()

	discarded, nextPlayerID, err := AutoDiscardDrawnCard(state, "player-1", 120_000)
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
	if state.Turn.EndsAtUnixMs != 120_000 {
		t.Fatalf("deadline = %d, want 120000", state.Turn.EndsAtUnixMs)
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

	discarded, _, err := AutoDiscardDrawnCard(state, "player-1", 120_000)
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

			_, _, err := AutoDiscardDrawnCard(state, "player-1", 120_000)
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

func newBoardSwapTestState(wordLengths []int) *room.GameState {
	board := room.NewWordBoard(room.Variation{WordLengths: wordLengths})
	cardA := room.Card{ID: "card-a", Letter: "A"}
	cardB := room.Card{ID: "card-b", Letter: "B"}
	cardC := room.Card{ID: "card-c", Letter: "C"}
	board.Rows[0].Slots[0].Card = &cardA
	board.Rows[0].Slots[1].Card = &cardB
	if len(board.Rows) > 1 {
		board.Rows[1].Slots[0].Card = &cardC
	}

	return &room.GameState{
		RoomCode: "ABC123",
		Phase:    room.GamePhasePlaying,
		Turn: room.Turn{
			CurrentPlayerID: "player-1",
			Phase:           room.TurnPhaseArrange,
		},
		Players: []room.Player{
			{
				ID:        "player-1",
				Hand:      []room.Card{},
				WordBoard: board,
			},
		},
	}
}

func cardIDs(cards []room.Card) []string {
	ids := make([]string, len(cards))
	for i, card := range cards {
		ids[i] = card.ID
	}
	return ids
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func newAutoDiscardTestState() *room.GameState {
	drawnCard := room.Card{ID: "card-drawn", Letter: "D"}

	return &room.GameState{
		RoomCode: "ABC123",
		Phase:    room.GamePhasePlaying,
		Turn: room.Turn{
			CurrentPlayerID: "player-1",
			Phase:           room.TurnPhaseArrange,
			EndsAtUnixMs:    1,
			Sequence:        1,
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

func newDrawCardTestState() *room.GameState {
	return &room.GameState{
		RoomCode: "ABC123",
		Phase:    room.GamePhasePlaying,
		Turn: room.Turn{
			CurrentPlayerID: "player-1",
			Phase:           room.TurnPhaseDraw,
			EndsAtUnixMs:    60_000,
			Sequence:        1,
		},
		Players: []room.Player{
			{
				ID:        "player-1",
				Hand:      []room.Card{},
				WordBoard: room.NewWordBoard(room.Variation{WordLengths: []int{2}}),
			},
		},
		TurnDurationMs: 60_000,
		DrawPile:       []room.Card{{ID: "card-drawn", Letter: "D"}},
		DrawPileCount:  1,
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

func newClearTestState(turnPhase room.TurnPhase) *room.GameState {
	board := room.NewWordBoard(room.Variation{WordLengths: []int{3, 2, 1}})
	cardA := room.Card{ID: "card-a", Letter: "A"}
	cardB := room.Card{ID: "card-b", Letter: "B"}
	cardC := room.Card{ID: "card-c", Letter: "C"}
	board.Rows[0].Slots[0].Card = &cardA
	board.Rows[0].Slots[2].Card = &cardB
	board.Rows[0].IsComplete = true
	board.Rows[1].Slots[0].Card = &cardC
	board.Rows[1].IsComplete = true
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
				WordBoard: room.NewWordBoard(room.Variation{WordLengths: []int{3, 2, 1}}),
			},
			{
				ID:        "player-2",
				Hand:      []room.Card{{ID: "card-hand", Letter: "H"}},
				WordBoard: board,
			},
		},
	}
}
