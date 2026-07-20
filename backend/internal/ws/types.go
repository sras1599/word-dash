// This file defines the JSON request and event payload types for WebSockets.
package ws

import "encoding/json"

// incomingMessage is the wire format for all client→server messages.
type incomingMessage struct {
	Event   string          `json:"event"`
	Payload json.RawMessage `json:"payload"`
}

// outgoingMessage is the wire format for all server→client messages.
type outgoingMessage struct {
	Event   string         `json:"event"`
	Payload any            `json:"payload"`
	Meta    *gameEventMeta `json:"meta,omitempty"`
}

type gameErrorPayload struct {
	Code           string `json:"code"`
	Message        string `json:"message"`
	ClientActionID string `json:"clientActionId,omitempty"`
}

type gameEventMeta struct {
	ServerNowMs int64         `json:"serverNowMs"`
	Turn        *turnMetaJSON `json:"turn"`
}

type turnMetaJSON struct {
	Sequence   uint64 `json:"sequence"`
	EndsAtMs   int64  `json:"endsAtMs"`
	DurationMs int    `json:"durationMs"`
}

// --- Shared ---

type variationJSON struct {
	WordLengths []int `json:"wordLengths"`
}

type cardJSON struct {
	ID     string `json:"id"`
	Letter string `json:"letter"`
}

// --- Lobby ---

type lobbyPlayerJSON struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	IsReady     bool   `json:"isReady"`
	IsConnected bool   `json:"isConnected"`
}

type lobbyStatePayload struct {
	RoomCode       string            `json:"roomCode"`
	HostPlayerID   string            `json:"hostPlayerId"`
	Variation      variationJSON     `json:"variation"`
	TurnDurationMs int               `json:"turnDurationMs"`
	Players        []lobbyPlayerJSON `json:"players"`
}

type lobbyPlayerJoinedPayload struct {
	Player lobbyPlayerJSON `json:"player"`
}

type lobbyPlayerReadyPayload struct {
	PlayerID string `json:"playerId"`
}

type lobbyPlayerUnreadyPayload struct {
	PlayerID string `json:"playerId"`
}

type lobbyPlayerDisconnectedPayload struct {
	PlayerID     string `json:"playerId"`
	HostPlayerID string `json:"hostPlayerId"`
}

type lobbySettingsChangedPayload struct {
	Variation      variationJSON `json:"variation"`
	TurnDurationMs int           `json:"turnDurationMs"`
}

type lobbySettingsChangedRequest struct {
	Variation      variationJSON `json:"variation"`
	TurnDurationMs int           `json:"turnDurationMs"`
}

// --- Game board ---

type wordSlotJSON struct {
	SlotIndex int       `json:"slotIndex"`
	Card      *cardJSON `json:"card"`
}

type wordRowJSON struct {
	TargetLength int            `json:"targetLength"`
	Slots        []wordSlotJSON `json:"slots"`
	IsComplete   bool           `json:"isComplete"`
}

type wordBoardJSON struct {
	Rows        []wordRowJSON `json:"rows"`
	AllComplete bool          `json:"allComplete"`
}

type gamePlayerJSON struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	HandCount     int           `json:"handCount"`
	Hand          []cardJSON    `json:"hand,omitempty"`
	WordBoard     wordBoardJSON `json:"wordBoard"`
	BoardRevision uint64        `json:"boardRevision"`
	IsReady       bool          `json:"isReady"`
	IsConnected   bool          `json:"isConnected"`
}

type turnJSON struct {
	CurrentPlayerID string    `json:"currentPlayerId"`
	Phase           string    `json:"phase"`
	DrawnCard       *cardJSON `json:"drawnCard"`
}

type gameStatePayload struct {
	RoomCode       string           `json:"roomCode"`
	HostPlayerID   string           `json:"hostPlayerId"`
	Variation      variationJSON    `json:"variation"`
	Players        []gamePlayerJSON `json:"players"`
	DrawPileCount  int              `json:"drawPileCount"`
	DiscardPileTop *cardJSON        `json:"discardPileTop"`
	Turn           turnJSON         `json:"turn"`
	Phase          string           `json:"phase"`
	WinnerID       *string          `json:"winnerId"`
}

// --- Game events ---

type playerEventPayload struct {
	PlayerID string `json:"playerId"`
}

type turnSkippedPayload struct {
	PlayerID     string `json:"playerId"`
	Reason       string `json:"reason"`
	NextPlayerID string `json:"nextPlayerId"`
}

type boardUpdatedPayload struct {
	PlayerID       string        `json:"playerId"`
	WordBoard      wordBoardJSON `json:"wordBoard"`
	HandCount      int           `json:"handCount"`
	Hand           []cardJSON    `json:"hand,omitempty"`
	BoardRevision  uint64        `json:"boardRevision"`
	ClientActionID string        `json:"clientActionId,omitempty"`
}

type turnEndedPayload struct {
	PlayerID       string   `json:"playerId"`
	Reason         string   `json:"reason"`
	DiscardedCard  cardJSON `json:"discardedCard"`
	DiscardPileTop cardJSON `json:"discardPileTop"`
	NextPlayerID   string   `json:"nextPlayerId"`
}

type playerWonPayload struct {
	WinnerID         string        `json:"winnerId"`
	WinnerName       string        `json:"winnerName"`
	WinningWordBoard wordBoardJSON `json:"winningWordBoard"`
}

// --- Requests ---

type drawCardRequest struct {
	Source string `json:"source"`
}

type cardDrawnPayload struct {
	PlayerID       string    `json:"playerId"`
	Source         string    `json:"source"`
	Card           *cardJSON `json:"card"`
	DrawPileCount  int       `json:"drawPileCount"`
	DiscardPileTop *cardJSON `json:"discardPileTop"`
}

type placeCardRequest struct {
	CardID         string `json:"cardId"`
	RowIndex       int    `json:"rowIndex"`
	SlotIndex      int    `json:"slotIndex"`
	ClientActionID string `json:"clientActionId,omitempty"`
}

type unplaceCardRequest struct {
	RowIndex       int    `json:"rowIndex"`
	SlotIndex      int    `json:"slotIndex"`
	ClientActionID string `json:"clientActionId,omitempty"`
}

type clearWordRequest struct {
	RowIndex       int    `json:"rowIndex"`
	ClientActionID string `json:"clientActionId,omitempty"`
}

type clearBoardRequest struct {
	ClientActionID string `json:"clientActionId,omitempty"`
}

type discardCardRequest struct {
	CardID         string `json:"cardId"`
	ClientActionID string `json:"clientActionId,omitempty"`
}
