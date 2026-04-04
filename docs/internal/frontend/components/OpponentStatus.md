# Component: OpponentStatus

---

## Purpose

A compact summary card for a single opponent player, shown in the opponents band at the top of the game screen. Shows enough information to track each opponent's progress without revealing their cards.

---

## Layout

```
┌──────────────────────────────────┐
│  👤 Bob                          │
│  Cards in hand: 12               │
│  Words complete: 1 / 3           │
│  ████░░░  (progress bar)         │
└──────────────────────────────────┘

(during Bob's turn — highlighted)
┌──────────────────────────────────┐
│  👤 Bob  ← Active turn           │  ← teal border
│  Cards in hand: 13 (+1 drawn)    │
│  Words complete: 1 / 3           │
│  ████░░░                         │
└──────────────────────────────────┘
```

---

## Props / Data Needed

| Prop               | Type                   | Description                                                              |
|--------------------|------------------------|--------------------------------------------------------------------------|
| `player`           | `Player`               | The opponent player to display.                                          |
| `variation`        | `Variation`            | Used to compute total words required (denominator of progress).          |
| `isActiveTurn`     | `boolean`              | Whether it is currently this player's turn.                              |

---

## Interactions

- Display-only component. No user interactions.

---

## Key Behaviours

- **Cards in hand count:** Shows `player.hand.length`. During the opponent's arrange phase (when they hold an extra drawn card), the count increases by 1 and a `(+1 drawn)` note can be shown.
- **Words complete:** Derived as the count of `player.wordBoard.rows.filter(r => r.isComplete).length` out of `variation.wordLengths.length`.
- **Progress bar:** Visual proportion of completed words over total required.
- **Active turn:** When `isActiveTurn` is true, the card gets a highlighted border (teal) to match the `TurnIndicator`.
- **Disconnected state:** If `player.isConnected` is false, show a disconnected indicator (muted style, "disconnected" label).
- Opponent hand cards are never shown — only the count is visible.
