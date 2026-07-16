// This file contains shared WebSocket error, payload, and response helpers.
package ws

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/sras1599/wordit/backend/internal/game"
	"github.com/sras1599/wordit/backend/internal/room"
)

type errorCodeMapping struct {
	err  error
	code string
}

var gameErrorCodes = []errorCodeMapping{
	{room.ErrRoomNotFound, "ROOM_NOT_FOUND"},
	{game.ErrNotYourTurn, "NOT_YOUR_TURN"},
	{game.ErrInvalidPhase, "INVALID_PHASE"},
	{game.ErrEmptyDeck, "EMPTY_DECK"},
	{game.ErrInvalidCard, "INVALID_CARD"},
	{game.ErrInvalidSlot, "INVALID_SLOT"},
	{game.ErrTurnExpired, "TURN_EXPIRED"},
}

var roomErrorCodes = []errorCodeMapping{
	{room.ErrNotHost, "FORBIDDEN"},
	{room.ErrGameAlreadyStarted, "INVALID_PHASE"},
	{room.ErrRoomNotFound, "ROOM_NOT_FOUND"},
	{room.ErrNotAllReady, "NOT_ALL_READY"},
}

// sendErr sends a standardised game:error message to the client.
func sendErr(c *client, code, message string) {
	c.send("game:error", map[string]string{
		"code":    code,
		"message": message,
	})
}

// decodePayload unmarshals raw JSON into v. On failure it sends an
// INVALID_PAYLOAD game:error to c and returns false.
func decodePayload(c *client, raw json.RawMessage, v any) bool {
	if err := json.Unmarshal(raw, v); err != nil {
		sendErr(c, "INVALID_PAYLOAD", "invalid payload")
		return false
	}
	return true
}

// getRoomState looks up the room by code. If the room is not found it sends a
// ROOM_NOT_FOUND game:error to c and returns nil, false.
func (h *Hub) getRoomState(c *client, roomCode string) (*room.GameState, bool) {
	state, err := h.store.Get(roomCode)
	if err != nil {
		if errors.Is(err, room.ErrRoomNotFound) {
			sendErr(c, "ROOM_NOT_FOUND", "room not found")
			return nil, false
		}
		slog.Error("ws: failed to load room", "roomCode", roomCode, "error", err)
		sendErr(c, "INTERNAL_ERROR", "failed to load room")
		return nil, false
	}
	return state, true
}

// updateBeforeDeadline rejects late gameplay actions and immediately reconciles expiry.
func (h *Hub) updateBeforeDeadline(roomCode string, mutateFn func(*room.GameState) error) (room.GameState, error) {
	state, err := h.store.UpdateGameState(roomCode, func(state *room.GameState) error {
		if state.Phase == room.GamePhasePlaying && state.Turn.EndsAtUnixMs > 0 && h.now().UnixMilli() >= state.Turn.EndsAtUnixMs {
			return game.ErrTurnExpired
		}
		return mutateFn(state)
	})
	if errors.Is(err, game.ErrTurnExpired) {
		h.handleTurnTimeout(roomCode)
	}
	return state, err
}

// gameErrorCode maps game-package sentinel errors to WS error codes.
func gameErrorCode(err error) string {
	return mappedErrorCode(err, gameErrorCodes, "INTERNAL_ERROR")
}

// roomErrorCode maps room-package sentinel errors to WS error codes.
func roomErrorCode(err error) string {
	return mappedErrorCode(err, roomErrorCodes, "INTERNAL_ERROR")
}

// mappedErrorCode resolves a sentinel error to a protocol error code.
func mappedErrorCode(err error, mappings []errorCodeMapping, fallback string) string {
	for _, mapping := range mappings {
		if errors.Is(err, mapping.err) {
			return mapping.code
		}
	}
	return fallback
}

// buildGameStatePayload builds a personalized full game-state snapshot.
func buildGameStatePayload(state *room.GameState, forPlayerID string) gameStatePayload {
	return gameStatePayload{
		RoomCode:       state.RoomCode,
		Variation:      variationJSON{WordLengths: state.Variation.WordLengths},
		Players:        buildGamePlayersJSON(state, forPlayerID),
		DrawPileCount:  state.DrawPileCount,
		DiscardPileTop: buildOptionalCardJSON(state.DiscardPileTop),
		Turn:           buildTurnJSON(state, forPlayerID),
		Phase:          string(state.Phase),
	}
}

// buildGamePlayersJSON builds player snapshots, including one private hand.
func buildGamePlayersJSON(state *room.GameState, forPlayerID string) []gamePlayerJSON {
	players := make([]gamePlayerJSON, len(state.Players))
	for i, p := range state.Players {
		players[i] = buildGamePlayerJSON(p, p.ID == forPlayerID)
	}
	return players
}

// buildGamePlayerJSON converts a room player into game-state JSON.
func buildGamePlayerJSON(p room.Player, includeHand bool) gamePlayerJSON {
	return gamePlayerJSON{
		ID:          p.ID,
		Name:        p.Name,
		HandCount:   len(p.Hand),
		Hand:        maybeHandJSON(p.Hand, includeHand),
		WordBoard:   buildWordBoardJSON(p.WordBoard),
		IsReady:     p.IsReady,
		IsConnected: p.IsConnected,
	}
}

// maybeHandJSON includes hand cards only when the recipient may see them.
func maybeHandJSON(hand []room.Card, includeHand bool) []cardJSON {
	if includeHand {
		return buildHandJSON(hand)
	}
	return nil
}

// buildTurnJSON converts turn state into the wire payload shape.
func buildTurnJSON(state *room.GameState, forPlayerID string) turnJSON {
	return turnJSON{
		CurrentPlayerID: state.Turn.CurrentPlayerID,
		Phase:           string(state.Turn.Phase),
		DrawnCard:       visibleTurnDrawnCard(state, forPlayerID),
	}
}

// visibleTurnDrawnCard returns the drawn card only to the active player.
func visibleTurnDrawnCard(state *room.GameState, forPlayerID string) *cardJSON {
	if state.Turn.CurrentPlayerID != forPlayerID {
		return nil
	}

	return buildOptionalCardJSON(state.Turn.DrawnCard)
}

// buildHandJSON converts a hand of room cards into JSON cards.
func buildHandJSON(hand []room.Card) []cardJSON {
	out := make([]cardJSON, len(hand))
	for i, card := range hand {
		out[i] = buildCardJSON(card)
	}
	return out
}

// buildWordBoardJSON converts a domain word board into wire JSON.
func buildWordBoardJSON(wb room.WordBoard) wordBoardJSON {
	rows := make([]wordRowJSON, len(wb.Rows))
	for i, row := range wb.Rows {
		rows[i] = buildWordRowJSON(row)
	}
	return wordBoardJSON{Rows: rows, AllComplete: wb.AllComplete}
}

// buildWordRowJSON converts one domain word row into wire JSON.
func buildWordRowJSON(row room.WordRow) wordRowJSON {
	return wordRowJSON{
		TargetLength: row.TargetLength,
		Slots:        buildWordSlotsJSON(row.Slots),
		IsComplete:   row.IsComplete,
	}
}

// buildWordSlotsJSON converts domain slots into wire JSON slots.
func buildWordSlotsJSON(slots []room.WordSlot) []wordSlotJSON {
	out := make([]wordSlotJSON, len(slots))
	for i, slot := range slots {
		out[i] = wordSlotJSON{SlotIndex: slot.SlotIndex, Card: buildOptionalCardJSON(slot.Card)}
	}

	return out
}

// buildOptionalCardJSON converts a nullable domain card into wire JSON.
func buildOptionalCardJSON(card *room.Card) *cardJSON {
	if card == nil {
		return nil
	}

	out := buildCardJSON(*card)
	return &out
}

// buildCardJSON converts a domain card into wire JSON.
func buildCardJSON(card room.Card) cardJSON {
	return cardJSON{ID: card.ID, Letter: card.Letter}
}

// buildLobbyStatePayload builds the full lobby-state sync payload.
func buildLobbyStatePayload(state *room.GameState) lobbyStatePayload {
	return lobbyStatePayload{
		RoomCode:       state.RoomCode,
		HostPlayerID:   state.Players[0].ID,
		Variation:      variationJSON{WordLengths: state.Variation.WordLengths},
		TurnDurationMs: state.TurnDurationMs,
		Players:        buildLobbyPlayersJSON(state.Players),
	}
}

// buildLobbyPlayersJSON converts lobby players into wire JSON.
func buildLobbyPlayersJSON(players []room.Player) []lobbyPlayerJSON {
	out := make([]lobbyPlayerJSON, len(players))
	for i, p := range players {
		out[i] = buildLobbyPlayerJSON(p)
	}
	return out
}

// buildLobbyPlayerJSON converts one lobby player into wire JSON.
func buildLobbyPlayerJSON(p room.Player) lobbyPlayerJSON {
	return lobbyPlayerJSON{
		ID:          p.ID,
		Name:        p.Name,
		IsReady:     p.IsReady,
		IsConnected: p.IsConnected,
	}
}

// lobbyPlayerJoined builds a join broadcast payload for one player.
func lobbyPlayerJoined(state *room.GameState, playerID string) (lobbyPlayerJoinedPayload, bool) {
	player, err := state.GetPlayer(playerID)
	if err != nil {
		return lobbyPlayerJoinedPayload{}, false
	}
	return lobbyPlayerJoinedPayload{Player: buildLobbyPlayerJSON(*player)}, true
}

// boardUpdateFor captures the acting player's board and private hand.
func boardUpdateFor(state *room.GameState, playerID string) boardUpdate {
	for _, p := range state.Players {
		if p.ID == playerID {
			return boardUpdate{board: p.WordBoard, hand: buildHandJSON(p.Hand)}
		}
	}
	return boardUpdate{}
}

// boardPayloadFor builds a board update with hand data only for the actor.
func boardPayloadFor(pid, playerID string, update boardUpdate) boardUpdatedPayload {
	payload := boardUpdatedPayload{
		PlayerID:  playerID,
		WordBoard: buildWordBoardJSON(update.board),
		HandCount: len(update.hand),
	}
	if pid == playerID {
		payload.Hand = update.hand
	}
	return payload
}

// cardDrawnPayloadFor builds a draw payload with per-recipient card visibility.
func cardDrawnPayloadFor(state *room.GameState, pid, playerID, source string, drawnCard *room.Card) cardDrawnPayload {
	return cardDrawnPayload{
		PlayerID:       playerID,
		Source:         source,
		Card:           visibleDrawnCard(pid, playerID, source, drawnCard),
		DrawPileCount:  state.DrawPileCount,
		DiscardPileTop: buildOptionalCardJSON(state.DiscardPileTop),
	}
}

// visibleDrawnCard returns the card only for recipients allowed to see it.
func visibleDrawnCard(pid, playerID, source string, drawnCard *room.Card) *cardJSON {
	if pid == playerID || source == "discard" {
		return buildOptionalCardJSON(drawnCard)
	}
	return nil
}

// playerName looks up a player's display name for logs.
func playerName(state *room.GameState, playerID string) string {
	if state == nil {
		return ""
	}
	player, err := state.GetPlayer(playerID)
	if err != nil {
		return ""
	}
	return player.Name
}

// writeJSON writes an HTTP JSON response before WebSocket upgrade.
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
