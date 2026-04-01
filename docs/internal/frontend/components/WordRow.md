# Component: WordRow

---

## Purpose

A horizontal row of `WordSlot` components representing one target word the player needs to form. Manages and displays the overall validity state of the word across all its slots.

---

## Layout

```
3-letter row (all empty):
[ __ ] [ __ ] [ __ ]

4-letter row (partially filled, invalid):
[  C ] [  A ] [ __ ] [ __ ]

5-letter row (complete, valid — green):
[  W ] [  O ] [  R ] [  D ] [  S ]  ✓
```

A label or index number may be shown to the left (e.g. "Word 1 (3 letters)") but is optional.

---

## Props / Data Needed

| Prop          | Type             | Description                                                               |
|---------------|------------------|---------------------------------------------------------------------------|
| `rowState`    | `WordRowState`   | Full row state from `GameState` (slots, targetLength, isComplete).        |
| `rowIndex`    | `number`         | The row's index within the player's word board. Passed down to slots.     |
| `isActive`    | `boolean`        | True during the local player's arrange phase.                             |

---

## Interactions

- Delegates all drag/drop interactions to child `WordSlot` components.
- Fires `onPlace` and `onUnplace` callbacks up to `WordBoard`, which then passes them to the game page.

---

## Key Behaviours

- When `rowState.isComplete` is `true`, the entire row has a green background or success state. All slots show with the `isValid: true` style simultaneously.
- When all slots are filled but `isComplete` is `false`, the entire row shows a red/error state ("not a valid word").
- When slots are only partially filled, slots show their neutral/empty styles — no error is shown for incomplete rows.
- The row does not independently fetch or validate words — it only renders the `isComplete` flag provided by the server via `GameState`.
- Slots in the row are rendered in `slotIndex` order (left to right).
