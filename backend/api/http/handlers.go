package http

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/sras1599/wordit/backend/internal/room"
)

func RegisterRoutes(mux *http.ServeMux, store *room.Store) {
	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/rooms", func(w http.ResponseWriter, r *http.Request) {
		handleCreateRoom(w, r, store)
	})
	mux.HandleFunc("/rooms/", func(w http.ResponseWriter, r *http.Request) {
		handleJoinRoom(w, r, store)
	})
}

func CORSMiddleware(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleCreateRoom(w http.ResponseWriter, r *http.Request, store *room.Store) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var body struct {
		Name      string `json:"name"`
		Variation struct {
			WordLengths []int `json:"wordLengths"`
		} `json:"variation"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if strings.TrimSpace(body.Name) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}
	if len(body.Variation.WordLengths) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "variation.wordLengths is required and must not be empty"})
		return
	}

	roomCode, playerID, err := room.Create(store, body.Name, room.Variation{WordLengths: body.Variation.WordLengths})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create room"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"roomCode": roomCode,
		"playerId": playerID,
	})
}

func handleJoinRoom(w http.ResponseWriter, r *http.Request, store *room.Store) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) != 3 || parts[0] != "rooms" || parts[2] != "join" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "route not found"})
		return
	}

	writeJSON(w, http.StatusNotImplemented, map[string]string{
		"message":  "room join is scaffolded but not implemented yet",
		"roomCode": parts[1],
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
