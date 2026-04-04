# WordIt! Backend — Master Documentation

## Overview

The backend is the authoritative source of truth for all game logic in WordIt! (Word. Set. Go. variant). It is responsible for:

- Managing game room lifecycle (creation, joining, starting, restarting)
- Dealing and tracking cards (draw pile, discard pile, player hands)
- Enforcing turn phases and timing (server-authoritative 60-second timer)
- Validating words via a pluggable dictionary interface
- Broadcasting real-time game events to all players in a room via WebSocket

The backend is a **single Go binary** that serves both HTTP REST and WebSocket traffic.

---

## Tech Stack

| Concern              | Technology                                      |
|---------------------|-------------------------------------------------|
| Language            | Go (latest stable)                              |
| HTTP + WebSocket    | `net/http` + `gorilla/websocket` (or `nhooyr.io/websocket`) |
| HTTP Router         | `chi` (or stdlib `net/http`)                    |
| Hot game state      | Redis — active rooms, game state, session map   |
| Durable storage     | PostgreSQL — word list, future game records     |
| Word validation     | Pluggable `DictionaryChecker` interface         |

---

## Architecture Overview

The backend is a **monolith** — one process, two protocol surfaces:

```
┌─────────────────────────────────────────────────┐
│                   Go Server                     │
│                                                 │
│  ┌────────────────┐   ┌────────────────────┐   │
│  │   HTTP REST    │   │  WebSocket Hub     │   │
│  │  /rooms        │   │  /ws?roomCode=...  │   │
│  │  /rooms/:code/ │   │  &playerId=...     │   │
│  │  join          │   └────────┬───────────┘   │
│  └───────┬────────┘            │                │
│          │              Event routing            │
│          │           (lobby + game events)       │
│          └──────────────────┬──────────────────┘│
│                             │                   │
│            ┌────────────────▼──────────────┐    │
│            │          Game Engine          │    │
│            │  State machine · Turn logic   │    │
│            │  Win check · Timer goroutine  │    │
│            └──────┬────────────────┬───────┘    │
│                   │                │            │
│          ┌────────▼──┐    ┌────────▼──────┐     │
│          │   Redis   │    │  PostgreSQL   │     │
│          │ (hot state│    │ (word list +  │     │
│          │  sessions)│    │ future records│     │
│          └───────────┘    └───────────────┘     │
└─────────────────────────────────────────────────┘
```

### Key design decisions

- **Room isolation** — each room's game state is keyed by `roomCode` in Redis. Rooms do not share state.
- **In-memory connection map** — a per-process `map[playerID]*websocket.Conn` tracks live connections. On reconnect, the entry is replaced.
- **Server-authoritative timer** — a goroutine per active room ticks every second and emits `game:timer_tick`. On expiry it auto-discards the drawn card and advances the turn.
- **No optimistic updates** — clients wait for the server to confirm every card placement/move via `game:board_updated`.
- **Card privacy** — draw pile card identities are never sent to clients. Clients only receive a count (`drawPileCount`) and the top card of the discard pile.

---

## Project Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go            ← entry point; wires config, DB, Redis, router
├── internal/
│   ├── room/                  ← room creation, join, lobby state, lifecycle
│   ├── game/                  ← game state machine, turn logic, win condition check
│   ├── deck/                  ← card deck definition, shuffle, draw/discard pile ops
│   ├── dictionary/            ← DictionaryChecker interface + implementations
│   ├── ws/                    ← WebSocket hub, connection registry, broadcast helpers
│   └── store/
│       ├── postgres/          ← PostgreSQL client, schema migrations, queries
│       └── redis/             ← Redis client, GameState serialization/deserialization
├── api/
│   ├── http/                  ← REST handlers (create room, join room)
│   └── ws/                    ← WebSocket event handlers (lobby events, game events)
├── config/                    ← environment variable loading and validation
├── .env.example
├── Makefile
├── go.mod
└── go.sum
```

---

## Configuration

All configuration is loaded from environment variables at startup. A `.env.example` file in the project root documents the available keys.

| Variable           | Required | Description                                           | Default |
|--------------------|----------|-------------------------------------------------------|---------|
| `PORT`             | No       | Port the HTTP + WebSocket server listens on           | `8080`  |
| `DB_URL`           | Yes      | PostgreSQL connection string (DSN or URL format)      | —       |
| `REDIS_URL`        | Yes      | Redis connection string (e.g. `redis://localhost:6379`)| —      |
| `TURN_DURATION_MS` | No       | Duration of the arrange phase in milliseconds         | `60000` |

---

## Data Storage Design

### Redis — hot, ephemeral state

Redis holds everything that is read and written on every event during an active game.

| Key pattern                       | Type       | Contents                                               |
|-----------------------------------|------------|--------------------------------------------------------|
| `room:{roomCode}:state`           | JSON string| Full serialized `GameState`                            |
| `room:{roomCode}:draw_pile`       | List       | Ordered card IDs (top = index 0); identities hidden from clients |
| `room:{roomCode}:discard_pile`    | List       | Ordered card IDs (top = index 0)                       |
| `session:{playerId}`              | Hash       | `name`, `roomCode` — player session metadata           |

Game state is written back to Redis after every mutation. TTL is set on room keys to expire idle rooms automatically.

### PostgreSQL — durable data

| Table         | Purpose                                               |
|---------------|-------------------------------------------------------|
| `words`       | Dictionary word list — used for `IsValidWord` lookups |
| `game_records`| Completed game history (future feature)               |
| `room_log`    | Audit log of room creation and join events (optional) |

---

## REST API

All request and response bodies are JSON. No authentication headers are required — identity is established by the `playerId` returned on room create/join and passed as a WebSocket URL parameter.

### `POST /rooms`

Create a new game room. The requesting player becomes the **host**.

**Request body**
```json
{
  "name": "Alice",
  "variation": {
    "wordLengths": [3, 4, 5]
  }
}
```

**Response `200 OK`**
```json
{
  "roomCode": "XK39PQ",
  "playerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error responses**

| Status | Condition                    |
|--------|------------------------------|
| `400`  | Missing or invalid fields    |

---

### `POST /rooms/:roomCode/join`

Join an existing room.

**Request body**
```json
{
  "name": "Bob"
}
```

**Response `200 OK`**
```json
{
  "roomCode": "XK39PQ",
  "playerId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

**Error responses**

| Status | Condition                                 |
|--------|-------------------------------------------|
| `400`  | Missing or invalid fields                 |
| `404`  | Room not found                            |
| `409`  | Room is full or game already in progress  |

---

## WebSocket Protocol

### Connection

```
ws://<host>/ws?roomCode=ABC123&playerId=player_uuid
```

Both `roomCode` and `playerId` are required query parameters. The server validates them on upgrade; if invalid, it closes the connection immediately.

### Message format

All messages — in both directions — are JSON objects with the shape:

```json
{
  "event": "<event:name>",
  "payload": { ... }
}
```

`payload` may be `null` or omitted for events with no data.

---

### Lobby Events

#### Client → Server

| Event                    | Host only | Payload                        |
|--------------------------|-----------|--------------------------------|
| `lobby:join`             | No        | _(none)_                       |
| `lobby:variation_changed`| Yes       | `{ "variation": Variation }`   |
| `lobby:player_ready`     | No        | _(none)_                       |
| `lobby:start_game`       | Yes       | _(none)_                       |

#### Server → Client

| Event                    | Payload                                                                                    |
|--------------------------|--------------------------------------------------------------------------------------------|
| `lobby:state`            | `{ roomCode, hostPlayerId, variation, players: [{ id, name, isReady, isConnected }] }`    |
| `lobby:player_joined`    | `{ player: { id, name, isReady, isConnected } }`                                           |
| `lobby:player_ready`     | `{ playerId }`                                                                             |
| `lobby:variation_changed`| `{ variation }`                                                                            |
| `lobby:game_starting`    | `{ roomCode }`                                                                             |
| `lobby:restart`          | _(none)_ — host-only trigger; all clients navigate back to lobby (Play Again flow)         |

`lobby:state` is sent to a player immediately after a successful `lobby:join`, and to all players when the variation changes.

---

### Game Events

#### Client → Server

| Event             | Payload                                   | Valid phase  |
|-------------------|-------------------------------------------|--------------|
| `game:draw_card`  | `{ "source": "draw" \| "discard" }`       | `draw`       |
| `game:place_card` | `{ "cardId", "rowIndex", "slotIndex" }`   | `arrange`    |
| `game:unplace_card`| `{ "rowIndex", "slotIndex" }`            | `arrange`    |
| `game:discard_card`| `{ "cardId" }`                           | `arrange`    |

Events received outside their valid phase, or from a player who is not the current turn holder, are rejected with `game:error`.

#### Server → Client

| Event                    | Payload                                                                                                                    |
|--------------------------|----------------------------------------------------------------------------------------------------------------------------|
| `game:state`             | Full `GameState` snapshot. Sent to all players on game start and to the reconnecting player on reconnect.                  |
| `game:turn_started`      | `{ currentPlayerId, timeRemainingMs: 60000 }`                                                                              |
| `game:card_drawn`        | `{ playerId, source, card: Card \| null, drawPileCount, discardPileTop }`. `card` is `null` for non-drawing players.       |
| `game:board_updated`     | `{ playerId, wordBoard: WordBoard }`. Broadcast to **all** players after every `place` or `unplace` action.                |
| `game:timer_tick`        | `{ timeRemainingMs }`. Emitted every second during the arrange phase.                                                      |
| `game:turn_ended`        | `{ playerId, reason: "discarded" \| "timeout", discardedCard: Card, discardPileTop: Card, nextPlayerId }`                  |
| `game:player_won`        | `{ winnerId, winnerName, winningWordBoard: WordBoard }`                                                                     |
| `game:player_disconnected`| `{ playerId }`                                                                                                            |
| `game:player_reconnected` | `{ playerId }`                                                                                                            |
| `game:error`             | `{ code, message }` — sent only to the offending player.                                                                   |

#### Error codes

| Code              | Meaning                                                    |
|-------------------|------------------------------------------------------------|
| `NOT_YOUR_TURN`   | Event received from a player who is not the active player  |
| `INVALID_PHASE`   | Event received during the wrong turn phase                 |
| `INVALID_CARD`    | `cardId` does not exist in the player's hand               |
| `INVALID_SLOT`    | `rowIndex` or `slotIndex` is out of range                  |
| `ROOM_NOT_FOUND`  | WS upgrade attempted with an unknown `roomCode`            |

---

## Game State Machine

### Room phases

```
waiting ──► playing ──► finished
```

- `waiting` — Lobby. Players join and mark ready. Host selects variation.
- `playing` — Active game. Turn loop is running.
- `finished` — A player has won. Game is over. Host may trigger `lobby:restart`.

### Turn phases

```
idle ──► draw ──► arrange ──► (discard) ──► idle (next player)
                     │
                  (timeout)
                     │
                   idle (next player, drawn card auto-discarded)
```

- **`idle`** — Between turns. No events accepted.
- **`draw`** — Active player must draw exactly one card from the draw pile or discard pile. Hand size = normal + 1.
- **`arrange`** — 60-second timer is running. Active player may freely place and unplace cards. All `game:board_updated` events are broadcast.
- **`discard` / `timeout`** — Active player discards exactly one card, returning to normal hand size. If the timer expires first, the drawn card is automatically discarded.

### Rules enforced server-side

- **Turn order** — Clockwise; determined by `players[]` index order, set at game start.
- **Hand size invariant** — After the discard phase, `len(player.hand)` must equal `sum(variation.wordLengths)`.
- **Win check** — Immediately after a successful discard, the server checks whether all `WordRow.isComplete` flags are `true` for the active player. Win requires all word slots filled **and** every word validated by the dictionary **simultaneously**.
- **Draw pile exhaustion** — If the draw pile is empty when a player attempts to draw, the discard pile (excluding its top card) is shuffled and becomes the new draw pile.
- **Board validation** — `WordRow.isComplete` is computed exclusively server-side after each place/unplace action. The client never computes it.

---

## Domain Models

The Go structs map directly to the TypeScript types defined in [`docs/internal/frontend/state/game-state.md`](../frontend/state/game-state.md).

```go
type Card struct {
    ID     string // e.g. "card_042"
    Letter string // single uppercase letter, e.g. "A"
}

type WordSlot struct {
    SlotIndex int
    Card      *Card // nil if empty
}

type WordRow struct {
    TargetLength int
    Slots        []WordSlot // len == TargetLength
    IsComplete   bool       // all slots filled AND word is valid (set server-side only)
}

type WordBoard struct {
    Rows        []WordRow
    AllComplete bool // every row.IsComplete == true → triggers win check
}

type Variation struct {
    WordLengths []int // e.g. [3, 4, 5]
}

// TurnPhase represents the current phase of an active turn.
type TurnPhase string

const (
    TurnPhaseIdle    TurnPhase = "idle"
    TurnPhaseDraw    TurnPhase = "draw"
    TurnPhaseArrange TurnPhase = "arrange"
)

type Turn struct {
    CurrentPlayerID string
    Phase           TurnPhase
    TimeRemainingMs int
    DrawnCard       *Card // nil until card is drawn; excluded from hand
}

type Player struct {
    ID          string
    Name        string
    Hand        []Card // normal hand only — does not include DrawnCard
    WordBoard   WordBoard
    IsReady     bool
    IsConnected bool
}

// GamePhase represents the high-level state of a room.
type GamePhase string

const (
    GamePhaseWaiting  GamePhase = "waiting"
    GamePhasePlaying  GamePhase = "playing"
    GamePhaseFinished GamePhase = "finished"
)

type GameState struct {
    RoomCode       string
    Variation      Variation
    Players        []Player   // index order = turn order (clockwise from dealer)
    DrawPileCount  int        // card identities never revealed to clients
    DiscardPileTop *Card      // nil if discard pile is empty
    Turn           Turn
    Phase          GamePhase
    WinnerID       *string    // non-nil when Phase == GamePhaseFinished
}
```

> **Note:** `Turn.DrawnCard` is kept separate from `Player.Hand` so the server can always identify the "extra" card to auto-discard on timeout without ambiguity.

---

## Word Validation

Word validation is handled through a pluggable interface so that the backing implementation can be swapped without changing game logic.

```go
// DictionaryChecker validates whether a string is a real word.
type DictionaryChecker interface {
    IsValidWord(word string) bool
}
```

### Planned implementations

| Implementation        | Description                                                        |
|-----------------------|--------------------------------------------------------------------|
| `FileDictionary`      | Loads a flat word list (e.g. `words_alpha.txt`) into memory at startup. O(1) lookup via a `map[string]struct{}`. Suitable for local dev and self-hosted deployments. |
| `PostgresDictionary`  | Queries the `words` table in PostgreSQL. Useful if the word list needs to be updated dynamically without a redeploy. |
| `APIDictionary`       | Calls an external dictionary API (e.g. Free Dictionary API). Adds network latency; intended for future use or fallback. |

The active implementation is injected at startup via the `config` package and passed to the game engine as the `DictionaryChecker` interface.

---

## Getting Started (Local Development)

### Prerequisites

- Go 1.22 or later
- Docker and Docker Compose (for PostgreSQL and Redis)

### Setup

```bash
# 1. Clone the repository (if not already done)
git clone https://github.com/sras1599/wordit.git
cd wordit/backend

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env with your local DB_URL and REDIS_URL if needed

# 3. Start PostgreSQL and Redis
docker compose up -d

# 4. Run the server
go run ./cmd/server
```

The server listens on `http://localhost:8080` by default.

### Makefile targets

| Target          | Description                              |
|-----------------|------------------------------------------|
| `make run`      | Run the server directly via `go run`     |
| `make build`    | Compile to `bin/server`                  |
| `make test`     | Run all tests                            |
| `make lint`     | Run `golangci-lint`                      |
| `make migrate`  | Apply pending PostgreSQL migrations      |
