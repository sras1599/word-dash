package ws

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/sras1599/wordit/backend/internal/game"
	"github.com/sras1599/wordit/backend/internal/room"
)

var timerWarningThresholdsMs = []int{10_000, 5_000, 1_000}

// sendErr sends a standardised game:error message to the client.
func sendErr(c *client, code, message string) {
	c.send("game:error", map[string]string{
		"code":    code,
		"message": message,
	})
}

// decodePayload unmarshals raw JSON into v. On failure it sends an
// INVALID_PAYLOAD game:error to c and returns false.
func decodePayload(c *client, raw json.RawMessage, v any) bool {
	if err := json.Unmarshal(raw, v); err != nil {
		sendErr(c, "INVALID_PAYLOAD", "invalid payload")
		return false
	}
	return true
}

// getRoomState looks up the room by code. If the room is not found it sends a
// ROOM_NOT_FOUND game:error to c and returns nil, false.
func (h *Hub) getRoomState(c *client, roomCode string) (*room.GameState, bool) {
	state, err := h.store.Get(roomCode)
	if err != nil {
		if errors.Is(err, room.ErrRoomNotFound) {
			sendErr(c, "ROOM_NOT_FOUND", "room not found")
			return nil, false
		}
		log.Printf("ws: failed to load room %s: %v", roomCode, err)
		sendErr(c, "INTERNAL_ERROR", "failed to load room")
		return nil, false
	}
	return state, true
}

// gameErrorCode maps game-package sentinel errors to WS error codes.
func gameErrorCode(err error) string {
	switch {
	case errors.Is(err, game.ErrNotYourTurn):
		return "NOT_YOUR_TURN"
	case errors.Is(err, game.ErrInvalidPhase):
		return "INVALID_PHASE"
	case errors.Is(err, game.ErrEmptyDeck):
		return "EMPTY_DECK"
	case errors.Is(err, game.ErrInvalidCard):
		return "INVALID_CARD"
	case errors.Is(err, game.ErrInvalidSlot):
		return "INVALID_SLOT"
	default:
		return "INTERNAL_ERROR"
	}
}

// roomErrorCode maps room-package sentinel errors to WS error codes.
func roomErrorCode(err error) string {
	switch {
	case errors.Is(err, room.ErrNotHost):
		return "FORBIDDEN"
	case errors.Is(err, room.ErrGameAlreadyStarted):
		return "INVALID_PHASE"
	case errors.Is(err, room.ErrRoomNotFound):
		return "ROOM_NOT_FOUND"
	case errors.Is(err, room.ErrNotAllReady):
		return "NOT_ALL_READY"
	default:
		return "INTERNAL_ERROR"
	}
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
