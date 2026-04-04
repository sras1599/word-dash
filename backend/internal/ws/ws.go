package ws

import (
	"encoding/json"
	"net/http"
)

type Hub struct{}

func NewHub() *Hub {
	return &Hub{}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	roomCode := r.URL.Query().Get("roomCode")
	playerID := r.URL.Query().Get("playerId")
	if roomCode == "" || playerID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "missing required query params: roomCode and playerId",
		})
		return
	}

	writeJSON(w, http.StatusNotImplemented, map[string]string{
		"message":  "websocket hub is scaffolded but upgrade handling is not implemented yet",
		"roomCode": roomCode,
		"playerId": playerID,
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
