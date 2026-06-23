package http

import (
	"encoding/json"
	"errors"
	nethttp "net/http"
	"net/http/httptest"
	"testing"

	"github.com/sras1599/wordit/backend/internal/room"
	"github.com/sras1599/wordit/backend/internal/storage/memory"
)

type failingGetStore struct {
	room.Store
}

func (f failingGetStore) Get(string) (*room.GameState, error) {
	return nil, errors.New("storage unavailable")
}

func TestGetRoom(t *testing.T) {
	store := memory.NewStore()
	if err := store.Put(&room.GameState{RoomCode: "ABC123"}); err != nil {
		t.Fatalf("seed room: %v", err)
	}

	tests := []struct {
		name       string
		method     string
		path       string
		store      room.Store
		wantStatus int
		wantBody   map[string]string
	}{
		{
			name:       "existing room",
			method:     nethttp.MethodGet,
			path:       "/rooms/ABC123",
			store:      store,
			wantStatus: nethttp.StatusOK,
			wantBody:   map[string]string{"roomCode": "ABC123"},
		},
		{
			name:       "missing room",
			method:     nethttp.MethodGet,
			path:       "/rooms/MISSING",
			store:      store,
			wantStatus: nethttp.StatusNotFound,
			wantBody:   map[string]string{"error": "room not found"},
		},
		{
			name:       "invalid method",
			method:     nethttp.MethodPost,
			path:       "/rooms/ABC123",
			store:      store,
			wantStatus: nethttp.StatusMethodNotAllowed,
			wantBody:   map[string]string{"error": "method not allowed"},
		},
		{
			name:       "storage failure",
			method:     nethttp.MethodGet,
			path:       "/rooms/ABC123",
			store:      failingGetStore{},
			wantStatus: nethttp.StatusInternalServerError,
			wantBody:   map[string]string{"error": "failed to load room"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mux := nethttp.NewServeMux()
			RegisterRoutes(mux, tt.store)

			req := httptest.NewRequest(tt.method, tt.path, nil)
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}

			var body map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			for key, want := range tt.wantBody {
				if got := body[key]; got != want {
					t.Errorf("body[%q] = %q, want %q", key, got, want)
				}
			}
		})
	}
}
