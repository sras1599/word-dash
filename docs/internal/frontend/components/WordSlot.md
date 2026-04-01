# Component: WordSlot

---

## Purpose

A single slot within a word row. Acts as a drop target for dragged cards and as a source when a card that's already placed needs to be moved back to the hand or to another slot.

---

## Layout

```
Empty slot:          Filled slot:
┌──────────┐         ┌──────────┐
│          │         │  E       │
│    __    │         │          │
│          │         │    E     │
└──────────┘         └──────────┘
```

Empty slots show a subtle dashed or outlined box. Filled slots render a `Card` component.

---

## Props / Data Needed

| Prop           | Type             | Description                                                          |
|----------------|------------------|----------------------------------------------------------------------|
| `slotIndex`    | `number`         | 0-based position in the word row.                                    |
| `rowIndex`     | `number`         | Which word row this slot belongs to.                                 |
| `card`         | `Card \| null`   | The card currently placed here. `null` = empty.                      |
| `isActive`     | `boolean`        | True during the local player's arrange phase (accepts drops).        |
| `isValid`      | `boolean \| null`| `true` = part of a validated word; `false` = row is invalid; `null` = not yet checked. |

---

## Interactions

| Trigger                         | Behaviour                                                                                          |
|---------------------------------|----------------------------------------------------------------------------------------------------|
| Card dragged over (when active) | Shows highlighted border (green) to indicate valid drop target.                                    |
| Card dropped here               | Fires `onPlace(cardId, rowIndex, slotIndex)`. Parent dispatches `game:place_card` to server.       |
| Drag card away from filled slot | Fires `onUnplace(rowIndex, slotIndex)`. Parent dispatches `game:unplace_card` to server.           |
| Click filled slot               | Selects the card (fires `onCardSelected`), allowing keyboard-based moves.                          |

---

## Key Behaviours

- When `isValid` is `true`, the slot/card renders with a green tint or check indicator (the entire `WordRow` turns green simultaneously).
- When `isValid` is `false` and all slots are filled, the slot renders with a red tint to indicate the word is not in the dictionary.
- When `isActive` is false (not the player's turn), drop events are ignored and the slot renders in a locked/muted style.
- A slot can only hold one card at a time. Dropping a card onto an already-filled slot should trigger a swap: the existing card returns to the hand, and the new card takes the slot. This swap is handled server-side.
