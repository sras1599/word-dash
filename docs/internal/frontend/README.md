# WordIt! Frontend Documentation

This directory contains the frontend design specification for the WordIt! web app, covering the **Word. Set. Go.** variant only.

---

## Tech Stack

| Concern         | Choice                                  |
|-----------------|-----------------------------------------|
| Framework       | React 18 + TypeScript                   |
| Routing         | React Router v6                         |
| Real-time       | WebSocket (native browser API or socket.io-client) |
| Styling         | TBD (CSS Modules recommended)           |
| Drag & Drop     | TBD (react-dnd or native HTML5 DnD)     |
| State           | React Context + useReducer (see below)  |
| Build           | Vite                                    |

---

## Pages

| Route             | Page        | Description                                 |
|-------------------|-------------|---------------------------------------------|
| `/`               | Home        | Landing page — create or join a game        |
| `/lobby/:roomCode`| Lobby       | Pre-game room — configure, ready up, start  |
| `/game/:roomCode` | Game        | Main gameplay view (includes win overlay)   |

See `pages/` for individual page specs.

---

## Real-time Architecture

The game is fully real-time. All game state lives on the server. The client receives state updates via WebSocket events and renders accordingly.

```
Browser (React app)
     │
     │  WebSocket
     │
Server (game state engine)
```

- On joining a game room, the client opens a WebSocket connection identified by the `roomCode` and `playerId`.
- The server is the single source of truth — clients never mutate game state locally; they only dispatch actions.
- The client's real-time layer dispatches incoming server events into the React `GameContext` reducer.
- All game events are namespaced (for example, `game:card_drawn` and `game:turn_ended`). See `realtime/events.md`.

---

## State Management

A single `GameContext` wraps the `/game` route and holds the full `GameState` for the active session.

```
GameContext (useReducer)
├── GameState (received from server)
├── dispatch(action) — fires a WebSocket message to the server, not local mutation
└── localPlayerId — derived from auth/session
```

State shape is defined in `state/game-state.md`.

Players on the lobby and home pages are handled with local `useState` (no shared context needed).

---

## Visual Design Notes

Based on the physical game:
- **Brand colors:** Red (`#E8271B`) and teal/green (`#2DB89C`) are the primary palette. Off-white for card faces.
- **Cards** have a bold, playful font for letters on the face side. The back side shows the WordIt! logo pattern.
- **Typography:** Display font for the WordIt! logo; clean sans-serif for UI.
- **Layout:** Desktop-first. The game board should fit in a single viewport without scrolling during play.

---

## Directory Structure

```
frontend/
├── README.md          ← this file
├── pages/
│   ├── home.md
│   ├── lobby.md
│   └── game.md
├── components/
│   ├── Card.md
│   ├── CardPile.md
│   ├── PlayerHand.md
│   ├── WordSlot.md
│   ├── WordRow.md
│   ├── WordBoard.md
│   ├── GameHud.md
│   ├── TurnIndicator.md
│   ├── OpponentStatus.md
│   └── GameBoard.md
├── state/
│   └── game-state.md
└── realtime/
    └── events.md
```
