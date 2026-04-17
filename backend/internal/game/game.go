package game

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/sras1599/wordit/backend/internal/dictionary"
	"github.com/sras1599/wordit/backend/internal/room"
)

var (
	ErrNotYourTurn  = errors.New("NOT_YOUR_TURN")
	ErrInvalidPhase = errors.New("INVALID_PHASE")
	ErrEmptyDeck    = errors.New("EMPTY_DECK")
	ErrInvalidCard  = errors.New("INVALID_CARD")
	ErrInvalidSlot  = errors.New("INVALID_SLOT")
)

type cardLocation int

const (
	cardLocationHand cardLocation = iota
	cardLocationBoard
)

type locatedCard struct {
	card      room.Card
	location  cardLocation
	handIndex int
	rowIndex  int
	slotIndex int
}

// DrawCard draws a card from the specified source for the player.
func DrawCard(state *room.GameState, playerID string, source string) (*room.Card, error) {
	if state.Phase != room.GamePhasePlaying {
		return nil, fmt.Errorf("game not in playing phase")
	}

	if state.Turn.CurrentPlayerID != playerID {
		return nil, ErrNotYourTurn
	}

	if state.Turn.Phase != room.TurnPhaseDraw {
		return nil, ErrInvalidPhase
	}

	var drawnCard room.Card

	switch source {
	case "draw":
		if len(state.DrawPile) == 0 {
			// If draw pile is empty, we should shuffle the discard pile back in.
			// For now, return an error as per simple implementation.
			return nil, ErrEmptyDeck
		}
		drawnCard = state.DrawPile[0]
		state.DrawPile = state.DrawPile[1:]
		state.DrawPileCount = len(state.DrawPile)
	case "discard":
		if len(state.DiscardPile) == 0 {
			return nil, fmt.Errorf("discard pile is empty")
		}
		drawnCard = state.DiscardPile[len(state.DiscardPile)-1]
		state.DiscardPile = state.DiscardPile[:len(state.DiscardPile)-1]
		if len(state.DiscardPile) > 0 {
			state.DiscardPileTop = &state.DiscardPile[len(state.DiscardPile)-1]
		} else {
			state.DiscardPileTop = nil
		}
	default:
		return nil, fmt.Errorf("invalid draw source: %s", source)
	}

	// Update player hand
	for i := range state.Players {
		if state.Players[i].ID == playerID {
			state.Players[i].Hand = append(state.Players[i].Hand, drawnCard)
			break
		}
	}

	// Update turn state
	state.Turn.Phase = room.TurnPhaseArrange
	state.Turn.DrawnCard = &drawnCard
	playerName := ""
	if p, err := state.GetPlayer(playerID); err == nil {
		playerName = p.Name
	}
	slog.Info("game: card drawn",
		"roomCode", state.RoomCode,
		"player", fmt.Sprintf("%s (%s)", playerID, playerName),
		"source", source,
		"cardID", drawnCard.ID,
		"letter", drawnCard.Letter,
	)

	return &drawnCard, nil
}

// PlaceCard moves a card from the player's hand or board onto the specified
// slot on their word board. If the target slot already holds a card, that card
// is swapped back into the hand.
//
// After the placement the affected row's IsComplete flag and the board's
// AllComplete flag are recomputed using dict.
func PlaceCard(state *room.GameState, playerID, cardID string, rowIndex, slotIndex int, dict dictionary.DictionaryChecker) error {
	if state.Phase != room.GamePhasePlaying {
		return fmt.Errorf("game not in playing phase")
	}
	if state.Turn.Phase != room.TurnPhaseDraw && state.Turn.Phase != room.TurnPhaseArrange {
		return ErrInvalidPhase
	}

	// Locate the player.
	playerIdx := -1
	for i := range state.Players {
		if state.Players[i].ID == playerID {
			playerIdx = i
			break
		}
	}
	if playerIdx == -1 {
		return fmt.Errorf("player not found")
	}
	player := &state.Players[playerIdx]

	// Validate row and slot indices.
	if rowIndex < 0 || rowIndex >= len(player.WordBoard.Rows) {
		return ErrInvalidSlot
	}
	if slotIndex < 0 || slotIndex >= len(player.WordBoard.Rows[rowIndex].Slots) {
		return ErrInvalidSlot
	}

	cardRef, err := locatePlayerCard(player, cardID)
	if err != nil {
		return err
	}

	if cardRef.location == cardLocationBoard && cardRef.rowIndex == rowIndex && cardRef.slotIndex == slotIndex {
		// No-op move to the same slot.
		return nil
	}

	card := cardRef.card
	slot := &player.WordBoard.Rows[rowIndex].Slots[slotIndex]

	switch cardRef.location {
	case cardLocationHand:
		if slot.Card != nil {
			// Swap: put the existing slot card back in the hand at the same index.
			player.Hand[cardRef.handIndex] = *slot.Card
		} else {
			// No card in slot: remove the card from the hand.
			player.Hand = append(player.Hand[:cardRef.handIndex], player.Hand[cardRef.handIndex+1:]...)
		}
	case cardLocationBoard:
		if slot.Card != nil {
			displaced := *slot.Card
			if _, err := removeCardFromBoard(player, cardRef.rowIndex, cardRef.slotIndex); err != nil {
				return err
			}
			player.Hand = append(player.Hand, displaced)
		} else {
			if _, err := removeCardFromBoard(player, cardRef.rowIndex, cardRef.slotIndex); err != nil {
				return err
			}
		}
	}

	// Place the card in the slot.
	placed := card
	slot.Card = &placed

	// Recompute completeness flags.
	row := &player.WordBoard.Rows[rowIndex]
	row.IsComplete = computeRowComplete(row, dict)
	player.WordBoard.AllComplete = computeBoardAllComplete(player.WordBoard)
	playerName := ""
	if p, err := state.GetPlayer(playerID); err == nil {
		playerName = p.Name
	}
	slog.Info("game: card placed",
		"roomCode", state.RoomCode,
		"player", fmt.Sprintf("%s (%s)", playerID, playerName),
		"cardID", cardID,
		"row", rowIndex,
		"slot", slotIndex,
		"rowComplete", row.IsComplete,
		"boardComplete", player.WordBoard.AllComplete,
	)

	return nil
}

// UnplaceCard removes a card from the specified board slot and returns it to
// the active player's hand.
func UnplaceCard(state *room.GameState, playerID string, rowIndex, slotIndex int) error {
	if state.Phase != room.GamePhasePlaying {
		return fmt.Errorf("game not in playing phase")
	}
	if state.Turn.CurrentPlayerID != playerID {
		return ErrNotYourTurn
	}
	if state.Turn.Phase != room.TurnPhaseArrange {
		return ErrInvalidPhase
	}

	player, err := state.GetPlayer(playerID)
	if err != nil {
		return err
	}

	card, err := removeCardFromBoard(player, rowIndex, slotIndex)
	if err != nil {
		return err
	}

	player.Hand = append(player.Hand, card)
	slog.Info("game: card unplaced",
		"roomCode", state.RoomCode,
		"player", fmt.Sprintf("%s (%s)", playerID, player.Name),
		"row", rowIndex,
		"slot", slotIndex,
	)

	return nil
}

// DiscardCard removes a card from the active player's hand or board, pushes it
// to the discard pile, and advances the turn to the next player.
func DiscardCard(state *room.GameState, playerID, cardID string) (*room.Card, string, error) {
	if state.Phase != room.GamePhasePlaying {
		return nil, "", fmt.Errorf("game not in playing phase")
	}
	if state.Turn.CurrentPlayerID != playerID {
		return nil, "", ErrNotYourTurn
	}
	if state.Turn.Phase != room.TurnPhaseArrange {
		return nil, "", ErrInvalidPhase
	}
	if len(state.Players) == 0 {
		return nil, "", fmt.Errorf("no players in game")
	}

	playerIdx := -1
	for i := range state.Players {
		if state.Players[i].ID == playerID {
			playerIdx = i
			break
		}
	}
	if playerIdx == -1 {
		return nil, "", fmt.Errorf("player not found")
	}

	player := &state.Players[playerIdx]
	cardRef, err := locatePlayerCard(player, cardID)
	if err != nil {
		return nil, "", err
	}

	discarded := cardRef.card
	switch cardRef.location {
	case cardLocationHand:
		player.Hand = append(player.Hand[:cardRef.handIndex], player.Hand[cardRef.handIndex+1:]...)
	case cardLocationBoard:
		if _, err := removeCardFromBoard(player, cardRef.rowIndex, cardRef.slotIndex); err != nil {
			return nil, "", err
		}
	}

	state.DiscardPile = append(state.DiscardPile, discarded)
	state.DiscardPileTop = &room.Card{ID: discarded.ID, Letter: discarded.Letter}

	nextIdx := (playerIdx + 1) % len(state.Players)
	nextPlayerID := state.Players[nextIdx].ID
	state.Turn.CurrentPlayerID = nextPlayerID
	state.Turn.Phase = room.TurnPhaseDraw
	state.Turn.TimeRemainingMs = state.TurnDurationMs
	state.Turn.DrawnCard = nil
	playerName := ""
	if p, err := state.GetPlayer(playerID); err == nil {
		playerName = p.Name
	}
	nextPlayerName := ""
	if p, err := state.GetPlayer(nextPlayerID); err == nil {
		nextPlayerName = p.Name
	}
	slog.Info("game: card discarded",
		"roomCode", state.RoomCode,
		"player", fmt.Sprintf("%s (%s)", playerID, playerName),
		"cardID", cardID,
		"letter", discarded.Letter,
		"nextPlayer", fmt.Sprintf("%s (%s)", nextPlayerID, nextPlayerName),
	)

	return &discarded, nextPlayerID, nil
}

func locatePlayerCard(player *room.Player, cardID string) (locatedCard, error) {
	for i, c := range player.Hand {
		if c.ID == cardID {
			return locatedCard{
				card:      c,
				location:  cardLocationHand,
				handIndex: i,
				rowIndex:  -1,
				slotIndex: -1,
			}, nil
		}
	}

	for rowIdx := range player.WordBoard.Rows {
		row := &player.WordBoard.Rows[rowIdx]
		for slotIdx := range row.Slots {
			slot := &row.Slots[slotIdx]
			if slot.Card != nil && slot.Card.ID == cardID {
				return locatedCard{
					card:      *slot.Card,
					location:  cardLocationBoard,
					handIndex: -1,
					rowIndex:  rowIdx,
					slotIndex: slotIdx,
				}, nil
			}
		}
	}

	return locatedCard{}, ErrInvalidCard
}

func removeCardFromBoard(player *room.Player, rowIndex, slotIndex int) (room.Card, error) {
	if rowIndex < 0 || rowIndex >= len(player.WordBoard.Rows) {
		return room.Card{}, ErrInvalidSlot
	}
	if slotIndex < 0 || slotIndex >= len(player.WordBoard.Rows[rowIndex].Slots) {
		return room.Card{}, ErrInvalidSlot
	}

	slot := &player.WordBoard.Rows[rowIndex].Slots[slotIndex]
	if slot.Card == nil {
		return room.Card{}, ErrInvalidCard
	}

	removed := *slot.Card
	slot.Card = nil
	player.WordBoard.Rows[rowIndex].IsComplete = false
	player.WordBoard.AllComplete = computeBoardAllComplete(player.WordBoard)

	return removed, nil
}

// DeclareWinnerIfComplete marks the game as finished when playerID has all
// rows complete after a successful turn action.
func DeclareWinnerIfComplete(state *room.GameState, playerID string) (room.Player, bool, error) {
	if state.Phase != room.GamePhasePlaying {
		return room.Player{}, false, fmt.Errorf("game not in playing phase")
	}

	for i := range state.Players {
		if state.Players[i].ID != playerID {
			continue
		}

		if !state.Players[i].WordBoard.AllComplete {
			return room.Player{}, false, nil
		}

		winnerID := state.Players[i].ID
		state.Phase = room.GamePhaseFinished
		state.WinnerID = &winnerID
		state.Turn.Phase = room.TurnPhaseIdle
		state.Turn.TimeRemainingMs = 0
		state.Turn.DrawnCard = nil

		return state.Players[i], true, nil
	}

	return room.Player{}, false, fmt.Errorf("player not found")
}

// computeRowComplete reports whether all slots in the row are filled and the
// resulting word is valid according to dict.
func computeRowComplete(row *room.WordRow, dict dictionary.DictionaryChecker) bool {
	letters := make([]byte, len(row.Slots))
	for i, slot := range row.Slots {
		if slot.Card == nil {
			return false
		}
		if len(slot.Card.Letter) == 0 {
			return false
		}
		letters[i] = slot.Card.Letter[0]
	}
	word := strings.ToLower(string(letters))
	return dict.IsValidWord(word)
}

// computeBoardAllComplete reports whether every row in the board is complete.
func computeBoardAllComplete(board room.WordBoard) bool {
	if len(board.Rows) == 0 {
		return false
	}
	for _, row := range board.Rows {
		if !row.IsComplete {
			return false
		}
	}
	return true
}
