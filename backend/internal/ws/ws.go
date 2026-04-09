package ws

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sras1599/wordit/backend/internal/deck"
	"github.com/sras1599/wordit/backend/internal/dictionary"
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
	store        *room.Store
	dict         dictionary.DictionaryChecker
	mu           sync.RWMutex
	conns        map[string]*client       // playerID -> client
	activeTimers map[string]chan struct{} // roomCode -> stop channel
}

func NewHub(store *room.Store) *Hub {
	return &Hub{
		store:        store,
		dict:         dictionary.NopChecker{},
		conns:        make(map[string]*client),
		activeTimers: make(map[string]chan struct{}),
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
	previousClient := h.conns[playerID]
	h.conns[playerID] = c
	h.mu.Unlock()
	if previousClient != nil && previousClient != c {
		_ = previousClient.conn.Close()
	}

	h.handleClientConnected(c, roomCode, playerID)

	defer func() {
		shouldHandleDisconnect := false
		h.mu.Lock()
		if current, ok := h.conns[playerID]; ok && current == c {
			delete(h.conns, playerID)
			shouldHandleDisconnect = true
		}
		h.mu.Unlock()
		if shouldHandleDisconnect {
			h.handleClientDisconnected(roomCode, playerID)
		}
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
		case "lobby:player_unready":
			h.handleLobbyPlayerUnready(c, roomCode, playerID)
		case "lobby:settings_changed":
			h.handleLobbySettingsChanged(c, roomCode, playerID, msg.Payload)
		case "lobby:start_game":
			h.handleLobbyStartGame(c, roomCode, playerID)
		case "game:player_connected":
			h.handleGamePlayerConnected(c, roomCode, playerID)
		case "game:draw_card":
			h.handleGameDrawCard(c, roomCode, playerID, msg.Payload)
		case "game:place_card":
			h.handleGamePlaceCard(c, roomCode, playerID, msg.Payload)
		case "game:unplace_card":
			h.handleGameUnplaceCard(c, roomCode, playerID, msg.Payload)
		case "game:discard_card":
			h.handleGameDiscardCard(c, roomCode, playerID, msg.Payload)
		}
	}
}

func (h *Hub) handleClientConnected(c *client, roomCode, playerID string) {
	state, ok := h.store.Get(roomCode)
	if !ok {
		return
	}

	if state.Phase == room.GamePhaseWaiting {
		h.handleLobbyJoin(c, roomCode, playerID)
		return
	}

	h.syncGameConnection(c, roomCode, playerID)
}

func (h *Hub) handleClientDisconnected(roomCode, playerID string) {
	state, ok := h.store.Get(roomCode)
	if !ok {
		return
	}

	switch state.Phase {
	case room.GamePhaseWaiting:
		nextState, roomDeleted, err := h.store.RemovePlayer(roomCode, playerID)
		if err != nil {
			log.Printf("ws: failed to remove lobby player %s from room %s: %v", playerID, roomCode, err)
			return
		}
		if roomDeleted {
			return
		}
		h.broadcastToRoom(roomCode, "lobby:player_disconnected", lobbyPlayerDisconnectedPayload{
			PlayerID:     playerID,
			HostPlayerID: nextState.Players[0].ID,
		})
	case room.GamePhasePlaying, room.GamePhaseFinished:
		if _, err := h.store.MarkPlayerDisconnected(roomCode, playerID); err != nil {
			log.Printf("ws: failed to mark player %s disconnected in room %s: %v", playerID, roomCode, err)
			return
		}
		h.broadcastToRoom(roomCode, "game:player_disconnected", playerEventPayload{PlayerID: playerID})
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
	RoomCode       string            `json:"roomCode"`
	HostPlayerID   string            `json:"hostPlayerId"`
	Variation      variationJSON     `json:"variation"`
	TurnDurationMs int               `json:"turnDurationMs"`
	Players        []lobbyPlayerJSON `json:"players"`
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
		RoomCode:       state.RoomCode,
		HostPlayerID:   state.Players[0].ID,
		Variation:      variationJSON{WordLengths: state.Variation.WordLengths},
		TurnDurationMs: state.TurnDurationMs,
		Players:        players,
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

// --- lobby:settings_changed ---

const (
	minTurnDurationMs = 60_000  // 1 minute
	maxTurnDurationMs = 300_000 // 5 minutes
)

type lobbySettingsChangedPayload struct {
	Variation      variationJSON `json:"variation"`
	TurnDurationMs int           `json:"turnDurationMs"`
}

type lobbySettingsChangedRequest struct {
	Variation      variationJSON `json:"variation"`
	TurnDurationMs int           `json:"turnDurationMs"`
}

func (h *Hub) handleLobbySettingsChanged(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	var req lobbySettingsChangedRequest
	if err := json.Unmarshal(rawPayload, &req); err != nil {
		c.send("game:error", map[string]string{
			"code":    "INVALID_PAYLOAD",
			"message": "invalid settings_changed payload",
		})
		return
	}

	if req.TurnDurationMs < minTurnDurationMs || req.TurnDurationMs > maxTurnDurationMs {
		c.send("game:error", map[string]string{
			"code":    "INVALID_PAYLOAD",
			"message": "turnDurationMs must be between 60000 and 300000",
		})
		return
	}

	if len(req.Variation.WordLengths) == 0 {
		c.send("game:error", map[string]string{
			"code":    "INVALID_PAYLOAD",
			"message": "variation must have at least one word length",
		})
		return
	}

	variation := room.Variation{WordLengths: req.Variation.WordLengths}
	state, err := h.store.UpdateLobbySettings(roomCode, playerID, variation, req.TurnDurationMs)
	if err != nil {
		code := "INTERNAL_ERROR"
		switch {
		case errors.Is(err, room.ErrNotHost):
			code = "FORBIDDEN"
		case errors.Is(err, room.ErrGameAlreadyStarted):
			code = "INVALID_PHASE"
		case errors.Is(err, room.ErrRoomNotFound):
			code = "ROOM_NOT_FOUND"
		}
		c.send("game:error", map[string]string{
			"code":    code,
			"message": err.Error(),
		})
		return
	}

	payload := lobbySettingsChangedPayload{
		Variation:      variationJSON{WordLengths: state.Variation.WordLengths},
		TurnDurationMs: state.TurnDurationMs,
	}

	h.mu.RLock()
	targets := make([]*client, 0, len(state.Players))
	for _, p := range state.Players {
		if other, ok := h.conns[p.ID]; ok {
			targets = append(targets, other)
		}
	}
	h.mu.RUnlock()

	for _, other := range targets {
		other.send("lobby:settings_changed", payload)
	}
}

// --- lobby:player_ready ---

type lobbyPlayerReadyPayload struct {
	PlayerID string `json:"playerId"`
}

type lobbyPlayerUnreadyPayload struct {
	PlayerID string `json:"playerId"`
}

type lobbyPlayerDisconnectedPayload struct {
	PlayerID     string `json:"playerId"`
	HostPlayerID string `json:"hostPlayerId"`
}

type playerEventPayload struct {
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

func (h *Hub) handleLobbyPlayerUnready(c *client, roomCode, playerID string) {
	state, err := h.store.MarkPlayerUnready(roomCode, playerID)
	if err != nil {
		c.send("game:error", map[string]string{
			"code":    "ROOM_NOT_FOUND",
			"message": err.Error(),
		})
		return
	}

	payload := lobbyPlayerUnreadyPayload{PlayerID: playerID}

	h.mu.RLock()
	targets := make([]*client, 0, len(state.Players))
	for _, p := range state.Players {
		if other, ok := h.conns[p.ID]; ok {
			targets = append(targets, other)
		}
	}
	h.mu.RUnlock()

	for _, other := range targets {
		other.send("lobby:player_unready", payload)
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

var timerWarningThresholdsMs = []int{10_000, 5_000, 1_000}

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

	// Start the per-room turn timer.
	h.startTurnTimer(roomCode)

	// Broadcast lobby:game_starting to all connected players.
	gameStartingPayload := map[string]string{"roomCode": roomCode}
	for _, cl := range playerClients {
		cl.send("lobby:game_starting", gameStartingPayload)
	}
}

// --- Turn timer ---

type timerWarningPayload struct {
	RoomCode        string `json:"roomCode"`
	CurrentPlayerID string `json:"currentPlayerId"`
	TimeRemainingMs int    `json:"timeRemainingMs"`
}

type turnSkippedPayload struct {
	PlayerID        string `json:"playerId"`
	Reason          string `json:"reason"`
	NextPlayerID    string `json:"nextPlayerId"`
	TimeRemainingMs int    `json:"timeRemainingMs"`
}

func (h *Hub) startTurnTimer(roomCode string) {
	h.mu.Lock()
	if _, ok := h.activeTimers[roomCode]; ok {
		h.mu.Unlock()
		return
	}
	stopCh := make(chan struct{})
	h.activeTimers[roomCode] = stopCh
	h.mu.Unlock()

	go h.timerLoop(roomCode, stopCh)
}

func (h *Hub) stopTurnTimer(roomCode string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if stopCh, ok := h.activeTimers[roomCode]; ok {
		close(stopCh)
		delete(h.activeTimers, roomCode)
	}
}

func (h *Hub) timerLoop(roomCode string, stopCh <-chan struct{}) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	previousRemaining := 0
	if state, ok := h.store.Get(roomCode); ok {
		previousRemaining = state.Turn.TimeRemainingMs
	}

	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			remaining, err := h.store.TickTimer(roomCode)
			if err != nil {
				log.Printf("timer: room %s not found, stopping", roomCode)
				h.stopTurnTimer(roomCode)
				return
			}

			state, ok := h.store.Get(roomCode)
			if !ok {
				log.Printf("timer: room %s not found after tick, stopping", roomCode)
				h.stopTurnTimer(roomCode)
				return
			}

			if state.Phase != room.GamePhasePlaying {
				previousRemaining = state.Turn.TimeRemainingMs
				continue
			}

			if shouldBroadcastTimerWarning(previousRemaining, remaining) {
				h.broadcastToRoom(roomCode, "game:timer_warning", timerWarningPayload{
					RoomCode:        roomCode,
					CurrentPlayerID: state.Turn.CurrentPlayerID,
					TimeRemainingMs: remaining,
				})
			}

			if remaining == 0 {
				h.handleTurnTimeout(roomCode)
				if nextState, nextOK := h.store.Get(roomCode); nextOK {
					previousRemaining = nextState.Turn.TimeRemainingMs
				}
				continue
			}

			previousRemaining = remaining
		}
	}
}

func (h *Hub) handleTurnTimeout(roomCode string) {
	skippedPlayerID := ""
	if state, ok := h.store.Get(roomCode); ok {
		skippedPlayerID = state.Turn.CurrentPlayerID
	}

	nextState, err := h.store.NextTurn(roomCode)
	if err != nil {
		log.Printf("timer: failed to rotate turn for room %s: %v", roomCode, err)
		return
	}

	h.broadcastToRoom(roomCode, "game:turn_skipped", turnSkippedPayload{
		PlayerID:        skippedPlayerID,
		Reason:          "timeout",
		NextPlayerID:    nextState.Turn.CurrentPlayerID,
		TimeRemainingMs: nextState.Turn.TimeRemainingMs,
	})

	h.skipDisconnectedTurns(roomCode)

	finalState, ok := h.store.Get(roomCode)
	if !ok {
		return
	}

	// Sync each player with the final game state after any disconnect skips.
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, p := range finalState.Players {
		if cl, ok := h.conns[p.ID]; ok {
			cl.send("game:state", buildGameStatePayload(finalState, p.ID))
		}
	}
}

func (h *Hub) skipDisconnectedTurns(roomCode string) {
	for {
		state, ok := h.store.Get(roomCode)
		if !ok || state.Phase != room.GamePhasePlaying || state.Turn.Phase != room.TurnPhaseDraw {
			return
		}

		currentPlayerID := state.Turn.CurrentPlayerID
		currentConnected := false
		for _, p := range state.Players {
			if p.ID == currentPlayerID {
				currentConnected = p.IsConnected
				break
			}
		}
		if currentConnected {
			return
		}

		nextState, err := h.store.NextTurn(roomCode)
		if err != nil {
			log.Printf("ws: failed to skip disconnected player %s in room %s: %v", currentPlayerID, roomCode, err)
			return
		}

		h.broadcastToRoom(roomCode, "game:turn_skipped", turnSkippedPayload{
			PlayerID:        currentPlayerID,
			Reason:          "disconnected",
			NextPlayerID:    nextState.Turn.CurrentPlayerID,
			TimeRemainingMs: nextState.Turn.TimeRemainingMs,
		})
	}
}

func (h *Hub) broadcastToRoom(roomCode, event string, payload any) {
	state, ok := h.store.Get(roomCode)
	if !ok {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, p := range state.Players {
		if cl, ok := h.conns[p.ID]; ok {
			cl.send(event, payload)
		}
	}
}

// --- game:player_connected ---

func (h *Hub) syncGameConnection(c *client, roomCode, playerID string) {
	alreadyConnected := h.store.IsPlayerConnected(roomCode, playerID)
	state, err := h.store.MarkPlayerConnected(roomCode, playerID)
	if err != nil {
		c.send("game:error", map[string]string{
			"code":    "ROOM_NOT_FOUND",
			"message": err.Error(),
		})
		return
	}

	c.send("game:state", buildGameStatePayload(&state, playerID))
	if !alreadyConnected {
		h.broadcastToRoom(roomCode, "game:player_reconnected", playerEventPayload{PlayerID: playerID})
	}
}

func (h *Hub) handleGamePlayerConnected(c *client, roomCode, playerID string) {
	state, ok := h.store.Get(roomCode)
	if !ok {
		c.send("game:error", map[string]string{
			"code":    "ROOM_NOT_FOUND",
			"message": "room not found",
		})
		return
	}
	if state.Phase == room.GamePhaseWaiting {
		c.send("game:error", map[string]string{
			"code":    "INVALID_PHASE",
			"message": "game is not in progress",
		})
		return
	}

	h.syncGameConnection(c, roomCode, playerID)
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

// --- game:place_card ---

type placeCardRequest struct {
	CardID    string `json:"cardId"`
	RowIndex  int    `json:"rowIndex"`
	SlotIndex int    `json:"slotIndex"`
}

type unplaceCardRequest struct {
	RowIndex  int `json:"rowIndex"`
	SlotIndex int `json:"slotIndex"`
}

type boardUpdatedPayload struct {
	PlayerID  string        `json:"playerId"`
	WordBoard wordBoardJSON `json:"wordBoard"`
	HandCount int           `json:"handCount"`
	Hand      []cardJSON    `json:"hand,omitempty"`
}

type discardCardRequest struct {
	CardID string `json:"cardId"`
}

type turnEndedPayload struct {
	PlayerID        string   `json:"playerId"`
	Reason          string   `json:"reason"`
	DiscardedCard   cardJSON `json:"discardedCard"`
	DiscardPileTop  cardJSON `json:"discardPileTop"`
	NextPlayerID    string   `json:"nextPlayerId"`
	TimeRemainingMs int      `json:"timeRemainingMs"`
}

type playerWonPayload struct {
	WinnerID         string        `json:"winnerId"`
	WinnerName       string        `json:"winnerName"`
	WinningWordBoard wordBoardJSON `json:"winningWordBoard"`
}

func (h *Hub) handleGamePlaceCard(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	var req placeCardRequest
	if err := json.Unmarshal(rawPayload, &req); err != nil || req.CardID == "" {
		c.send("game:error", map[string]string{
			"code":    "INVALID_PAYLOAD",
			"message": "invalid place_card payload",
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

	if err := game.PlaceCard(state, playerID, req.CardID, req.RowIndex, req.SlotIndex, h.dict); err != nil {
		code := "INTERNAL_ERROR"
		switch {
		case errors.Is(err, game.ErrInvalidPhase):
			code = "INVALID_PHASE"
		case errors.Is(err, game.ErrInvalidCard):
			code = "INVALID_CARD"
		case errors.Is(err, game.ErrInvalidSlot):
			code = "INVALID_SLOT"
		}
		c.send("game:error", map[string]string{
			"code":    code,
			"message": err.Error(),
		})
		return
	}

	// Find the updated board and hand for the acting player.
	var (
		updatedBoard room.WordBoard
		updatedHand  []cardJSON
	)
	for _, p := range state.Players {
		if p.ID == playerID {
			updatedBoard = p.WordBoard
			updatedHand = buildHandJSON(p.Hand)
			break
		}
	}

	winner, won, err := game.DeclareWinnerIfComplete(state, playerID)
	if err != nil {
		c.send("game:error", map[string]string{
			"code":    "INTERNAL_ERROR",
			"message": err.Error(),
		})
		return
	}

	// Snapshot connected clients for this room.
	h.mu.RLock()
	playerClients := make(map[string]*client, len(state.Players))
	for _, p := range state.Players {
		if cl, ok := h.conns[p.ID]; ok {
			playerClients[p.ID] = cl
		}
	}
	h.mu.RUnlock()

	// Broadcast board update to all players.
	// Only the acting player receives their full updated hand.
	for pid, cl := range playerClients {
		payload := boardUpdatedPayload{
			PlayerID:  playerID,
			WordBoard: buildWordBoardJSON(updatedBoard),
			HandCount: len(updatedHand),
		}
		if pid == playerID {
			payload.Hand = updatedHand
		}
		cl.send("game:board_updated", payload)
	}

	if won {
		h.stopTurnTimer(roomCode)
		h.broadcastToRoom(roomCode, "game:player_won", playerWonPayload{
			WinnerID:         winner.ID,
			WinnerName:       winner.Name,
			WinningWordBoard: buildWordBoardJSON(winner.WordBoard),
		})
	}
}

// --- game:unplace_card ---

func (h *Hub) handleGameUnplaceCard(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	var req unplaceCardRequest
	if err := json.Unmarshal(rawPayload, &req); err != nil {
		c.send("game:error", map[string]string{
			"code":    "INVALID_PAYLOAD",
			"message": "invalid unplace_card payload",
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

	if err := game.UnplaceCard(state, playerID, req.RowIndex, req.SlotIndex); err != nil {
		code := "INTERNAL_ERROR"
		switch {
		case errors.Is(err, game.ErrNotYourTurn):
			code = "NOT_YOUR_TURN"
		case errors.Is(err, game.ErrInvalidPhase):
			code = "INVALID_PHASE"
		case errors.Is(err, game.ErrInvalidCard):
			code = "INVALID_CARD"
		case errors.Is(err, game.ErrInvalidSlot):
			code = "INVALID_SLOT"
		}
		c.send("game:error", map[string]string{
			"code":    code,
			"message": err.Error(),
		})
		return
	}

	// Find the updated board and hand for the acting player.
	var (
		updatedBoard room.WordBoard
		updatedHand  []cardJSON
	)
	for _, p := range state.Players {
		if p.ID == playerID {
			updatedBoard = p.WordBoard
			updatedHand = buildHandJSON(p.Hand)
			break
		}
	}

	// Snapshot connected clients for this room.
	h.mu.RLock()
	playerClients := make(map[string]*client, len(state.Players))
	for _, p := range state.Players {
		if cl, ok := h.conns[p.ID]; ok {
			playerClients[p.ID] = cl
		}
	}
	h.mu.RUnlock()

	// Broadcast board update to all players.
	// Only the acting player receives their full updated hand.
	for pid, cl := range playerClients {
		payload := boardUpdatedPayload{
			PlayerID:  playerID,
			WordBoard: buildWordBoardJSON(updatedBoard),
			HandCount: len(updatedHand),
		}
		if pid == playerID {
			payload.Hand = updatedHand
		}
		cl.send("game:board_updated", payload)
	}
}

// --- game:discard_card ---

func (h *Hub) handleGameDiscardCard(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	var req discardCardRequest
	if err := json.Unmarshal(rawPayload, &req); err != nil || req.CardID == "" {
		c.send("game:error", map[string]string{
			"code":    "INVALID_PAYLOAD",
			"message": "invalid discard_card payload",
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

	discarded, nextPlayerID, err := game.DiscardCard(state, playerID, req.CardID)
	if err != nil {
		code := "INTERNAL_ERROR"
		switch {
		case errors.Is(err, game.ErrNotYourTurn):
			code = "NOT_YOUR_TURN"
		case errors.Is(err, game.ErrInvalidPhase):
			code = "INVALID_PHASE"
		case errors.Is(err, game.ErrInvalidCard):
			code = "INVALID_CARD"
		}
		c.send("game:error", map[string]string{
			"code":    code,
			"message": err.Error(),
		})
		return
	}

	// Find the updated board and hand for the acting player.
	var (
		updatedBoard room.WordBoard
		updatedHand  []cardJSON
	)
	for _, p := range state.Players {
		if p.ID == playerID {
			updatedBoard = p.WordBoard
			updatedHand = buildHandJSON(p.Hand)
			break
		}
	}

	// Snapshot connected clients for this room.
	h.mu.RLock()
	playerClients := make(map[string]*client, len(state.Players))
	for _, p := range state.Players {
		if cl, ok := h.conns[p.ID]; ok {
			playerClients[p.ID] = cl
		}
	}
	h.mu.RUnlock()

	// Broadcast board/hand reconciliation first, then end the turn.
	for pid, cl := range playerClients {
		boardPayload := boardUpdatedPayload{
			PlayerID:  playerID,
			WordBoard: buildWordBoardJSON(updatedBoard),
			HandCount: len(updatedHand),
		}
		if pid == playerID {
			boardPayload.Hand = updatedHand
		}
		cl.send("game:board_updated", boardPayload)
	}

	payload := turnEndedPayload{
		PlayerID:        playerID,
		Reason:          "discarded",
		DiscardedCard:   cardJSON{ID: discarded.ID, Letter: discarded.Letter},
		DiscardPileTop:  cardJSON{ID: discarded.ID, Letter: discarded.Letter},
		NextPlayerID:    nextPlayerID,
		TimeRemainingMs: state.Turn.TimeRemainingMs,
	}
	h.broadcastToRoom(roomCode, "game:turn_ended", payload)
	h.skipDisconnectedTurns(roomCode)
}

func shouldBroadcastTimerWarning(previousRemaining, currentRemaining int) bool {
	if currentRemaining <= 0 {
		return false
	}

	for _, threshold := range timerWarningThresholdsMs {
		if previousRemaining > threshold && currentRemaining <= threshold {
			return true
		}
	}

	return false
}

func buildGameStatePayload(state *room.GameState, forPlayerID string) gameStatePayload {
	players := make([]gamePlayerJSON, len(state.Players))
	for i, p := range state.Players {
		var hand []cardJSON
		if p.ID == forPlayerID {
			hand = buildHandJSON(p.Hand)
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

func buildHandJSON(hand []room.Card) []cardJSON {
	out := make([]cardJSON, len(hand))
	for i, card := range hand {
		out[i] = cardJSON{ID: card.ID, Letter: card.Letter}
	}
	return out
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
