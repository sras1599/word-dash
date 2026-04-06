package game

import (
	"errors"
	"fmt"

	"github.com/sras1599/wordit/backend/internal/room"
)

var (
	ErrNotYourTurn  = errors.New("NOT_YOUR_TURN")
	ErrInvalidPhase = errors.New("INVALID_PHASE")
	ErrEmptyDeck    = errors.New("EMPTY_DECK")
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
