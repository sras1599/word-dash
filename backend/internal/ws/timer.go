// This file manages per-room turn timers and automatic turn skipping.
package ws

import (
	"log/slog"
	"time"

	"github.com/sras1599/wordit/backend/internal/game"
	"github.com/sras1599/wordit/backend/internal/room"
)

// startTurnTimer starts a room timer unless one is already active.
func (h *Hub) startTurnTimer(roomCode string) {
	state, err := h.store.Get(roomCode)
	if err != nil || state.Phase != room.GamePhasePlaying {
		return
	}
	stopCh, started := h.registerTurnTimer(roomCode)
	if !started {
		return
	}
	go h.timerLoop(roomCode, stopCh)
	slog.Info("ws: turn timer started", "roomCode", roomCode)
}

// registerTurnTimer records a timer stop channel for a room.
func (h *Hub) registerTurnTimer(roomCode string) (chan struct{}, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.activeTimers[roomCode]; ok {
		return nil, false
	}
	stopCh := make(chan struct{})
	h.activeTimers[roomCode] = stopCh
	return stopCh, true
}

// stopTurnTimer stops and unregisters an active room timer.
func (h *Hub) stopTurnTimer(roomCode string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if stopCh, ok := h.activeTimers[roomCode]; ok {
		close(stopCh)
		delete(h.activeTimers, roomCode)
	}
}

// timerLoop ticks the room timer once per second until stopped.
func (h *Hub) timerLoop(roomCode string, stopCh <-chan struct{}) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	h.reconcileRoomDeadline(roomCode)
	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			h.reconcileRoomDeadline(roomCode)
		}
	}
}

// reconcileRoomDeadline evaluates persisted wall-clock time without mutating a counter.
func (h *Hub) reconcileRoomDeadline(roomCode string) {
	state, err := h.store.Get(roomCode)
	if err != nil {
		h.stopMissingTimer(roomCode, "state load")
		return
	}
	if state.Phase != room.GamePhasePlaying || state.Turn.EndsAtUnixMs == 0 {
		return
	}
	if h.now().UnixMilli() >= state.Turn.EndsAtUnixMs {
		h.handleTurnTimeout(roomCode)
	}
}

// stopMissingTimer logs and stops a timer whose room no longer exists.
func (h *Hub) stopMissingTimer(roomCode, step string) {
	slog.Warn("timer: room not found after "+step+", stopping timer", "roomCode", roomCode)
	h.stopTurnTimer(roomCode)
}

// handleTurnTimeout applies timeout behavior and reconciles clients after auto-skips.
func (h *Hub) handleTurnTimeout(roomCode string) {
	h.reconcileMu.Lock()
	defer h.reconcileMu.Unlock()
	skippedPlayerID, previousState := h.currentTurnPlayer(roomCode)
	if previousState == nil || previousState.Phase != room.GamePhasePlaying || h.now().UnixMilli() < previousState.Turn.EndsAtUnixMs {
		return
	}
	if previousState != nil && previousState.Turn.Phase == room.TurnPhaseArrange {
		h.autoDiscardTimedOutTurn(roomCode, skippedPlayerID)
		return
	}
	if previousState == nil || !canSkipDisconnected(previousState) {
		slog.Warn("timer: expired outside skippable state", "roomCode", roomCode, "player", skippedPlayerID)
		return
	}

	reason := "timeout"
	if !isCurrentPlayerConnected(previousState) {
		reason = "disconnected"
	}

	nextState, err := h.store.NextTurn(roomCode, h.nextTurnDeadlineMs(previousState))
	if err != nil {
		slog.Error("timer: failed to rotate turn", "roomCode", roomCode, "error", err)
		return
	}
	h.logTurnTimeout(roomCode, skippedPlayerID, previousState, nextState)
	h.broadcastTurnSkipped(skippedPlayerID, reason, nextState)
	h.skipDisconnectedTurns(roomCode)
	h.syncFinalGameState(roomCode)
}

func (h *Hub) nextTurnDeadlineMs(state *room.GameState) int64 {
	return h.now().Add(time.Duration(state.TurnDurationMs) * time.Millisecond).UnixMilli()
}

// autoDiscardTimedOutTurn discards the drawn card for an expired arrange turn.
func (h *Hub) autoDiscardTimedOutTurn(roomCode, playerID string) {
	var result discardCardResult
	state, err := h.store.UpdateGameState(roomCode, func(state *room.GameState) error {
		discarded, nextPlayerID, err := game.AutoDiscardDrawnCard(state, playerID, h.nextTurnDeadlineMs(state))
		if err != nil {
			return err
		}
		result.boardUpdate = boardUpdateFor(state, playerID)
		result.discarded = discarded
		result.nextPlayerID = nextPlayerID
		result.reason = "timeout"
		return nil
	})
	if err != nil {
		slog.Error("timer: failed to auto-discard drawn card", "roomCode", roomCode, "player", playerID, "error", err)
		return
	}

	h.logTurnTimeout(roomCode, playerID, nil, state)
	h.afterDiscardCard(roomCode, playerID, &state, result)
}

// currentTurnPlayer returns the player who is active before timeout rotation.
func (h *Hub) currentTurnPlayer(roomCode string) (string, *room.GameState) {
	state, err := h.store.Get(roomCode)
	if err != nil {
		return "", nil
	}
	return state.Turn.CurrentPlayerID, state
}

// logTurnTimeout records timeout rotation details.
func (h *Hub) logTurnTimeout(roomCode, skippedPlayerID string, previousState *room.GameState, nextState room.GameState) {
	slog.Info("ws: turn timed out", "roomCode", roomCode,
		"skippedPlayer", formatPlayer(skippedPlayerID, playerName(previousState, skippedPlayerID)),
		"nextPlayer", formatPlayer(nextState.Turn.CurrentPlayerID, playerName(&nextState, nextState.Turn.CurrentPlayerID)),
	)
}

// broadcastTurnSkipped announces a timeout or disconnected-player skip.
func (h *Hub) broadcastTurnSkipped(playerID, reason string, state room.GameState) {
	h.broadcastGameToRoom(&state, "game:turn_skipped", turnSkippedPayload{
		PlayerID:     playerID,
		Reason:       reason,
		NextPlayerID: state.Turn.CurrentPlayerID,
	})
}

// syncFinalGameState sends final personalized snapshots after chained skips.
func (h *Hub) syncFinalGameState(roomCode string) {
	finalState, err := h.store.Get(roomCode)
	if err == nil {
		h.syncGameStateToRoom(finalState)
	}
}

// skipDisconnectedTurns rotates past disconnected players in draw phase.
func (h *Hub) skipDisconnectedTurns(roomCode string) {
	maxSkips := h.maxDisconnectedSkips(roomCode)
	for range maxSkips {
		state, ok := h.nextDisconnectedTurn(roomCode)
		if !ok {
			return
		}
		if !h.skipDisconnectedTurn(roomCode, state) {
			return
		}
	}
}

// maxDisconnectedSkips bounds chained skips so an all-disconnected room cannot
// spin forever.
func (h *Hub) maxDisconnectedSkips(roomCode string) int {
	state, err := h.store.Get(roomCode)
	if err != nil {
		return 0
	}
	return len(state.Players)
}

// nextDisconnectedTurn loads a skippable disconnected current turn.
func (h *Hub) nextDisconnectedTurn(roomCode string) (*room.GameState, bool) {
	state, err := h.store.Get(roomCode)
	if err != nil || !canSkipDisconnected(state) {
		return nil, false
	}
	return state, !isCurrentPlayerConnected(state)
}

// canSkipDisconnected reports whether the state permits disconnected auto-skip.
func canSkipDisconnected(state *room.GameState) bool {
	return state.Phase == room.GamePhasePlaying && state.Turn.Phase == room.TurnPhaseDraw
}

// isCurrentPlayerConnected reports whether the active turn holder is connected.
func isCurrentPlayerConnected(state *room.GameState) bool {
	player, err := state.GetPlayer(state.Turn.CurrentPlayerID)
	return err == nil && player.IsConnected
}

// skipDisconnectedTurn rotates one disconnected player and broadcasts it.
func (h *Hub) skipDisconnectedTurn(roomCode string, state *room.GameState) bool {
	currentPlayerID := state.Turn.CurrentPlayerID
	nextState, err := h.store.NextTurn(roomCode, h.nextTurnDeadlineMs(state))
	if err != nil {
		h.logSkipDisconnectedError(roomCode, state, err)
		return false
	}
	h.broadcastTurnSkipped(currentPlayerID, "disconnected", nextState)
	return true
}

// logSkipDisconnectedError records a failed disconnected-player rotation.
func (h *Hub) logSkipDisconnectedError(roomCode string, state *room.GameState, err error) {
	playerID := state.Turn.CurrentPlayerID
	slog.Error("ws: failed to skip disconnected player",
		"player", formatPlayer(playerID, playerName(state, playerID)),
		"roomCode", roomCode,
		"error", err,
	)
}
