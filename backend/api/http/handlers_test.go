package http

import (
	"encoding/json"
	"errors"
	nethttp "net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/sras1599/wordit/backend/config"
	"github.com/sras1599/wordit/backend/internal/room"
	"github.com/sras1599/wordit/backend/internal/storage/memory"
)

type failingGetStore struct {
	room.Store
}

func (f failingGetStore) Get(string) (*room.GameState, error) {
	return nil, errors.New("storage unavailable")
}

func TestCreateRoom(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantError  string
	}{
		{
			name:       "valid name",
			body:       `{"name":"Alice"}`,
			wantStatus: nethttp.StatusOK,
		},
		{
			name:       "invalid JSON",
			body:       `{`,
			wantStatus: nethttp.StatusBadRequest,
			wantError:  "invalid JSON",
		},
		{
			name:       "blank name",
			body:       `{"name":"   "}`,
			wantStatus: nethttp.StatusBadRequest,
			wantError:  "name is required",
		},
		{
			name:       "ignores client supplied settings",
			body:       `{"name":"Alice","variation":{"wordLengths":[9,9]},"turnDurationMs":1000}`,
			wantStatus: nethttp.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := memory.NewStore()
			mux := nethttp.NewServeMux()
			RegisterRoutes(mux, store)

			req := httptest.NewRequest(nethttp.MethodPost, "/rooms", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}

			var body map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode response: %v", err)
			}

			if tt.wantError != "" {
				if got := body["error"]; got != tt.wantError {
					t.Fatalf("error = %q, want %q", got, tt.wantError)
				}
				return
			}

			roomCode := body["roomCode"]
			if roomCode == "" {
				t.Fatal("roomCode is empty")
			}
			if body["playerId"] == "" {
				t.Fatal("playerId is empty")
			}

			state, err := store.Get(roomCode)
			if err != nil {
				t.Fatalf("get created room: %v", err)
			}
			if !slices.Equal(state.Variation.WordLengths, config.Cfg.DefaultWordLengths) {
				t.Fatalf("word lengths = %v, want %v", state.Variation.WordLengths, config.Cfg.DefaultWordLengths)
			}
			if state.TurnDurationMs != config.Cfg.TurnDurationMS {
				t.Fatalf("turn duration = %d, want %d", state.TurnDurationMs, config.Cfg.TurnDurationMS)
			}
		})
	}
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
