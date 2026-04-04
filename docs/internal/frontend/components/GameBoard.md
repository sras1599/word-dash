# Component: GameBoard

---
## Purpose


The top-level layout component for the game screen. Assembles all gameplay sub-components into a single viewport-filling layout. Manages the overall spatial arrangement and passes the relevant slice of `GameState` down to each child component.

---

## Layout

```
┌────────────────────────────────────────────────────────────┐
│ Header: WordIt! logo      TurnIndicator      TurnTimer      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Opponents band                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  OpponentStatus   OpponentStatus   OpponentStatus   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Card piles (centre)                                       │
│      ┌──────────┐              ┌──────────┐               │
│      │ DrawPile │              │Discard   │               │
│      └──────────┘              └──────────┘               │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Local player area                                         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    WordBoard                        │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    PlayerHand                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Props / Data Needed

`GameBoard` reads directly from `GameContext` — it does not accept most game state as props, since it is always rendered inside the `GameContext` provider.

| Prop / Context          | Source                   | Description                                                    |
|-------------------------|--------------------------|----------------------------------------------------------------|
| `gameState`             | `GameContext`            | Full `GameState` (see `state/game-state.md`).                  |
| `localPlayerId`         | Session context          | Identifies which player is "local".                            |

---

## Interactions

`GameBoard` owns all dispatching to the server. Each child component fires callbacks; `GameBoard` translates them into WebSocket messages:

| Child callback                           | WebSocket event dispatched                          |
|------------------------------------------|-----------------------------------------------------|
| `CardPile.onDraw(source)`                | `game:draw_card { source }`                         |
| `WordSlot.onPlace(cardId, row, slot)`    | `game:place_card { cardId, rowIndex, slotIndex }`   |
| `WordSlot.onUnplace(row, slot)`          | `game:unplace_card { rowIndex, slotIndex }`         |
| `CardPile.onDiscard(cardId)`             | `game:discard_card { cardId }`                      |
| `PlayerHand.onDiscard(cardId)`           | `game:discard_card { cardId }`                      |

---

## Key Behaviours

- `GameBoard` derives the local player and opponent players from `gameState.players` and `localPlayerId` once, and passes the relevant slice to each child.
- The "is active turn" flag passed to children is computed as `gameState.turn.currentPlayerId === localPlayerId`.
- The "is arrange phase" flag is `isActiveTurn && gameState.turn.phase === 'arrange'`.
- The component is purely a layout/orchestration layer — no game logic lives here beyond deriving these flags and routing callbacks to WebSocket events.
- On the "draw phase", only `CardPile` is interactive. On the "arrange phase", `PlayerHand`, `WordBoard`/`WordSlot`, and `CardPile` (for discard) are interactive.
