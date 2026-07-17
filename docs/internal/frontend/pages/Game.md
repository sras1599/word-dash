# Page: Game

**Route:** `/game/:roomCode`

---

## Purpose

The main gameplay screen for the Word. Set. Go. variant. All active game interaction happens here. The layout keeps the local player's board front-and-centre while showing opponents' status in a sidebar or header band.

---

## Layout

```
┌────────────────────────────────────────────────────────────┐
│  GameTopBar: WordIt! (Home)                                 │
├────────────────────────────────────────────────────────────┤
│                                              ┌─────────────┐│
│  Opponents band (top)                       │ Turn rail   ││
│  ┌──────────────┐  ┌──────────────┐         │ Instruction ││
│  │ OpponentStatus│  │ OpponentStatus│         │ Timer       ││
│  └──────────────┘  └──────────────┘         └─────────────┘│
│                                                             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Centre — Card piles                                        │
│      [DrawPile]          [DiscardPile]                      │
│                                                             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Local player area                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    WordBoard                         │  │
│  │  (WordRow for each target word)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    PlayerHand                        │  │
│  │  (draggable cards)                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Sub-views / States

The game page has distinct visual states driven by `GameState.turn.phase` and `GameState.localPlayerId`:

### It is the local player's turn — Draw phase
- Draw pile and discard pile are visually highlighted/active (glowing border or prompt label "Draw a card").
- The player must click one of the two piles to draw before the arrange phase begins.

### It is the local player's turn — Arrange phase
- Turn timer is running and prominently displayed.
- Player's hand cards are draggable.
- Word board slots are active drop targets.
- The drawn card is visually distinguished (e.g. subtle teal outline) so the player knows which card is the "extra" one they must eventually discard.
- A **Discard** action is available: player can drag any card to the discard pile, or select one and press `Shift+D`.
- When the player successfully discards one card, the arrange phase ends and the turn passes.

### It is another player's turn
- The local player can continue arranging their own hand and word board.
- Draw pile and discard pile are inactive.
- `GameHud` names the active player and explains that local arrangement remains available.
- `GameHud` continues to show that player's remaining time.

### Win condition met — Win Overlay
- A full-screen overlay appears on top of the game board without a route change (see **Win Overlay** section below).
- All game interactions are disabled beneath the overlay.

---

## Interactions

| Trigger                                     | Behaviour                                                                                          |
|---------------------------------------------|-----------------------------------------------------------------------------------------------------|
| Click draw pile (local player's turn)       | Sends `game:draw_card { source: 'draw' }`. Server responds with the drawn card; it appears in hand.|
| Click discard pile (local player's turn)    | Top card moves into hand optimistically, then `game:card_drawn` reconciles pile and timer state.   |
| Drag card from hand → WordSlot              | Card is placed optimistically, then `game:board_updated` reconciles board and hand state.          |
| Drag card from WordSlot → occupied WordSlot | Board cards swap slots optimistically, then `game:board_updated` reconciles board and hand state. |
| Drag card from WordSlot → hand              | Card returns to hand optimistically, then `game:board_updated` reconciles board and hand state.    |
| Drag card from hand → discard pile          | Card is discarded optimistically, local turn advances, then `game:turn_ended` reconciles state.    |
| `Shift+D` with card selected                | Same as drag to discard pile during arrange phase.                                                 |
| Turn timer reaches zero (server-side)       | Server auto-discards drawn card, broadcasts `game:turn_ended`. `TurnIndicator` and hand update.   |
| Any player arranges complete valid words    | Server broadcasts `game:player_won`. Win overlay appears over the game board. No route change.     |

---

## Data Needed

- Full `GameState` from `GameContext` (see `state/game-state.md`).
- `localPlayerId` from session context — used to determine which player's hand/board to render as interactive.
- Opponent players derived as `GameState.players.filter(p => p.id !== localPlayerId)`.

---

## Win Overlay

Shown in-place over the game board when `GameState.phase === 'finished'`. The WebSocket connection and `GameContext` remain alive — no route transition occurs.

### Layout

```
┌──────────────────────────────────────────────┐
│  (dimmed game board behind)                  │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │        🏆  Alice wins!               │   │
│  │                                      │   │
│  │  Words formed:                       │   │
│  │  ┌───────┐  ┌────────┐  ┌────────┐  │   │
│  │  │ C A T │  │ W O R D│  │ P L A  │  │   │
│  │  └───────┘  └────────┘  │ N E T  │  │   │
│  │                          └────────┘  │   │
│  │                                      │   │
│  │      [Play Again]      [Home]        │   │
│  └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

The winning words are rendered as read-only `WordRow` components, keeping the visual language consistent with the active game.

### Interactions

| Trigger                  | Behaviour                                                                                                              |
|--------------------------|------------------------------------------------------------------------------------------------------------------------|
| Overlay appears          | Game board dims. Overlay fades/scales in. All game input is blocked.                                                  |
| Click **Play Again**     | Host-only. Sends `lobby:restart` — all clients navigate to `/lobby/:roomCode` with existing players and the same room code. Button is hidden for non-hosts. |
| Click **Home**           | Closes the WebSocket connection. Navigates to `/`.                                                                     |

### Data Needed

| Field                       | Usage                                                            |
|-----------------------------|------------------------------------------------------------------|
| `GameState.winnerId`        | Look up the winner in `players[]`                                |
| `winner.name`               | Display winner's name in the heading                             |
| `winner.wordBoard.rows`     | Render the winning words as read-only `WordRow` components       |
| `localPlayerId`             | Show/hide the **Play Again** button (host only)                  |

### Key Behaviours

- The overlay is triggered solely by `GameState.phase === 'finished'` — no separate route or navigation.
- The game board remains visible and dimmed behind the overlay so players can see their state at the moment of the win.
- **Play Again** is only visible to the host (`localPlayerId === GameState.hostPlayerId`). All other players see only **Home**.
