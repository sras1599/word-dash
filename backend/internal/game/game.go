package game

import (
	"errors"
	"fmt"
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

	return &drawnCard, nil
}

// PlaceCard moves a card from the player's hand onto the specified slot on
// their word board. If the target slot already holds a card, that card is
// swapped back into the hand in place of the placed card.
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

	// Locate the card in the player's hand.
	cardIdx := -1
	for i, c := range player.Hand {
		if c.ID == cardID {
			cardIdx = i
			break
		}
	}
	if cardIdx == -1 {
		return ErrInvalidCard
	}

	card := player.Hand[cardIdx]
	slot := &player.WordBoard.Rows[rowIndex].Slots[slotIndex]

	if slot.Card != nil {
		// Swap: put the existing slot card back in the hand at the same index.
		player.Hand[cardIdx] = *slot.Card
	} else {
		// No card in slot: remove the card from the hand.
		player.Hand = append(player.Hand[:cardIdx], player.Hand[cardIdx+1:]...)
	}

	// Place the card in the slot.
	placed := card
	slot.Card = &placed

	// Recompute completeness flags.
	row := &player.WordBoard.Rows[rowIndex]
	row.IsComplete = computeRowComplete(row, dict)
	player.WordBoard.AllComplete = computeBoardAllComplete(player.WordBoard)

	return nil
}

// DiscardCard removes a card from the active player's hand, pushes it to the
// discard pile, and advances the turn to the next player.
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

	hand := state.Players[playerIdx].Hand
	cardIdx := -1
	var discarded room.Card
	for i, c := range hand {
		if c.ID == cardID {
			cardIdx = i
			discarded = c
			break
		}
	}
	if cardIdx == -1 {
		return nil, "", ErrInvalidCard
	}

	state.Players[playerIdx].Hand = append(hand[:cardIdx], hand[cardIdx+1:]...)
	state.DiscardPile = append(state.DiscardPile, discarded)
	state.DiscardPileTop = &room.Card{ID: discarded.ID, Letter: discarded.Letter}

	nextIdx := (playerIdx + 1) % len(state.Players)
	nextPlayerID := state.Players[nextIdx].ID
	state.Turn.CurrentPlayerID = nextPlayerID
	state.Turn.Phase = room.TurnPhaseDraw
	state.Turn.TimeRemainingMs = state.TurnDurationMs
	state.Turn.DrawnCard = nil

	return &discarded, nextPlayerID, nil
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
