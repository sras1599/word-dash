// This file handles WebSocket request validation and client registration.
package ws

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/sras1599/wordit/backend/internal/room"
)

type wsRequest struct {
	roomCode   string
	playerID   string
	playerName string
}

// validateWSRequest checks query params, room existence, and player membership.
func (h *Hub) validateWSRequest(w http.ResponseWriter, r *http.Request) (wsRequest, bool) {
	req := wsRequest{roomCode: r.URL.Query().Get("roomCode"), playerID: r.URL.Query().Get("playerId")}
	if req.roomCode == "" || req.playerID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing required query params: roomCode and playerId"})
		return req, false
	}

	state, ok := h.loadWSRoom(w, req.roomCode)
	if !ok {
		return req, false
	}

	return h.validateWSPlayer(w, req, state)
}

// loadWSRoom loads a room or writes the matching HTTP error before upgrade.
func (h *Hub) loadWSRoom(w http.ResponseWriter, roomCode string) (*room.GameState, bool) {
	state, err := h.store.Get(roomCode)
	if err == nil {
		return state, true
	}
	if errors.Is(err, room.ErrRoomNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "room not found"})
		return nil, false
	}
	slog.Error("ws: failed to load room", "roomCode", roomCode, "error", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load room"})
	return nil, false
}

// validateWSPlayer confirms the connecting player belongs to the room.
func (h *Hub) validateWSPlayer(w http.ResponseWriter, req wsRequest, state *room.GameState) (wsRequest, bool) {
	player, err := state.GetPlayer(req.playerID)
	if err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "player not in room"})
		return req, false
	}
	req.playerName = player.Name
	return req, true
}

// upgradeClient upgrades an accepted HTTP request into a tracked WebSocket client.
func (h *Hub) upgradeClient(w http.ResponseWriter, r *http.Request, req wsRequest) (*client, bool) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws: upgrade error", "player", formatPlayer(req.playerID, req.playerName), "error", err)
		return nil, false
	}
	return &client{conn: conn}, true
}

// replaceClient stores the active client and closes any previous connection.
func (h *Hub) replaceClient(playerID string, c *client) {
	h.mu.Lock()
	previousClient := h.conns[playerID]
	h.conns[playerID] = c
	h.mu.Unlock()
	closePreviousClient(previousClient, c)
}

// closePreviousClient closes a superseded connection after replacement.
func closePreviousClient(previousClient, c *client) {
	if previousClient != nil && previousClient != c {
		_ = previousClient.conn.Close()
	}
}

// closeClient unregisters and closes a client when its read loop exits.
func (h *Hub) closeClient(c *client, req wsRequest) {
	if h.unregisterClient(req.playerID, c) {
		h.logClientDisconnected(req)
		h.handleClientDisconnected(req.roomCode, req.playerID)
	}
	_ = c.conn.Close()
}

// unregisterClient removes the client only if it is still the active connection.
func (h *Hub) unregisterClient(playerID string, c *client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if current, ok := h.conns[playerID]; ok && current == c {
		delete(h.conns, playerID)
		return true
	}
	return false
}

// logClientConnected records a successful WebSocket connection.
func (h *Hub) logClientConnected(req wsRequest) {
	slog.Info("ws: client connected", "roomCode", req.roomCode, "player", formatPlayer(req.playerID, req.playerName))
}

// logClientDisconnected records a WebSocket disconnection.
func (h *Hub) logClientDisconnected(req wsRequest) {
	slog.Info("ws: client disconnected", "roomCode", req.roomCode, "player", formatPlayer(req.playerID, req.playerName))
}

// formatPlayer returns the shared player label used in logs.
func formatPlayer(playerID, playerName string) string {
	return fmt.Sprintf("%s (%s)", playerID, playerName)
}
