// This file handles connect and disconnect behavior across lobby and game phases.
package ws

import (
	"log/slog"

	"github.com/sras1599/wordit/backend/internal/room"
)

// handleClientConnected sends the appropriate lobby or game sync on connect.
func (h *Hub) handleClientConnected(c *client, roomCode, playerID string) {
	state, err := h.store.Get(roomCode)
	if err != nil {
		return
	}

	if state.Phase == room.GamePhaseWaiting {
		h.handleLobbyJoin(c, roomCode, playerID)
		return
	}

	h.syncGameConnection(c, roomCode, playerID)
}

// handleClientDisconnected applies phase-specific disconnect behavior.
func (h *Hub) handleClientDisconnected(roomCode, playerID string) {
	state, err := h.store.Get(roomCode)
	if err != nil {
		return
	}

	switch state.Phase {
	case room.GamePhaseWaiting:
		h.disconnectLobbyPlayer(roomCode, playerID, state)
	case room.GamePhasePlaying, room.GamePhaseFinished:
		h.disconnectGamePlayer(roomCode, playerID, state)
	}
}

// disconnectLobbyPlayer removes a waiting-room player and announces host changes.
func (h *Hub) disconnectLobbyPlayer(roomCode, playerID string, state *room.GameState) {
	nextState, roomDeleted, err := h.store.RemovePlayer(roomCode, playerID)
	if err != nil {
		logDisconnectError("failed to remove lobby player", roomCode, playerID, playerName(state, playerID), err)
		return
	}

	if !roomDeleted {
		h.broadcastLobbyDisconnect(roomCode, playerID, nextState)
	}
}

// disconnectGamePlayer marks an in-game player disconnected without removing them.
func (h *Hub) disconnectGamePlayer(roomCode, playerID string, state *room.GameState) {
	nextState, err := h.store.MarkPlayerDisconnected(roomCode, playerID)
	if err != nil {
		logDisconnectError("failed to mark player disconnected", roomCode, playerID, playerName(state, playerID), err)
		return
	}

	h.broadcastGameToRoom(&nextState, "game:player_disconnected", playerEventPayload{PlayerID: playerID})
}

// broadcastLobbyDisconnect announces a lobby departure to remaining clients.
func (h *Hub) broadcastLobbyDisconnect(roomCode, playerID string, state room.GameState) {
	h.broadcastToRoom(roomCode, "lobby:player_disconnected", lobbyPlayerDisconnectedPayload{
		PlayerID:     playerID,
		HostPlayerID: state.Players[0].ID,
	})
}

// logDisconnectError records a disconnect mutation failure with player context.
func logDisconnectError(message, roomCode, playerID, name string, err error) {
	slog.Error("ws: "+message, "player", formatPlayer(playerID, name), "roomCode", roomCode, "error", err)
}
