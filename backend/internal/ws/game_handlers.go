// This file handles gameplay WebSocket events and their follow-up broadcasts.
package ws

import (
	"encoding/json"

	"github.com/sras1599/wordit/backend/internal/game"
	"github.com/sras1599/wordit/backend/internal/room"
)

type boardUpdate struct {
	board room.WordBoard
	hand  []cardJSON
}

type placeCardResult struct {
	boardUpdate
	winner room.Player
	won    bool
}

type discardCardResult struct {
	boardUpdate
	discarded    *room.Card
	nextPlayerID string
	reason       string
}

// syncGameConnection marks a player connected and sends their private game state.
func (h *Hub) syncGameConnection(c *client, roomCode, playerID string) {
	_, err := h.store.MarkPlayerConnected(roomCode, playerID)
	if err != nil {
		sendErr(c, "ROOM_NOT_FOUND", err.Error())
		return
	}
	h.reconcileRoomDeadline(roomCode)
	h.startTurnTimer(roomCode)
	state, err := h.store.Get(roomCode)
	if err != nil {
		sendErr(c, "ROOM_NOT_FOUND", err.Error())
		return
	}

	c.sendGame("game:state", buildGameStatePayload(state, playerID), h.gameMeta(state))
	h.broadcastGameToRoom(state, "game:player_reconnected", playerEventPayload{PlayerID: playerID})
}

// handleGamePlayerConnected resyncs an existing game connection.
func (h *Hub) handleGamePlayerConnected(c *client, roomCode, playerID string) {
	state, ok := h.getRoomState(c, roomCode)
	if !ok {
		return
	}

	if state.Phase == room.GamePhaseWaiting {
		sendErr(c, "INVALID_PHASE", "game is not in progress")
		return
	}

	h.syncGameConnection(c, roomCode, playerID)
}

// handleGameDrawCard processes a draw request and broadcasts visibility-safe results.
func (h *Hub) handleGameDrawCard(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	req, ok := decodeDrawCard(c, rawPayload)
	if !ok {
		return
	}

	state, drawnCard, ok := h.drawCard(c, roomCode, playerID, req)
	if ok {
		h.broadcastCardDrawn(&state, playerID, req.Source, drawnCard)
	}
}

// decodeDrawCard decodes the draw-card request payload.
func decodeDrawCard(c *client, rawPayload json.RawMessage) (drawCardRequest, bool) {
	var req drawCardRequest
	return req, decodePayload(c, rawPayload, &req)
}

// drawCard applies the draw action through the room store.
func (h *Hub) drawCard(c *client, roomCode, playerID string, req drawCardRequest) (room.GameState, *room.Card, bool) {
	var drawnCard *room.Card
	state, err := h.updateBeforeDeadline(roomCode, func(state *room.GameState) error {
		return assignDrawnCard(state, playerID, req.Source, &drawnCard)
	})
	if err != nil {
		sendErr(c, gameErrorCode(err), err.Error())
		return state, nil, false
	}
	return state, drawnCard, true
}

// assignDrawnCard captures the card returned by the domain draw operation.
func assignDrawnCard(state *room.GameState, playerID, source string, drawnCard **room.Card) error {
	card, err := game.DrawCard(state, playerID, source)
	*drawnCard = card
	return err
}

// broadcastCardDrawn sends draw results with per-player card visibility.
func (h *Hub) broadcastCardDrawn(state *room.GameState, playerID, source string, drawnCard *room.Card) {
	meta := h.gameMeta(state)
	for pid, cl := range h.roomClients(state) {
		cl.sendGame("game:card_drawn", cardDrawnPayloadFor(state, pid, playerID, source, drawnCard), meta)
	}
}

// handleGamePlaceCard processes a card placement and possible win.
func (h *Hub) handleGamePlaceCard(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	req, ok := decodePlaceCard(c, rawPayload)
	if !ok {
		return
	}
	state, result, ok := h.placeCard(c, roomCode, playerID, req)
	if ok {
		h.afterPlaceCard(roomCode, playerID, &state, result)
	}
}

// decodePlaceCard decodes and validates the place-card request payload.
func decodePlaceCard(c *client, rawPayload json.RawMessage) (placeCardRequest, bool) {
	var req placeCardRequest
	if !decodePayload(c, rawPayload, &req) {
		return req, false
	}
	if req.CardID == "" {
		sendErr(c, "INVALID_PAYLOAD", "invalid place_card payload")
		return req, false
	}
	return req, true
}

// placeCard applies placement and captures the board and win result.
func (h *Hub) placeCard(c *client, roomCode, playerID string, req placeCardRequest) (room.GameState, placeCardResult, bool) {
	var result placeCardResult
	state, err := h.updateBeforeDeadline(roomCode, func(state *room.GameState) error {
		return h.applyPlaceCard(state, playerID, req, &result)
	})
	if err != nil {
		sendErr(c, gameErrorCode(err), err.Error())
		return state, result, false
	}
	return state, result, true
}

// applyPlaceCard mutates game state for a placement and checks for a winner.
func (h *Hub) applyPlaceCard(state *room.GameState, playerID string, req placeCardRequest, result *placeCardResult) error {
	if err := game.PlaceCard(state, playerID, req.CardID, req.RowIndex, req.SlotIndex, h.dict); err != nil {
		return err
	}
	result.boardUpdate = boardUpdateFor(state, playerID)
	return declareWinner(state, playerID, result)
}

// declareWinner records winner data if the active player completed their board.
func declareWinner(state *room.GameState, playerID string, result *placeCardResult) error {
	winner, won, err := game.DeclareWinnerIfComplete(state, playerID)
	result.winner = winner
	result.won = won
	return err
}

// afterPlaceCard broadcasts board updates and announces a win if needed.
func (h *Hub) afterPlaceCard(roomCode, playerID string, state *room.GameState, result placeCardResult) {
	h.broadcastBoardUpdated(state, playerID, result.boardUpdate)
	if result.won {
		h.stopTurnTimer(roomCode)
		h.broadcastPlayerWon(state, result.winner)
	}
}

// broadcastPlayerWon announces the winner and final board.
func (h *Hub) broadcastPlayerWon(state *room.GameState, winner room.Player) {
	h.broadcastGameToRoom(state, "game:player_won", playerWonPayload{
		WinnerID:         winner.ID,
		WinnerName:       winner.Name,
		WinningWordBoard: buildWordBoardJSON(winner.WordBoard),
	})
}

// handleGameUnplaceCard processes moving a board card back into hand.
func (h *Hub) handleGameUnplaceCard(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	req, ok := decodeUnplaceCard(c, rawPayload)
	if !ok {
		return
	}
	state, update, ok := h.unplaceCard(c, roomCode, playerID, req)
	if ok {
		h.broadcastBoardUpdated(&state, playerID, update)
	}
}

// decodeUnplaceCard decodes the unplace-card request payload.
func decodeUnplaceCard(c *client, rawPayload json.RawMessage) (unplaceCardRequest, bool) {
	var req unplaceCardRequest
	return req, decodePayload(c, rawPayload, &req)
}

// unplaceCard applies the unplace action through the room store.
func (h *Hub) unplaceCard(c *client, roomCode, playerID string, req unplaceCardRequest) (room.GameState, boardUpdate, bool) {
	var update boardUpdate
	state, err := h.updateBeforeDeadline(roomCode, func(state *room.GameState) error {
		return applyUnplaceCard(state, playerID, req, &update)
	})
	if err != nil {
		sendErr(c, gameErrorCode(err), err.Error())
		return state, update, false
	}
	return state, update, true
}

// applyUnplaceCard mutates state and captures the updated board view.
func applyUnplaceCard(state *room.GameState, playerID string, req unplaceCardRequest, update *boardUpdate) error {
	if err := game.UnplaceCard(state, playerID, req.RowIndex, req.SlotIndex); err != nil {
		return err
	}
	*update = boardUpdateFor(state, playerID)
	return nil
}

// handleGameClearWord processes moving all cards in a row back into hand.
func (h *Hub) handleGameClearWord(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	req, ok := decodeClearWord(c, rawPayload)
	if !ok {
		return
	}
	state, update, ok := h.clearWord(c, roomCode, playerID, req)
	if ok {
		h.broadcastBoardUpdated(&state, playerID, update)
	}
}

// decodeClearWord decodes the clear-word request payload.
func decodeClearWord(c *client, rawPayload json.RawMessage) (clearWordRequest, bool) {
	var req clearWordRequest
	return req, decodePayload(c, rawPayload, &req)
}

// clearWord applies the clear-row action through the room store.
func (h *Hub) clearWord(c *client, roomCode, playerID string, req clearWordRequest) (room.GameState, boardUpdate, bool) {
	var update boardUpdate
	state, err := h.updateBeforeDeadline(roomCode, func(state *room.GameState) error {
		return applyClearWord(state, playerID, req, &update)
	})
	if err != nil {
		sendErr(c, gameErrorCode(err), err.Error())
		return state, update, false
	}
	return state, update, true
}

// applyClearWord mutates state and captures the updated board view.
func applyClearWord(state *room.GameState, playerID string, req clearWordRequest, update *boardUpdate) error {
	if err := game.ClearWord(state, playerID, req.RowIndex); err != nil {
		return err
	}
	*update = boardUpdateFor(state, playerID)
	return nil
}

// handleGameClearBoard processes moving every board card back into hand.
func (h *Hub) handleGameClearBoard(c *client, roomCode, playerID string) {
	state, update, ok := h.clearBoard(c, roomCode, playerID)
	if ok {
		h.broadcastBoardUpdated(&state, playerID, update)
	}
}

// clearBoard applies the clear-board action through the room store.
func (h *Hub) clearBoard(c *client, roomCode, playerID string) (room.GameState, boardUpdate, bool) {
	var update boardUpdate
	state, err := h.updateBeforeDeadline(roomCode, func(state *room.GameState) error {
		return applyClearBoard(state, playerID, &update)
	})
	if err != nil {
		sendErr(c, gameErrorCode(err), err.Error())
		return state, update, false
	}
	return state, update, true
}

// applyClearBoard mutates state and captures the updated board view.
func applyClearBoard(state *room.GameState, playerID string, update *boardUpdate) error {
	if err := game.ClearBoard(state, playerID); err != nil {
		return err
	}
	*update = boardUpdateFor(state, playerID)
	return nil
}

// handleGameDiscardCard processes discarding a card and ending the turn.
func (h *Hub) handleGameDiscardCard(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	req, ok := decodeDiscardCard(c, rawPayload)
	if !ok {
		return
	}
	state, result, ok := h.discardCard(c, roomCode, playerID, req)
	if ok {
		h.afterDiscardCard(roomCode, playerID, &state, result)
	}
}

// decodeDiscardCard decodes and validates the discard-card request payload.
func decodeDiscardCard(c *client, rawPayload json.RawMessage) (discardCardRequest, bool) {
	var req discardCardRequest
	if !decodePayload(c, rawPayload, &req) {
		return req, false
	}
	if req.CardID == "" {
		sendErr(c, "INVALID_PAYLOAD", "invalid discard_card payload")
		return req, false
	}
	return req, true
}

// discardCard applies discard behavior and captures the next-player result.
func (h *Hub) discardCard(c *client, roomCode, playerID string, req discardCardRequest) (room.GameState, discardCardResult, bool) {
	var result discardCardResult
	state, err := h.updateBeforeDeadline(roomCode, func(state *room.GameState) error {
		return h.applyDiscardCard(state, playerID, req, &result)
	})
	if err != nil {
		sendErr(c, gameErrorCode(err), err.Error())
		return state, result, false
	}
	return state, result, true
}

// applyDiscardCard mutates state for a discard and records its broadcast data.
func (h *Hub) applyDiscardCard(state *room.GameState, playerID string, req discardCardRequest, result *discardCardResult) error {
	discarded, nextPlayerID, err := game.DiscardCard(state, playerID, req.CardID, h.nextTurnDeadlineMs(state))
	if err != nil {
		return err
	}
	result.boardUpdate = boardUpdateFor(state, playerID)
	result.discarded = discarded
	result.nextPlayerID = nextPlayerID
	result.reason = "discarded"
	return nil
}

// afterDiscardCard broadcasts board reconciliation, turn end, and auto-skips.
func (h *Hub) afterDiscardCard(roomCode, playerID string, state *room.GameState, result discardCardResult) {
	h.broadcastBoardUpdated(state, playerID, result.boardUpdate)
	h.broadcastTurnEnded(playerID, state, result)
	h.skipDisconnectedTurns(roomCode)
}

// broadcastTurnEnded announces a completed discard turn.
func (h *Hub) broadcastTurnEnded(playerID string, state *room.GameState, result discardCardResult) {
	h.broadcastGameToRoom(state, "game:turn_ended", turnEndedPayload{
		PlayerID:       playerID,
		Reason:         result.reason,
		DiscardedCard:  buildCardJSON(*result.discarded),
		DiscardPileTop: buildCardJSON(*result.discarded),
		NextPlayerID:   result.nextPlayerID,
	})
}
