package http

import (
	"encoding/json"
	"net/http"
	"strings"
)

func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/rooms", handleCreateRoom)
	mux.HandleFunc("/rooms/", handleJoinRoom)
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	writeJSON(w, http.StatusNotImplemented, map[string]string{
		"message": "room creation is scaffolded but not implemented yet",
	})
}

func handleJoinRoom(w http.ResponseWriter, r *http.Request) {
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
