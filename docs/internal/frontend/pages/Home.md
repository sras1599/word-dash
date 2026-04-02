# Page: Home

**Route:** `/`

---

## Purpose

The landing page. Entry point for all players. Users either create a new game room or join an existing one using a room code.

---

## Layout

```
┌────────────────────────────────────┐
│                                    │
│          WordIt!  logo             │
│        "Fun With Words"            │
│                                    │
│   ┌──────────────┐  ┌───────────┐  │
│   │  Create Game │  │ Join Game │  │
│   └──────────────┘  └───────────┘  │
│                                    │
│   [Join panel — shown when         │
│    "Join Game" is clicked]         │
│   ┌────────────────────────────┐   │
│   │  Your name: [__________]  │   │
│   │  Room code: [__________]  │   │
│   │           [Join →]        │   │
│   └────────────────────────────┘   │
│                                    │
└────────────────────────────────────┘
```

The "Create Game" flow also collects the player's name before redirecting to the lobby.

---

## Interactions

| Trigger                         | Behaviour                                                                                                  |
|----------------------------------|-----------------------------------------------------------------------------------------------------------|
| Click **Create Game**           | Expands a small form to collect the player's name. On submit, calls the server to create a new room, then navigates to `/lobby/:roomCode`. |
| Click **Join Game**             | Expands a form with fields for name + room code. On submit, calls the server to join the room, then navigates to `/lobby/:roomCode`. |
| Invalid room code on join       | Inline error message below the room code field. No navigation.                                             |
| Submit with empty name          | Inline validation error — name is required.                                                                |

---

## Data Needed

- No shared state required — this page uses local `useState` only.
- On successful create/join, the server returns the `roomCode` and a `playerId` (stored in session or context for the rest of the session).
