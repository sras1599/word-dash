// This file routes incoming WebSocket event envelopes to handler functions.
package ws

import "encoding/json"

type eventHandler func(*Hub, *client, string, string, json.RawMessage)

var eventHandlers = map[string]eventHandler{
	"lobby:join":             routeLobbyJoin,
	"lobby:player_ready":     routeLobbyPlayerReady,
	"lobby:player_unready":   routeLobbyPlayerUnready,
	"lobby:settings_changed": routeLobbySettingsChanged,
	"lobby:start_game":       routeLobbyStartGame,
	"game:player_connected":  routeGamePlayerConnected,
	"game:draw_card":         routeGameDrawCard,
	"game:place_card":        routeGamePlaceCard,
	"game:unplace_card":      routeGameUnplaceCard,
	"game:discard_card":      routeGameDiscardCard,
}

// readLoop consumes incoming messages until the socket closes.
func (h *Hub) readLoop(c *client, roomCode, playerID string) {
	for {
		msg, status := c.readIncoming()

		if status == readClosed {
			return
		}

		if status == readOK {
			h.dispatchMessage(c, roomCode, playerID, msg)
		}
	}
}

type readStatus int

const (
	readOK readStatus = iota
	readIgnored
	readClosed
)

// readIncoming reads and decodes one event envelope from the socket.
func (c *client) readIncoming() (incomingMessage, readStatus) {
	var msg incomingMessage
	_, raw, err := c.conn.ReadMessage()

	if err != nil {
		return msg, readClosed
	}

	if err := json.Unmarshal(raw, &msg); err != nil {
		return msg, readIgnored
	}

	return msg, readOK
}

// dispatchMessage invokes the registered handler for a known event.
func (h *Hub) dispatchMessage(c *client, roomCode, playerID string, msg incomingMessage) {
	if handler, ok := eventHandlers[msg.Event]; ok {
		handler(h, c, roomCode, playerID, msg.Payload)
	}
}

// routeLobbyJoin adapts the lobby join event to the shared handler signature.
func routeLobbyJoin(h *Hub, c *client, roomCode, playerID string, _ json.RawMessage) {
	h.handleLobbyJoin(c, roomCode, playerID)
}

// routeLobbyPlayerReady adapts the ready event to the shared handler signature.
func routeLobbyPlayerReady(h *Hub, c *client, roomCode, playerID string, _ json.RawMessage) {
	h.handleLobbyPlayerReady(c, roomCode, playerID)
}

// routeLobbyPlayerUnready adapts the unready event to the shared handler signature.
func routeLobbyPlayerUnready(h *Hub, c *client, roomCode, playerID string, _ json.RawMessage) {
	h.handleLobbyPlayerUnready(c, roomCode, playerID)
}

// routeLobbySettingsChanged forwards lobby settings payloads to the handler.
func routeLobbySettingsChanged(h *Hub, c *client, roomCode, playerID string, raw json.RawMessage) {
	h.handleLobbySettingsChanged(c, roomCode, playerID, raw)
}

// routeLobbyStartGame adapts the start-game event to the shared handler signature.
func routeLobbyStartGame(h *Hub, c *client, roomCode, playerID string, _ json.RawMessage) {
	h.handleLobbyStartGame(c, roomCode, playerID)
}

// routeGamePlayerConnected adapts the game reconnect event to the handler.
func routeGamePlayerConnected(h *Hub, c *client, roomCode, playerID string, _ json.RawMessage) {
	h.handleGamePlayerConnected(c, roomCode, playerID)
}

// routeGameDrawCard forwards draw-card payloads to the handler.
func routeGameDrawCard(h *Hub, c *client, roomCode, playerID string, raw json.RawMessage) {
	h.handleGameDrawCard(c, roomCode, playerID, raw)
}

// routeGamePlaceCard forwards place-card payloads to the handler.
func routeGamePlaceCard(h *Hub, c *client, roomCode, playerID string, raw json.RawMessage) {
	h.handleGamePlaceCard(c, roomCode, playerID, raw)
}

// routeGameUnplaceCard forwards unplace-card payloads to the handler.
func routeGameUnplaceCard(h *Hub, c *client, roomCode, playerID string, raw json.RawMessage) {
	h.handleGameUnplaceCard(c, roomCode, playerID, raw)
}

// routeGameDiscardCard forwards discard-card payloads to the handler.
func routeGameDiscardCard(h *Hub, c *client, roomCode, playerID string, raw json.RawMessage) {
	h.handleGameDiscardCard(c, roomCode, playerID, raw)
}
