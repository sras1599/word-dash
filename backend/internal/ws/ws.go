package ws

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
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
	store        room.Store
	dict         dictionary.DictionaryChecker
	mu           sync.RWMutex
	conns        map[string]*client       // playerID -> client
	activeTimers map[string]chan struct{} // roomCode -> stop channel
}

func NewHub(store room.Store) *Hub {
	return &Hub{
		store:        store,
		dict:         dictionary.NopChecker{},
		conns:        make(map[string]*client),
		activeTimers: make(map[string]chan struct{}),
	}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	roomCode := r.URL.Query().Get("roomCode")
	playerID := r.URL.Query().Get("playerId")
	playerName := ""
	if roomCode == "" || playerID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "missing required query params: roomCode and playerId",
		})
		return
	}

	// Validate the room and player exist before upgrading.
	state, err := h.store.Get(roomCode)
	if err != nil {
		if errors.Is(err, room.ErrRoomNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "room not found"})
			return
		}
		slog.Error("ws: failed to load room", "roomCode", roomCode, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load room"})
		return
	}
	if p, err := state.GetPlayer(playerID); err == nil {
		playerName = p.Name
	}
	if !roomHasPlayer(state, playerID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "player not in room"})
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws: upgrade error", "player", fmt.Sprintf("%s (%s)", playerID, playerName), "error", err)
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
	slog.Info("ws: client connected", "roomCode", roomCode, "player", fmt.Sprintf("%s (%s)", playerID, playerName))

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
			slog.Info("ws: client disconnected", "roomCode", roomCode, "player", fmt.Sprintf("%s (%s)", playerID, playerName))
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

func (h *Hub) handleClientDisconnected(roomCode, playerID string) {
	state, err := h.store.Get(roomCode)
	if err != nil {
		return
	}
	playerName := ""
	if p, err := state.GetPlayer(playerID); err == nil {
		playerName = p.Name
	}

	switch state.Phase {
	case room.GamePhaseWaiting:
		nextState, roomDeleted, err := h.store.RemovePlayer(roomCode, playerID)
		if err != nil {
			slog.Error("ws: failed to remove lobby player", "player", fmt.Sprintf("%s (%s)", playerID, playerName), "roomCode", roomCode, "error", err)
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
			slog.Error("ws: failed to mark player disconnected", "player", fmt.Sprintf("%s (%s)", playerID, playerName), "roomCode", roomCode, "error", err)
			return
		}
		h.broadcastToRoom(roomCode, "game:player_disconnected", playerEventPayload{PlayerID: playerID})
	}
}

// --- lobby:join ---

func (h *Hub) handleLobbyJoin(c *client, roomCode, playerID string) {
	alreadyConnected := h.store.IsPlayerConnected(roomCode, playerID)

	state, err := h.store.MarkPlayerConnected(roomCode, playerID)
	if err != nil {
		sendErr(c, "ROOM_NOT_FOUND", err.Error())
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

func (h *Hub) handleLobbySettingsChanged(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	var req lobbySettingsChangedRequest
	if !decodePayload(c, rawPayload, &req) {
		return
	}

	if req.TurnDurationMs < minTurnDurationMs || req.TurnDurationMs > maxTurnDurationMs {
		sendErr(c, "INVALID_PAYLOAD", "turnDurationMs must be between 60000 and 300000")
		return
	}
	if len(req.Variation.WordLengths) == 0 {
		sendErr(c, "INVALID_PAYLOAD", "variation must have at least one word length")
		return
	}

	variation := room.Variation{WordLengths: req.Variation.WordLengths}
	state, err := h.store.UpdateLobbySettings(roomCode, playerID, variation, req.TurnDurationMs)
	if err != nil {
		sendErr(c, roomErrorCode(err), err.Error())
		return
	}

	h.broadcastToRoom(roomCode, "lobby:settings_changed", lobbySettingsChangedPayload{
		Variation:      variationJSON{WordLengths: state.Variation.WordLengths},
		TurnDurationMs: state.TurnDurationMs,
	})
}

// --- lobby:player_ready / lobby:player_unready ---

func (h *Hub) handleLobbyPlayerReady(c *client, roomCode, playerID string) {
	if _, err := h.store.MarkPlayerReady(roomCode, playerID); err != nil {
		sendErr(c, "ROOM_NOT_FOUND", err.Error())
		return
	}

	// Broadcast lobby:player_ready to all connected players in the room (including the sender).
	h.broadcastToRoom(roomCode, "lobby:player_ready", lobbyPlayerReadyPayload{PlayerID: playerID})
}

func (h *Hub) handleLobbyPlayerUnready(c *client, roomCode, playerID string) {
	if _, err := h.store.MarkPlayerUnready(roomCode, playerID); err != nil {
		sendErr(c, "ROOM_NOT_FOUND", err.Error())
		return
	}

	h.broadcastToRoom(roomCode, "lobby:player_unready", lobbyPlayerUnreadyPayload{PlayerID: playerID})
}

// --- lobby:start_game ---

func (h *Hub) handleLobbyStartGame(c *client, roomCode, playerID string) {
	// Create and shuffle the deck.
	drawPile, err := deck.New()
	if err != nil {
		sendErr(c, "INTERNAL_ERROR", "failed to create deck")
		return
	}

	// Validate, deal cards, and transition the room to playing.
	state, err := h.store.StartGame(roomCode, playerID, drawPile)
	if err != nil {
		sendErr(c, roomErrorCode(err), err.Error())
		return
	}

	// Start the per-room turn timer.
	h.startTurnTimer(roomCode)
	playerName := ""
	if p, err2 := state.GetPlayer(playerID); err2 == nil {
		playerName = p.Name
	}
	slog.Info("ws: game starting", "roomCode", roomCode, "player", fmt.Sprintf("%s (%s)", playerID, playerName))

	// Broadcast lobby:game_starting to all connected players.
	h.broadcastToRoom(roomCode, "lobby:game_starting", map[string]string{"roomCode": roomCode})
}

// --- Turn timer ---
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
	slog.Info("ws: turn timer started", "roomCode", roomCode)
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
	if state, err := h.store.Get(roomCode); err == nil {
		previousRemaining = state.Turn.TimeRemainingMs
	}

	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			remaining, err := h.store.TickTimer(roomCode)
			if err != nil {
				slog.Warn("timer: room not found after tick, stopping timer", "roomCode", roomCode)
				h.stopTurnTimer(roomCode)
				return
			}

			state, err := h.store.Get(roomCode)
			if err != nil {
				slog.Warn("timer: room not found after state load, stopping timer", "roomCode", roomCode)
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
				if nextState, nextErr := h.store.Get(roomCode); nextErr == nil {
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
	var state *room.GameState
	if loadedState, err := h.store.Get(roomCode); err == nil {
		state = loadedState
		skippedPlayerID = state.Turn.CurrentPlayerID
	}

	nextState, err := h.store.NextTurn(roomCode)
	if err != nil {
		slog.Error("timer: failed to rotate turn", "roomCode", roomCode, "error", err)
		return
	}
	skippedName := ""
	if state != nil {
		if p, err2 := state.GetPlayer(skippedPlayerID); err2 == nil {
			skippedName = p.Name
		}
	}
	nextName := ""
	if p, err2 := nextState.GetPlayer(nextState.Turn.CurrentPlayerID); err2 == nil {
		nextName = p.Name
	}
	slog.Info("ws: turn timed out", "roomCode", roomCode,
		"skippedPlayer", fmt.Sprintf("%s (%s)", skippedPlayerID, skippedName),
		"nextPlayer", fmt.Sprintf("%s (%s)", nextState.Turn.CurrentPlayerID, nextName),
	)

	h.broadcastToRoom(roomCode, "game:turn_skipped", turnSkippedPayload{
		PlayerID:        skippedPlayerID,
		Reason:          "timeout",
		NextPlayerID:    nextState.Turn.CurrentPlayerID,
		TimeRemainingMs: nextState.Turn.TimeRemainingMs,
	})

	h.skipDisconnectedTurns(roomCode)

	finalState, err := h.store.Get(roomCode)
	if err != nil {
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
		state, err := h.store.Get(roomCode)
		if err != nil || state.Phase != room.GamePhasePlaying || state.Turn.Phase != room.TurnPhaseDraw {
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
		playerName := ""
		if p, err := state.GetPlayer(currentPlayerID); err == nil {
			playerName = p.Name
		}

		nextState, err := h.store.NextTurn(roomCode)
		if err != nil {
			slog.Error("ws: failed to skip disconnected player", "player", fmt.Sprintf("%s (%s)", currentPlayerID, playerName), "roomCode", roomCode, "error", err)
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
	state, err := h.store.Get(roomCode)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	slog.Debug("ws: broadcasting event", "event", event, "roomCode", roomCode)
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
		sendErr(c, "ROOM_NOT_FOUND", err.Error())
		return
	}

	c.send("game:state", buildGameStatePayload(&state, playerID))
	if !alreadyConnected {
		h.broadcastToRoom(roomCode, "game:player_reconnected", playerEventPayload{PlayerID: playerID})
	}
}

func (h *Hub) handleGamePlayerConnected(c *client, roomCode, playerID string) {
	state, err := h.store.Get(roomCode)
	if err != nil {
		if errors.Is(err, room.ErrRoomNotFound) {
			sendErr(c, "ROOM_NOT_FOUND", "room not found")
		} else {
			slog.Error("ws: failed to load room", "roomCode", roomCode, "error", err)
			sendErr(c, "INTERNAL_ERROR", "failed to load room")
		}
		return
	}
	if state.Phase == room.GamePhaseWaiting {
		sendErr(c, "INVALID_PHASE", "game is not in progress")
		return
	}

	h.syncGameConnection(c, roomCode, playerID)
}

// --- game:draw_card ---

func (h *Hub) handleGameDrawCard(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	var req drawCardRequest
	if !decodePayload(c, rawPayload, &req) {
		return
	}

	state, ok := h.getRoomState(c, roomCode)
	if !ok {
		return
	}

	drawnCard, err := game.DrawCard(state, playerID, req.Source)
	if err != nil {
		sendErr(c, gameErrorCode(err), err.Error())
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

func (h *Hub) handleGamePlaceCard(c *client, roomCode, playerID string, rawPayload json.RawMessage) {
	var req placeCardRequest
	if !decodePayload(c, rawPayload, &req) {
		return
	}
	if req.CardID == "" {
		sendErr(c, "INVALID_PAYLOAD", "invalid place_card payload")
		return
	}

	state, ok := h.getRoomState(c, roomCode)
	if !ok {
		return
	}

	if err := game.PlaceCard(state, playerID, req.CardID, req.RowIndex, req.SlotIndex, h.dict); err != nil {
		sendErr(c, gameErrorCode(err), err.Error())
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
		sendErr(c, "INTERNAL_ERROR", err.Error())
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
	if !decodePayload(c, rawPayload, &req) {
		return
	}

	state, ok := h.getRoomState(c, roomCode)
	if !ok {
		return
	}

	if err := game.UnplaceCard(state, playerID, req.RowIndex, req.SlotIndex); err != nil {
		sendErr(c, gameErrorCode(err), err.Error())
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
	if !decodePayload(c, rawPayload, &req) {
		return
	}
	if req.CardID == "" {
		sendErr(c, "INVALID_PAYLOAD", "invalid discard_card payload")
		return
	}

	state, ok := h.getRoomState(c, roomCode)
	if !ok {
		return
	}

	discarded, nextPlayerID, err := game.DiscardCard(state, playerID, req.CardID)
	if err != nil {
		sendErr(c, gameErrorCode(err), err.Error())
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

	h.broadcastToRoom(roomCode, "game:turn_ended", turnEndedPayload{
		PlayerID:        playerID,
		Reason:          "discarded",
		DiscardedCard:   cardJSON{ID: discarded.ID, Letter: discarded.Letter},
		DiscardPileTop:  cardJSON{ID: discarded.ID, Letter: discarded.Letter},
		NextPlayerID:    nextPlayerID,
		TimeRemainingMs: state.Turn.TimeRemainingMs,
	})
	h.skipDisconnectedTurns(roomCode)
}
