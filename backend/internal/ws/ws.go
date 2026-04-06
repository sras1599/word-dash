package ws

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/sras1599/wordit/backend/internal/deck"
	"github.com/sras1599/wordit/backend/internal/game"
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
		case "lobby:player_ready":
			h.handleLobbyPlayerReady(c, roomCode, playerID)
		case "lobby:start_game":
			h.handleLobbyStartGame(c, roomCode, playerID)
		case "game:player_connected":
			h.handleGamePlayerConnected(c, roomCode, playerID)
		case "game:draw_card":
			h.handleGameDrawCard(c, roomCode, playerID, msg.Payload)
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

// --- lobby:player_ready ---

type lobbyPlayerReadyPayload struct {
	PlayerID string `json:"playerId"`
}

func (h *Hub) handleLobbyPlayerReady(c *client, roomCode, playerID string) {
	state, err := h.store.MarkPlayerReady(roomCode, playerID)
	if err != nil {
		c.send("game:error", map[string]string{
			"code":    "ROOM_NOT_FOUND",
			"message": err.Error(),
		})
		return
	}

	payload := lobbyPlayerReadyPayload{PlayerID: playerID}

	// Broadcast lobby:player_ready to all connected players in the room (including the sender).
	h.mu.RLock()
	targets := make([]*client, 0, len(state.Players))
	for _, p := range state.Players {
		if other, ok := h.conns[p.ID]; ok {
			targets = append(targets, other)
		}
	}
	h.mu.RUnlock()

	for _, other := range targets {
		other.send("lobby:player_ready", payload)
	}
}

// --- lobby:start_game ---

type cardJSON struct {
	ID     string `json:"id"`
	Letter string `json:"letter"`
}

type wordSlotJSON struct {
	SlotIndex int       `json:"slotIndex"`
	Card      *cardJSON `json:"card"`
}

type wordRowJSON struct {
	TargetLength int            `json:"targetLength"`
	Slots        []wordSlotJSON `json:"slots"`
	IsComplete   bool           `json:"isComplete"`
}

type wordBoardJSON struct {
	Rows        []wordRowJSON `json:"rows"`
	AllComplete bool          `json:"allComplete"`
}

type gamePlayerJSON struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	HandCount   int           `json:"handCount"`
	Hand        []cardJSON    `json:"hand,omitempty"`
	WordBoard   wordBoardJSON `json:"wordBoard"`
	IsReady     bool          `json:"isReady"`
	IsConnected bool          `json:"isConnected"`
}

type turnJSON struct {
	CurrentPlayerID string `json:"currentPlayerId"`
	Phase           string `json:"phase"`
	TimeRemainingMs int    `json:"timeRemainingMs"`
}

type gameStatePayload struct {
	RoomCode       string           `json:"roomCode"`
	Variation      variationJSON    `json:"variation"`
	Players        []gamePlayerJSON `json:"players"`
	DrawPileCount  int              `json:"drawPileCount"`
	DiscardPileTop *cardJSON        `json:"discardPileTop"`
	Turn           turnJSON         `json:"turn"`
	Phase          string           `json:"phase"`
}

func (h *Hub) handleLobbyStartGame(c *client, roomCode, playerID string) {
	// Create and shuffle the deck.
	drawPile, err := deck.New()
	if err != nil {
		c.send("game:error", map[string]string{
			"code":    "INTERNAL_ERROR",
			"message": "failed to create deck",
		})
		return
	}

	// Validate, deal cards, and transition the room to playing.
	state, err := h.store.StartGame(roomCode, playerID, drawPile)
	if err != nil {
		code := "INTERNAL_ERROR"
		switch {
		case errors.Is(err, room.ErrNotHost):
			code = "FORBIDDEN"
		case errors.Is(err, room.ErrGameAlreadyStarted):
			code = "INVALID_PHASE"
		case errors.Is(err, room.ErrNotAllReady):
			code = "NOT_ALL_READY"
		case errors.Is(err, room.ErrRoomNotFound):
			code = "ROOM_NOT_FOUND"
		}
		c.send("game:error", map[string]string{
			"code":    code,
			"message": err.Error(),
		})
		return
	}

	// Snapshot connected clients for this room under a single lock acquisition.
	h.mu.RLock()
	playerClients := make(map[string]*client, len(state.Players))
	for _, p := range state.Players {
		if cl, ok := h.conns[p.ID]; ok {
			playerClients[p.ID] = cl
		}
	}
	h.mu.RUnlock()

	// Broadcast lobby:game_starting to all connected players.
	gameStartingPayload := map[string]string{"roomCode": roomCode}
	for _, cl := range playerClients {
		cl.send("lobby:game_starting", gameStartingPayload)
	}
}

// --- game:player_connected ---

func (h *Hub) handleGamePlayerConnected(c *client, roomCode, playerID string) {
	state, ok := h.store.Get(roomCode)
	if !ok {
		c.send("game:error", map[string]string{
			"code":    "ROOM_NOT_FOUND",
			"message": "room not found",
		})
		return
	}
	if state.Phase != room.GamePhasePlaying {
		c.send("game:error", map[string]string{
			"code":    "INVALID_PHASE",
			"message": "game is not in progress",
		})
		return
	}
	c.send("game:state", buildGameStatePayload(state, playerID))
}

// --- game:draw_card ---

type drawCardRequest struct {
	Source string `json:"source"`
}

type cardDrawnPayload struct {
	PlayerID       string    `json:"playerId"`
	Source         string    `json:"source"`
	Card           *cardJSON `json:"card"`
	DrawPileCount  int       `json:"drawPileCount"`
	DiscardPileTop *cardJSON `json:"discardPileTop"`
}

func (h *Hub) handleGameDrawCard(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	var req drawCardRequest
	if err := json.Unmarshal(rawPayload, &req); err != nil {
		c.send("game:error", map[string]string{
			"code":    "INVALID_PAYLOAD",
			"message": "invalid draw_card payload",
		})
		return
	}

	state, ok := h.store.Get(roomCode)
	if !ok {
		c.send("game:error", map[string]string{
			"code":    "ROOM_NOT_FOUND",
			"message": "room not found",
		})
		return
	}

	drawnCard, err := game.DrawCard(state, playerID, req.Source)
	if err != nil {
		code := "INTERNAL_ERROR"
		switch {
		case errors.Is(err, game.ErrNotYourTurn):
			code = "NOT_YOUR_TURN"
		case errors.Is(err, game.ErrInvalidPhase):
			code = "INVALID_PHASE"
		case errors.Is(err, game.ErrEmptyDeck):
			code = "EMPTY_DECK"
		}
		c.send("game:error", map[string]string{
			"code":    code,
			"message": err.Error(),
		})
		return
	}

	// Build shared payload pieces.
	var discardPileTop *cardJSON
	if state.DiscardPileTop != nil {
		discardPileTop = &cardJSON{ID: state.DiscardPileTop.ID, Letter: state.DiscardPileTop.Letter}
	}

	// Snapshot connected clients for this room.
	h.mu.RLock()
	playerClients := make(map[string]*client)
	for _, p := range state.Players {
		if cl, ok := h.conns[p.ID]; ok {
			playerClients[p.ID] = cl
		}
	}
	h.mu.RUnlock()

	// Broadcast game:card_drawn to everyone.
	// Only the drawing player sees the card details if it's from the draw pile.
	// If it's from the discard pile, everyone sees it (it was already visible).
	for pid, cl := range playerClients {
		var broadcastCard *cardJSON
		if pid == playerID || req.Source == "discard" {
			broadcastCard = &cardJSON{ID: drawnCard.ID, Letter: drawnCard.Letter}
		}

		cl.send("game:card_drawn", cardDrawnPayload{
			PlayerID:       playerID,
			Source:         req.Source,
			Card:           broadcastCard,
			DrawPileCount:  state.DrawPileCount,
			DiscardPileTop: discardPileTop,
		})
	}
}

func buildGameStatePayload(state *room.GameState, forPlayerID string) gameStatePayload {
	players := make([]gamePlayerJSON, len(state.Players))
	for i, p := range state.Players {
		var hand []cardJSON
		if p.ID == forPlayerID {
			hand = make([]cardJSON, len(p.Hand))
			for j, card := range p.Hand {
				hand[j] = cardJSON{ID: card.ID, Letter: card.Letter}
			}
		}
		players[i] = gamePlayerJSON{
			ID:          p.ID,
			Name:        p.Name,
			HandCount:   len(p.Hand),
			Hand:        hand,
			WordBoard:   buildWordBoardJSON(p.WordBoard),
			IsReady:     p.IsReady,
			IsConnected: p.IsConnected,
		}
	}

	var discardPileTop *cardJSON
	if state.DiscardPileTop != nil {
		discardPileTop = &cardJSON{ID: state.DiscardPileTop.ID, Letter: state.DiscardPileTop.Letter}
	}

	return gameStatePayload{
		RoomCode:       state.RoomCode,
		Variation:      variationJSON{WordLengths: state.Variation.WordLengths},
		Players:        players,
		DrawPileCount:  state.DrawPileCount,
		DiscardPileTop: discardPileTop,
		Turn: turnJSON{
			CurrentPlayerID: state.Turn.CurrentPlayerID,
			Phase:           string(state.Turn.Phase),
			TimeRemainingMs: state.Turn.TimeRemainingMs,
		},
		Phase: string(state.Phase),
	}
}

func buildWordBoardJSON(wb room.WordBoard) wordBoardJSON {
	rows := make([]wordRowJSON, len(wb.Rows))
	for i, row := range wb.Rows {
		slots := make([]wordSlotJSON, len(row.Slots))
		for j, slot := range row.Slots {
			var card *cardJSON
			if slot.Card != nil {
				card = &cardJSON{ID: slot.Card.ID, Letter: slot.Card.Letter}
			}
			slots[j] = wordSlotJSON{SlotIndex: slot.SlotIndex, Card: card}
		}
		rows[i] = wordRowJSON{
			TargetLength: row.TargetLength,
			Slots:        slots,
			IsComplete:   row.IsComplete,
		}
	}
	return wordBoardJSON{Rows: rows, AllComplete: wb.AllComplete}
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
