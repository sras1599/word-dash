# Component: TurnIndicator

---

## Purpose

Shows which player's turn it is currently, and what phase of that turn is in progress. Visible to all players at all times during gameplay.

---

## Layout

```
It's Alice's turn…      It's your turn!
┌──────────────────┐    ┌──────────────────┐
│ 👤 Alice's turn  │    │  Your turn!  🟢  │
│ [arrange phase]  │    │ [draw a card]    │
└──────────────────┘    └──────────────────┘
```

Uses different styling/colour when it is the local player's turn versus an opponent's turn.

---

## Props / Data Needed

| Prop               | Type         | Description                                                                |
|--------------------|--------------|----------------------------------------------------------------------------|
| `currentPlayer`    | `Pick<Player, 'id' \| 'name'>` | The player whose turn it is.                          |
| `phase`            | `TurnPhase`  | Current phase: `'draw'`, `'arrange'`, or `'idle'`.                         |
| `isLocalPlayer`    | `boolean`    | Whether `currentPlayer.id === localPlayerId`. Drives distinct styling.     |

---

## Interactions

- Display-only component. No user interactions.

---

## Key Behaviours

- When `isLocalPlayer` is true, the indicator uses a prominent, action-oriented style (e.g. teal background, "Your turn!" text) to clearly prompt the player.
- When `isLocalPlayer` is false, the indicator uses a more muted style showing the opponent's name.
- Phase labels:
  - `'draw'` → "Draw a card"
  - `'arrange'` → "Arranging…"
  - `'idle'` → not typically displayed (timer also hidden between turns)
- During a brief transition between turns, a subtle animation (fade or slide) indicates the turn has passed.
