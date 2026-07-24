# Page: Lobby

**Route:** `/lobby/:roomCode`

---

## Purpose

Pre-game room where players gather and the host configures and starts the game. The host is the player who created the room.

---

## Layout

```
┌─────────────────────────────────────────────────┐
│  WordIt!                            Room: ABC123 │
│                                  [Copy link 🔗]  │
├─────────────────────────────────────────────────┤
│                                                  │
│  Game Settings (host only — read-only for guests)│
│  ┌─────────────────────────────────────────────┐ │
│  │  Variation:  [3] [4] [5]  (+) (-)           │ │
│  │  (word lengths configured here)             │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  Players (2–4)                                   │
│  ┌───────────────────┐  ┌───────────────────┐    │
│  │ 👤 Alice  (Host)  │  │ 👤 Bob            │    │
│  └───────────────────┘  └───────────────────┘    │
│  ┌───────────────────┐  ┌───────────────────┐    │
│  │ 👤 [Waiting...]  │  │ 👤 [Waiting...]  │    │
│  └───────────────────┘  └───────────────────┘    │
│                                                  │
│                           (host only) [Start →]│
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Interactions

| Trigger                                  | Behaviour                                                                                                            |
|------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Page load                                | Validates that the room exists, then opens a WebSocket connection and receives the current lobby state.              |
| Room does not exist                      | Shows a room-not-found message with a button that returns the user to the home page.                                 |
| Host changes variation                   | Sends `lobby:variation_changed` event. All clients receive the update and re-render the settings panel.              |
| Click **Copy Room Code**                 | Copies the room code to clipboard.                                                                                   |
| Host clicks **Start** (enabled with ≥2 players) | Sends `lobby:start_game`. All clients navigate to `/game/:roomCode`.                                  |
| A new player joins                       | Their card appears in an empty player slot in real time.                                                             |
| A player disconnects in lobby            | Their slot shows as disconnected; they can rejoin before the game starts.                                            |

---

## Data Needed

From server (via WebSocket `lobby:state` event on connect and on each change):

```ts
type LobbyState = {
  roomCode: string;
  hostPlayerId: string;
  variation: Variation;       // see state/game-state.md
  players: Pick<Player, 'id' | 'name' | 'isConnected'>[];
};
```

- `localPlayerId` — from session context, to know if this client is the host.
- The **Start** button is only active when `players.length >= 2`; the server enforces the same minimum.

---

## Key Behaviours

- The variation editor lets the host add/remove word lengths (minimum 2 lengths, maximum 4). Default is `[3, 4, 5]`.
- Maximum 4 players per room. Slots beyond the current player count are shown as empty placeholders.
- Non-host players see the variation as read-only text, not editable controls.
