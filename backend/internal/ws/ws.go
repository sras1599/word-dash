package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/sras1599/wordit/backend/internal/room"
)

var upgrader = websocket.Upgrader{
	// Origin validation is intentionally permissive for local development.
	// Restrict to known origins in production.
	CheckOrigin: func(_ *http.Request) bool { return true },
}

// client wraps a WebSocket connection with a write mutex so that multiple
// goroutines can safely broadcast to the same connection.
type client struct {
	conn *websocket.Conn
	wmu  sync.Mutex
}

func (c *client) send(event string, payload any) {
	data, err := json.Marshal(struct {
		Event   string `json:"event"`
		Payload any    `json:"payload"`
	}{event, payload})
	if err != nil {
		return
	}
	c.wmu.Lock()
	defer c.wmu.Unlock()
	_ = c.conn.WriteMessage(websocket.TextMessage, data)
}

// Hub manages all active WebSocket connections and routes lobby events.
type Hub struct {
	store *room.Store
	mu    sync.RWMutex
	conns map[string]*client // playerID -> client
}

func NewHub(store *room.Store) *Hub {
	return &Hub{
		store: store,
		conns: make(map[string]*client),
	}
}

// incomingMessage is the wire format for all client→server messages.
type incomingMessage struct {
	Event   string          `json:"event"`
	Payload json.RawMessage `json:"payload"`
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	roomCode := r.URL.Query().Get("roomCode")
	playerID := r.URL.Query().Get("playerId")
	if roomCode == "" || playerID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "missing required query params: roomCode and playerId",
		})
		return
	}

	// Validate the room and player exist before upgrading.
	state, ok := h.store.Get(roomCode)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "room not found"})
		return
	}
	if !roomHasPlayer(state, playerID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "player not in room"})
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws: upgrade error for player %s: %v", playerID, err)
		return
	}

	c := &client{conn: conn}

	h.mu.Lock()
	h.conns[playerID] = c
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.conns, playerID)
		h.mu.Unlock()
		conn.Close()
	}()

	h.readLoop(c, roomCode, playerID)
}

func (h *Hub) readLoop(c *client, roomCode, playerID string) {
	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var msg incomingMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}
		switch msg.Event {
		case "lobby:join":
			h.handleLobbyJoin(c, roomCode, playerID)
		}
	}
}

// --- lobby:join ---

type variationJSON struct {
	WordLengths []int `json:"wordLengths"`
}

type lobbyPlayerJSON struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	IsReady     bool   `json:"isReady"`
	IsConnected bool   `json:"isConnected"`
}

type lobbyStatePayload struct {
	RoomCode     string            `json:"roomCode"`
	HostPlayerID string            `json:"hostPlayerId"`
	Variation    variationJSON     `json:"variation"`
	Players      []lobbyPlayerJSON `json:"players"`
}

type lobbyPlayerJoinedPayload struct {
	Player lobbyPlayerJSON `json:"player"`
}

func (h *Hub) handleLobbyJoin(c *client, roomCode, playerID string) {
	alreadyConnected := h.store.IsPlayerConnected(roomCode, playerID)

	state, err := h.store.MarkPlayerConnected(roomCode, playerID)
	if err != nil {
		c.send("game:error", map[string]string{
			"code":    "ROOM_NOT_FOUND",
			"message": err.Error(),
		})
		return
	}

	// Build lobby:state payload — host is always Players[0].
	players := make([]lobbyPlayerJSON, len(state.Players))
	for i, p := range state.Players {
		players[i] = lobbyPlayerJSON{
			ID:          p.ID,
			Name:        p.Name,
			IsReady:     p.IsReady,
			IsConnected: p.IsConnected,
		}
	}
	c.send("lobby:state", lobbyStatePayload{
		RoomCode:     state.RoomCode,
		HostPlayerID: state.Players[0].ID,
		Variation:    variationJSON{WordLengths: state.Variation.WordLengths},
		Players:      players,
	})

	// Reconnecting players have already re-synced via lobby:state above; skip
	// broadcasting to others to avoid duplicate rows in their lobby UI.
	if alreadyConnected {
		return
	}

	// Find the joining player to build the broadcast payload.
	var joiningPlayer room.Player
	for _, p := range state.Players {
		if p.ID == playerID {
			joiningPlayer = p
			break
		}
	}

	joinedPayload := lobbyPlayerJoinedPayload{
		Player: lobbyPlayerJSON{
			ID:          joiningPlayer.ID,
			Name:        joiningPlayer.Name,
			IsReady:     joiningPlayer.IsReady,
			IsConnected: joiningPlayer.IsConnected,
		},
	}

	// Broadcast lobby:player_joined to every other connected player in the room.
	h.mu.RLock()
	targets := make([]*client, 0, len(state.Players))
	for _, p := range state.Players {
		if p.ID == playerID {
			continue
		}
		if other, ok := h.conns[p.ID]; ok {
			targets = append(targets, other)
		}
	}
	h.mu.RUnlock()

	for _, other := range targets {
		other.send("lobby:player_joined", joinedPayload)
	}
}

// --- helpers ---

func roomHasPlayer(state *room.GameState, playerID string) bool {
	for _, p := range state.Players {
		if p.ID == playerID {
			return true
		}
	}
	return false
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
