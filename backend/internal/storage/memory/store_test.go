package memory

import (
	"slices"
	"testing"

	"github.com/sras1599/wordit/backend/internal/dictionary"
	"github.com/sras1599/wordit/backend/internal/game"
	"github.com/sras1599/wordit/backend/internal/room"
)

func TestPutGetPreservesBoardRevision(t *testing.T) {
	store := NewStore()
	state := testPlayingState(nil)
	state.Players[0].BoardRevision = 9
	if err := store.Put(state); err != nil {
		t.Fatalf("put state: %v", err)
	}
	reloaded, err := store.Get("ROOM1")
	if err != nil {
		t.Fatalf("get state: %v", err)
	}
	if got := reloaded.Players[0].BoardRevision; got != 9 {
		t.Fatalf("board revision = %d, want 9", got)
	}
}

func TestUpdateGameStatePersistsPlacedUnplacedCardsAndWinner(t *testing.T) {
	store := NewStore()
	state := testPlayingState([]room.Card{
		{ID: "card-a", Letter: "A"},
		{ID: "card-t", Letter: "T"},
	})
	if err := store.Put(state); err != nil {
		t.Fatalf("put state: %v", err)
	}

	if _, err := store.UpdateGameState("ROOM1", func(state *room.GameState) error {
		return game.PlaceCard(state, "player-1", "card-a", 0, 0, dictionary.NopChecker{})
	}); err != nil {
		t.Fatalf("place card: %v", err)
	}

	reloaded, err := store.Get("ROOM1")
	if err != nil {
		t.Fatalf("get after place: %v", err)
	}
	slot := reloaded.Players[0].WordBoard.Rows[0].Slots[0]
	if slot.Card == nil || slot.Card.ID != "card-a" {
		t.Fatalf("expected placed card-a in slot 0, got %#v", slot.Card)
	}
	if got := len(reloaded.Players[0].Hand); got != 1 {
		t.Fatalf("expected hand length 1 after place, got %d", got)
	}

	if _, err := store.UpdateGameState("ROOM1", func(state *room.GameState) error {
		return game.UnplaceCard(state, "player-1", 0, 0)
	}); err != nil {
		t.Fatalf("unplace card: %v", err)
	}

	reloaded, err = store.Get("ROOM1")
	if err != nil {
		t.Fatalf("get after unplace: %v", err)
	}
	if card := reloaded.Players[0].WordBoard.Rows[0].Slots[0].Card; card != nil {
		t.Fatalf("expected empty slot after unplace, got %#v", card)
	}
	if got := len(reloaded.Players[0].Hand); got != 2 {
		t.Fatalf("expected hand length 2 after unplace, got %d", got)
	}

	if _, err := store.UpdateGameState("ROOM1", func(state *room.GameState) error {
		if err := game.PlaceCard(state, "player-1", "card-a", 0, 0, dictionary.NopChecker{}); err != nil {
			return err
		}
		if err := game.PlaceCard(state, "player-1", "card-t", 0, 1, dictionary.NopChecker{}); err != nil {
			return err
		}
		_, _, err := game.DeclareWinnerIfComplete(state, "player-1")
		return err
	}); err != nil {
		t.Fatalf("complete board: %v", err)
	}

	reloaded, err = store.Get("ROOM1")
	if err != nil {
		t.Fatalf("get after win: %v", err)
	}
	if !reloaded.Players[0].WordBoard.AllComplete {
		t.Fatal("expected completed board to be persisted")
	}
	if reloaded.Phase != room.GamePhaseFinished {
		t.Fatalf("expected finished phase, got %q", reloaded.Phase)
	}
	if reloaded.WinnerID == nil || *reloaded.WinnerID != "player-1" {
		t.Fatalf("expected player-1 winner, got %#v", reloaded.WinnerID)
	}
}

func TestUpdateGameStatePersistsDiscard(t *testing.T) {
	store := NewStore()
	state := testPlayingState([]room.Card{{ID: "card-a", Letter: "A"}})
	if err := store.Put(state); err != nil {
		t.Fatalf("put state: %v", err)
	}

	if _, err := store.UpdateGameState("ROOM1", func(state *room.GameState) error {
		_, _, err := game.DiscardCard(state, "player-1", "card-a", 120_000)
		return err
	}); err != nil {
		t.Fatalf("discard card: %v", err)
	}

	reloaded, err := store.Get("ROOM1")
	if err != nil {
		t.Fatalf("get after discard: %v", err)
	}
	if got := len(reloaded.Players[0].Hand); got != 0 {
		t.Fatalf("expected empty hand after discard, got %d cards", got)
	}
	if reloaded.DiscardPileTop == nil || reloaded.DiscardPileTop.ID != "card-a" {
		t.Fatalf("expected card-a discard top, got %#v", reloaded.DiscardPileTop)
	}
	if got := len(reloaded.DiscardPile); got != 1 {
		t.Fatalf("expected one persisted discard, got %d", got)
	}
	if reloaded.Turn.Phase != room.TurnPhaseDraw {
		t.Fatalf("expected turn phase draw after discard, got %q", reloaded.Turn.Phase)
	}
	if reloaded.Turn.EndsAtUnixMs != 120_000 || reloaded.Turn.Sequence != 2 {
		t.Fatalf("turn deadline/sequence = %d/%d, want 120000/2", reloaded.Turn.EndsAtUnixMs, reloaded.Turn.Sequence)
	}
}

func TestStartGameBuildsWordBoardsFromFinalVariation(t *testing.T) {
	store := NewStore()
	state := &room.GameState{
		RoomCode: "ROOM1",
		Variation: room.Variation{
			WordLengths: []int{5, 6},
		},
		Players: []room.Player{
			{
				ID:        "host",
				Name:      "Host",
				WordBoard: room.NewWordBoard(room.Variation{WordLengths: []int{3, 4, 5}}),
			},
			{
				ID:        "guest",
				Name:      "Guest",
				WordBoard: room.NewWordBoard(room.Variation{WordLengths: []int{4}}),
			},
		},
		Phase:          room.GamePhaseWaiting,
		TurnDurationMs: 60_000,
	}
	if err := store.Put(state); err != nil {
		t.Fatalf("put state: %v", err)
	}

	started, err := store.StartGame("ROOM1", "host", testDeck(40), 120_000)
	if err != nil {
		t.Fatalf("start game: %v", err)
	}
	if started.Turn.EndsAtUnixMs != 120_000 || started.Turn.Sequence != 1 {
		t.Fatalf("first turn deadline/sequence = %d/%d, want 120000/1", started.Turn.EndsAtUnixMs, started.Turn.Sequence)
	}

	for _, player := range started.Players {
		gotLengths := make([]int, len(player.WordBoard.Rows))
		for i, row := range player.WordBoard.Rows {
			gotLengths[i] = row.TargetLength
			if len(row.Slots) != row.TargetLength {
				t.Fatalf("player %s row %d slots = %d, want %d", player.ID, i, len(row.Slots), row.TargetLength)
			}
		}
		if !slices.Equal(gotLengths, []int{5, 6}) {
			t.Fatalf("player %s board lengths = %v, want [5 6]", player.ID, gotLengths)
		}
		if got := len(player.Hand); got != 11 {
			t.Fatalf("player %s hand length = %d, want 11", player.ID, got)
		}
	}
}

func testPlayingState(hand []room.Card) *room.GameState {
	return &room.GameState{
		RoomCode: "ROOM1",
		Variation: room.Variation{
			WordLengths: []int{2},
		},
		Players: []room.Player{
			{
				ID:   "player-1",
				Name: "Player 1",
				Hand: append([]room.Card(nil), hand...),
				WordBoard: room.WordBoard{
					Rows: []room.WordRow{
						{
							TargetLength: 2,
							Slots: []room.WordSlot{
								{SlotIndex: 0},
								{SlotIndex: 1},
							},
						},
					},
				},
				IsConnected: true,
			},
		},
		Turn: room.Turn{
			CurrentPlayerID: "player-1",
			Phase:           room.TurnPhaseArrange,
			EndsAtUnixMs:    60_000,
			Sequence:        1,
		},
		Phase:          room.GamePhasePlaying,
		TurnDurationMs: 60_000,
	}
}

func testDeck(count int) []room.Card {
	cards := make([]room.Card, count)
	for i := range cards {
		cards[i] = room.Card{ID: "card", Letter: "A"}
	}
	return cards
}
