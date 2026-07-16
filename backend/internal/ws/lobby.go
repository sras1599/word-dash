// This file handles lobby-phase WebSocket events.
package ws

import (
	"encoding/json"
	"log/slog"
	"time"

	"github.com/sras1599/wordit/backend/internal/deck"
	"github.com/sras1599/wordit/backend/internal/room"
)

const (
	minTurnDurationMs = 60_000
	maxTurnDurationMs = 300_000
)

// handleLobbyJoin syncs lobby state and announces first-time connections.
func (h *Hub) handleLobbyJoin(c *client, roomCode, playerID string) {
	alreadyConnected := h.store.IsPlayerConnected(roomCode, playerID)

	state, err := h.store.MarkPlayerConnected(roomCode, playerID)
	if err != nil {
		sendErr(c, "ROOM_NOT_FOUND", err.Error())
		return
	}

	c.send("lobby:state", buildLobbyStatePayload(&state))
	if !alreadyConnected {
		h.broadcastLobbyPlayerJoined(&state, playerID)
	}
}

// broadcastLobbyPlayerJoined notifies other clients about a new lobby player.
func (h *Hub) broadcastLobbyPlayerJoined(state *room.GameState, playerID string) {
	payload, ok := lobbyPlayerJoined(state, playerID)
	if !ok {
		return
	}
	for _, other := range h.roomClientsExcept(state, playerID) {
		other.send("lobby:player_joined", payload)
	}
}

// handleLobbySettingsChanged validates and applies host lobby settings changes.
func (h *Hub) handleLobbySettingsChanged(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	req, ok := decodeLobbySettings(c, rawPayload)
	if !ok {
		return
	}
	variation := room.Variation{WordLengths: req.Variation.WordLengths}
	state, err := h.store.UpdateLobbySettings(roomCode, playerID, variation, req.TurnDurationMs)
	if err != nil {
		sendErr(c, roomErrorCode(err), err.Error())
		return
	}
	h.broadcastLobbySettingsChanged(roomCode, state)
}

// decodeLobbySettings decodes and validates the settings-change request payload.
func decodeLobbySettings(c *client, rawPayload json.RawMessage) (lobbySettingsChangedRequest, bool) {
	var req lobbySettingsChangedRequest
	if !decodePayload(c, rawPayload, &req) {
		return req, false
	}
	return req, validateLobbySettings(c, req)
}

// validateLobbySettings enforces server-side bounds for lobby settings.
func validateLobbySettings(c *client, req lobbySettingsChangedRequest) bool {
	if req.TurnDurationMs < minTurnDurationMs || req.TurnDurationMs > maxTurnDurationMs {
		sendErr(c, "INVALID_PAYLOAD", "turnDurationMs must be between 60000 and 300000")
		return false
	}
	if len(req.Variation.WordLengths) == 0 {
		sendErr(c, "INVALID_PAYLOAD", "variation must have at least one word length")
		return false
	}
	return true
}

// broadcastLobbySettingsChanged sends updated settings to the whole lobby.
func (h *Hub) broadcastLobbySettingsChanged(roomCode string, state room.GameState) {
	h.broadcastToRoom(roomCode, "lobby:settings_changed", lobbySettingsChangedPayload{
		Variation:      variationJSON{WordLengths: state.Variation.WordLengths},
		TurnDurationMs: state.TurnDurationMs,
	})
}

// handleLobbyPlayerReady marks a player ready and broadcasts the change.
func (h *Hub) handleLobbyPlayerReady(c *client, roomCode, playerID string) {
	if _, err := h.store.MarkPlayerReady(roomCode, playerID); err != nil {
		sendErr(c, "ROOM_NOT_FOUND", err.Error())
		return
	}
	h.broadcastToRoom(roomCode, "lobby:player_ready", lobbyPlayerReadyPayload{PlayerID: playerID})
}

// handleLobbyPlayerUnready marks a player unready and broadcasts the change.
func (h *Hub) handleLobbyPlayerUnready(c *client, roomCode, playerID string) {
	if _, err := h.store.MarkPlayerUnready(roomCode, playerID); err != nil {
		sendErr(c, "ROOM_NOT_FOUND", err.Error())
		return
	}
	h.broadcastToRoom(roomCode, "lobby:player_unready", lobbyPlayerUnreadyPayload{PlayerID: playerID})
}

// handleLobbyStartGame creates a deck, starts the game, and announces navigation.
func (h *Hub) handleLobbyStartGame(c *client, roomCode, playerID string) {
	drawPile, err := deck.New()
	if err != nil {
		sendErr(c, "INTERNAL_ERROR", "failed to create deck")
		return
	}
	state, ok := h.startGame(c, roomCode, playerID, drawPile)
	if ok {
		h.announceGameStarting(roomCode, playerID, state)
	}
}

// startGame transitions the room into play and starts its turn timer.
func (h *Hub) startGame(c *client, roomCode, playerID string, drawPile []room.Card) (room.GameState, bool) {
	endsAt := h.now().Add(time.Duration(h.turnDuration(roomCode)) * time.Millisecond).UnixMilli()
	state, err := h.store.StartGame(roomCode, playerID, drawPile, endsAt)
	if err != nil {
		sendErr(c, roomErrorCode(err), err.Error())
		return state, false
	}
	h.startTurnTimer(roomCode)
	return state, true
}

func (h *Hub) turnDuration(roomCode string) int {
	state, err := h.store.Get(roomCode)
	if err != nil {
		return 0
	}
	return state.TurnDurationMs
}

// announceGameStarting logs and broadcasts the lobby-to-game transition.
func (h *Hub) announceGameStarting(roomCode, playerID string, state room.GameState) {
	slog.Info("ws: game starting", "roomCode", roomCode, "player", formatPlayer(playerID, playerName(&state, playerID)))
	h.broadcastToRoom(roomCode, "lobby:game_starting", map[string]string{"roomCode": roomCode})
}
