package http

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sras1599/wordit/backend/config"
	"github.com/sras1599/wordit/backend/internal/room"
)

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func RegisterRoutes(mux *http.ServeMux, store room.Store) {
	mux.HandleFunc("/healthz", handleHealth)

	mux.HandleFunc("POST /rooms", func(w http.ResponseWriter, r *http.Request) {
		handleCreateRoom(w, r, store)
	})
	mux.HandleFunc("/rooms", handleMethodNotAllowed)

	mux.HandleFunc("GET /rooms/{roomCode}", func(w http.ResponseWriter, r *http.Request) {
		handleGetRoom(w, r, store)
	})
	mux.HandleFunc("/rooms/{roomCode}", handleMethodNotAllowed)

	mux.HandleFunc("POST /rooms/{roomCode}/join", func(w http.ResponseWriter, r *http.Request) {
		handleJoinRoom(w, r, store)
	})
	mux.HandleFunc("/rooms/{roomCode}/join", handleMethodNotAllowed)
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

func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)
		slog.Info("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rw.statusCode,
			"latency_ms", time.Since(start).Milliseconds(),
		)
	})
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleMethodNotAllowed(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
}

func handleCreateRoom(w http.ResponseWriter, r *http.Request, store room.Store) {
	var body struct {
		Name      string `json:"name"`
		Variation struct {
			WordLengths []int `json:"wordLengths"`
		} `json:"variation"`
		TurnDurationMs int `json:"turnDurationMs"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if strings.TrimSpace(body.Name) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	wordLengths := body.Variation.WordLengths
	if len(wordLengths) == 0 {
		wordLengths = config.Cfg.DefaultWordLengths
	}

	turnDurationMs := body.TurnDurationMs
	if turnDurationMs <= 0 {
		turnDurationMs = config.Cfg.TurnDurationMS
	}

	roomCode, playerID, err := room.Create(store, body.Name, room.Variation{WordLengths: wordLengths}, turnDurationMs)
	if err != nil {
		slog.Error("create room: storage error", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create room"})
		return
	}

	slog.Info("room created", "roomCode", roomCode, "player", fmt.Sprintf("%s (%s)", playerID, body.Name))

	writeJSON(w, http.StatusOK, map[string]string{
		"roomCode": roomCode,
		"playerId": playerID,
	})
}

func handleGetRoom(w http.ResponseWriter, r *http.Request, store room.Store) {
	roomCode := r.PathValue("roomCode")
	state, err := store.Get(roomCode)

	if errors.Is(err, room.ErrRoomNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "room not found"})
		return
	}

	if err != nil {
		slog.Error("get room: storage error", "roomCode", roomCode, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load room"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"roomCode": state.RoomCode})
}

func handleJoinRoom(w http.ResponseWriter, r *http.Request, store room.Store) {
	roomCode := r.PathValue("roomCode")

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	playerID, err := room.Join(store, roomCode, strings.TrimSpace(body.Name))
	if errors.Is(err, room.ErrRoomNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "room not found"})
		return
	}
	if errors.Is(err, room.ErrPlayerDuplicate) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "a player with that name is already in the room"})
		return
	}
	if err != nil {
		slog.Error("join room: storage error", "roomCode", roomCode, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to join room"})
		return
	}

	slog.Info("player joined room", "roomCode", roomCode, "player", fmt.Sprintf("%s (%s)", playerID, strings.TrimSpace(body.Name)))

	writeJSON(w, http.StatusOK, map[string]string{
		"roomCode": roomCode,
		"playerId": playerID,
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
