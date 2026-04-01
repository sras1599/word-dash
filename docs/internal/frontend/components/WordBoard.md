# Component: WordBoard

---

## Purpose

Contains all of the local player's `WordRow` components — one row per target word in the current variation (e.g. 3 rows for the 3-4-5 variation). This is the primary workspace where the player arranges their letters to form words.

---

## Layout

```
┌──────────────────────────────────────────────────┐
│  Word 1 (3):   [ __ ] [ __ ] [ __ ]              │
│                                                  │
│  Word 2 (4):   [  C ] [  A ] [ __ ] [ __ ]       │
│                                                  │
│  Word 3 (5):   [  W ] [  O ] [  R ] [  D ] [ __ ]│
└──────────────────────────────────────────────────┘
```

Rows are stacked vertically. Each row is labelled with its index and target length.

---

## Props / Data Needed

| Prop          | Type           | Description                                                        |
|---------------|----------------|--------------------------------------------------------------------|
| `wordBoard`   | `WordBoard`    | Full word board state from `GameState` for the local player.       |

---

## Interactions

- Aggregates `onPlace(cardId, rowIndex, slotIndex)` and `onUnplace(rowIndex, slotIndex)` events from child `WordRow` components and passes them up to the game page.

---

## Key Behaviours

- When `wordBoard.allComplete` becomes `true`, an animated completion state (e.g. all rows glow green, a brief celebration animation) should play just before the win event is confirmed by the server.
- The number and lengths of rows are entirely derived from `wordBoard.rows` — the component is variation-agnostic.
- Row order matches the variation's `wordLengths` order (shortest to longest by default, as set during lobby configuration).
- Word labels (e.g. "Word 1 (3 letters)") help the player keep track of which row is which, especially in the 3-4-5 variation where rows have different targets.
