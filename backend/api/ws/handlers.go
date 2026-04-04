package ws

import (
	"net/http"

	internalws "github.com/sras1599/wordit/backend/internal/ws"
)

func RegisterRoutes(mux *http.ServeMux, hub *internalws.Hub) {
	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/ws", hub.ServeWS)
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}
