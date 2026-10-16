package ws

import (
	"net/http"

	internalws "github.com/sras1599/wordit/backend/internal/ws"
)

func RegisterRoutes(mux *http.ServeMux, hub *internalws.Hub) {
	mux.HandleFunc("/ws", hub.ServeWS)
}
