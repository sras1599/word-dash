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

`GameBoard` owns user interaction callbacks. The game state layer applies safe optimistic updates for public/local card moves, then sends the same WebSocket events so the next authoritative server event reconciles exact state:

| Child callback                           | WebSocket event dispatched                          |
|------------------------------------------|-----------------------------------------------------|
| `CardPile.onDraw(source)`                | `game:draw_card { source }`                         |
| `WordSlot.onPlace(cardId, row, slot)`    | `game:place_card { cardId, rowIndex, slotIndex }`   |
| `WordSlot.onUnplace(row, slot)`          | `game:unplace_card { rowIndex, slotIndex }`         |
| `WordBoard.onClearWord(row)`             | `game:clear_word { rowIndex }`                      |
| `GameBoard.onClearBoard()`               | `game:clear_board {}`                               |
| `CardPile.onDiscard(cardId)`             | `game:discard_card { cardId }`                      |

Keyboard shortcuts are enabled by default on the game board and reuse the same callbacks:

| Shortcut                                | Behaviour                                                         |
|-----------------------------------------|-------------------------------------------------------------------|
| `Shift+?`                               | Open the keyboard shortcuts modal.                                |
| `Shift+D`                               | Draw from the draw pile during draw phase, or discard the selected card during arrange phase. |
| `Shift+Alt+D`                           | Draw from the discard pile during the local player's draw phase.  |
| `1`-`9`                                 | Select a word row and focus its first empty slot, or slot 1.       |
| `ArrowLeft` / `ArrowRight`              | Move the selected slot within the current row.                    |
| `ArrowUp` / `ArrowDown`                 | Move to the previous/next row, clamping to that row's length.     |
| `Shift+ArrowLeft` / `Shift+ArrowRight`  | Move or swap the selected card within the same row only.          |
| `A`-`Z`                                 | Place the first matching hand card into the selected slot only when the board is selected. |
| `Backspace`                             | Return the selected slot's card to hand, or move to the previous slot if empty. |
| `Shift+Backspace`                       | Clear the selected word row.                                      |
| `Shift+Alt+Delete`                      | Clear the whole word board without confirmation.                  |
| `Escape`                                | Clear the selected slot.                                          |

Shortcuts are ignored while typing in form fields. `Enter` and `Space` are intentionally unused.

---

## Key Behaviours

- `GameBoard` derives the local player and opponent players from `gameState.players` and `localPlayerId` once, and passes the relevant slice to each child.
- The "is active turn" flag passed to children is computed as `gameState.turn.currentPlayerId === localPlayerId`.
- The "is arrange phase" flag is `isActiveTurn && gameState.turn.phase === 'arrange'`.
- The component is purely a layout/orchestration layer — no game logic lives here beyond deriving these flags and routing callbacks to WebSocket events.
- During the "draw" and "arrange" phases, the local player's `PlayerHand` and `WordBoard`/`WordSlot` can be edited. Draw piles are only clickable during the local player's draw phase, and the discard pile accepts discarded cards during arrange.
- Dropping a board card onto an occupied board slot swaps the two board cards, including across rows. Dropping a hand card onto an occupied board slot moves the displaced board card to the end of the hand.
- Typed-letter shortcuts are case-insensitive and only apply while the board is selected. If the hand is selected or the selected slot already contains that letter, no action is sent.
- Keyboard card movement never wraps across word boundaries.
