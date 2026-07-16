# Backend Architecture

## Overview

The backend is the authoritative source of truth for all game logic in WordIt! (Word. Set. Go. variant). It is responsible for:

- Managing game room lifecycle (creation, joining, starting, restarting)
- Dealing and tracking cards (draw pile, discard pile, player hands)
- Enforcing turn phases and timing (server-authoritative 60-second timer)
- Validating words via a pluggable dictionary interface
- Broadcasting real-time game events to all players in a room via WebSocket

The backend is a single Go binary that serves both HTTP REST and WebSocket traffic.

## Tech Stack

| Concern              | Technology                                      |
|---------------------|-------------------------------------------------|
| Language            | Go (latest stable)                              |
| HTTP + WebSocket    | `net/http` + `gorilla/websocket` (or `nhooyr.io/websocket`) |
| HTTP Router         | `chi` (or stdlib `net/http`)                    |
| Hot game state      | In-memory map — active rooms, game state, session map |
| Durable storage     | PostgreSQL — word list, future game records          |
| Word validation     | Pluggable `DictionaryChecker` interface         |

## Architecture Overview

The backend is a monolith: one process, two protocol surfaces.

```
┌─────────────────────────────────────────────────┐
│                   Go Server                     │
│                                                 │
│  ┌────────────────┐   ┌────────────────────┐    │
│  │   HTTP REST    │   │  WebSocket Hub     │    │
│  │  /rooms        │   │  /ws?roomCode=...  │    │
│  │  /rooms/:code/ │   │  &playerId=...     │──┐ │
│  │  join          │   └────────┬───────────┘  │ │
│  └───────┬────────┘            │              │ │
│          │              Event routing         │ │
│          │           (lobby + game events)    │ │
│          └──────────────────┬─────────────────┘ │
│                             │                   │
│            ┌────────────────▼──────────────┐    │
│            │          Game Engine          │    │
│            │  State machine · Turn logic   │    │
│            │  Win check · Timer goroutine  │    │
│            └──────┬────────────────┬───────┘    │
│                   │                │            │
│          ┌────────────▼──┐  ┌────────▼──────┐     │
│          │  In-Memory    │  │  PostgreSQL   │     │
│          │  Store        │  │ (word list +  │     │
│          │ (rooms/state) │  │ future records│     │
│          └───────────────┘  └───────────────┘     │
└─────────────────────────────────────────────────┘
```

## Key Design Decisions

- Room isolation: each room's game state is keyed by `roomCode` in an in-memory map. Rooms do not share state.
- In-memory connection map: a per-process `map[playerID]*websocket.Conn` tracks live connections. On reconnect, the entry is replaced.
- Server-authoritative timer: each active turn has a persisted wall-clock deadline and revision sequence. A goroutine per active room checks expiry every second without decrementing stored state; expired actions are rejected and reconciled immediately.
- Optimistic client updates: clients may immediately reflect safe public actions, then reconcile with authoritative `game:board_updated`, `game:turn_ended`, or `game:state` events. Draw-pile card identity remains server-owned.
- Card privacy: draw pile card identities are never sent to clients. Clients only receive a count (`drawPileCount`) and the top card of the discard pile.

## Project Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go            ← entry point; wires config, DB, in-memory store, router
├── internal/
│   ├── room/                  ← room creation, join, lobby state, lifecycle
│   ├── game/                  ← game state machine, turn logic, win condition check
│   ├── deck/                  ← card deck definition, shuffle, draw/discard pile ops
│   ├── dictionary/            ← DictionaryChecker interface + implementations
│   ├── ws/                    ← WebSocket hub, connection registry, broadcast helpers
│   └── store/
│       ├── postgres/          ← PostgreSQL client, schema migrations, queries
│       └── memory/            ← In-memory RoomStore implementation (sync.RWMutex-guarded map)
├── api/
│   ├── http/                  ← REST handlers (create room, join room)
│   └── ws/                    ← WebSocket event handlers (lobby events, game events)
├── config/                    ← environment variable loading and validation
├── .env.example
├── Makefile
├── go.mod
└── go.sum
```
