// This file centralizes room client snapshots and outbound broadcasts.
package ws

import (
	"log/slog"

	"github.com/sras1599/wordit/backend/internal/room"
)

// broadcastToRoom sends an event to every currently connected player in a room.
func (h *Hub) broadcastToRoom(roomCode, event string, payload any) {
	state, err := h.store.Get(roomCode)
	if err != nil {
		return
	}
	slog.Debug("ws: broadcasting event", "event", event, "roomCode", roomCode)
	for _, cl := range h.roomClients(state) {
		cl.send(event, payload)
	}
}

// roomClients snapshots connected clients for the players in state.
func (h *Hub) roomClients(state *room.GameState) map[string]*client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients := make(map[string]*client, len(state.Players))
	for _, p := range state.Players {
		if cl, ok := h.conns[p.ID]; ok {
			clients[p.ID] = cl
		}
	}
	return clients
}

// roomClientsExcept returns connected room clients except one player.
func (h *Hub) roomClientsExcept(state *room.GameState, excludedPlayerID string) []*client {
	clientsByID := h.roomClients(state)
	clients := make([]*client, 0, len(clientsByID))
	for _, p := range state.Players {
		if p.ID != excludedPlayerID {
			appendClient(&clients, clientsByID[p.ID])
		}
	}
	return clients
}

// appendClient appends a non-nil client to a target slice.
func appendClient(clients *[]*client, cl *client) {
	if cl != nil {
		*clients = append(*clients, cl)
	}
}

// broadcastBoardUpdated sends a board update with private hand data scoped per player.
func (h *Hub) broadcastBoardUpdated(state *room.GameState, playerID string, update boardUpdate) {
	for pid, cl := range h.roomClients(state) {
		cl.send("game:board_updated", boardPayloadFor(pid, playerID, update))
	}
}

// syncGameStateToRoom sends personalized full game-state snapshots to a room.
func (h *Hub) syncGameStateToRoom(state *room.GameState) {
	for playerID, cl := range h.roomClients(state) {
		cl.send("game:state", buildGameStatePayload(state, playerID))
	}
}
