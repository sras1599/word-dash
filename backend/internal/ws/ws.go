// This file defines the WebSocket hub entrypoint and core client wrapper.
package ws

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/sras1599/wordit/backend/internal/dictionary"
	"github.com/sras1599/wordit/backend/internal/room"
)

var upgrader = websocket.Upgrader{
	// Origin validation is intentionally permissive for local development.
	// Restrict to known origins in production.
	CheckOrigin: func(_ *http.Request) bool { return true },
}

type client struct {
	conn *websocket.Conn
	wmu  sync.Mutex
}

// send writes a single event envelope to the client connection.
func (c *client) send(event string, payload any) {
	data, err := json.Marshal(outgoingMessage{Event: event, Payload: payload})
	if err != nil {
		return
	}
	c.wmu.Lock()
	defer c.wmu.Unlock()
	_ = c.conn.WriteMessage(websocket.TextMessage, data)
}

type Hub struct {
	store        room.Store
	dict         dictionary.DictionaryChecker
	mu           sync.RWMutex
	conns        map[string]*client
	activeTimers map[string]chan struct{}
}

// NewHub creates a WebSocket hub backed by the provided room store.
func NewHub(store room.Store) *Hub {
	return &Hub{
		store:        store,
		dict:         dictionary.NopChecker{},
		conns:        make(map[string]*client),
		activeTimers: make(map[string]chan struct{}),
	}
}

// ServeWS validates the request, upgrades the socket, and starts the read loop.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	req, ok := h.validateWSRequest(w, r)
	if !ok {
		return
	}

	c, ok := h.upgradeClient(w, r, req)
	if !ok {
		return
	}

	h.replaceClient(req.playerID, c)
	h.logClientConnected(req)
	h.handleClientConnected(c, req.roomCode, req.playerID)

	defer h.closeClient(c, req)
	h.readLoop(c, req.roomCode, req.playerID)
}
