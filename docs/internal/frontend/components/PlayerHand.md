# Component: PlayerHand

---

## Purpose

Displays the local player's current hand of cards as a horizontal row. Cards are draggable during the local player's arrange phase. Also shows the drawn card (visually distinguished) when the player has drawn one this turn.

---

## Layout

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ...       │
│  │  A   │ │  T   │ │  E   │ │  R   │ │  S   │           │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                          │
│  ← Normal hand cards                        Drawn card → │
│                                           ┌──────┐       │
│                                           │  N   │ 🟢    │
│                                           └──────┘       │
└──────────────────────────────────────────────────────────┘
```

The drawn card is visually separated — pushed to the right or given a distinct border — so the player always knows which card is the "extra" one they must discard before the turn ends.

---

## Props / Data Needed

| Prop          | Type                     | Description                                                               |
|---------------|--------------------------|---------------------------------------------------------------------------|
| `hand`        | `Card[]`                 | The player's normal hand cards.                                           |
| `drawnCard`   | `Card \| null`           | The extra card drawn this turn. Null if not in arrange phase.             |
| `isDraggable` | `boolean`                | Whether cards can be dragged. Only true during local player's own turn.   |
| `selectedCardId` | `string \| null`      | The currently selected card, for keyboard or click-based discard flow.   |

---

## Interactions

| Trigger                       | Behaviour                                                                                        |
|-------------------------------|--------------------------------------------------------------------------------------------------|
| Drag card from hand           | Initiates drag with `cardId` as data. The card dims in-place while being dragged.                |
| Drop card back onto hand      | If dragged from a `WordSlot`, the card returns to the hand. Parent handles the `unplace_card` event. |
| Click card (selectable)       | Marks the card as `selected`. A second click deselects. Only one card selected at a time.        |
| Click **Discard** (selected)  | Fires `onDiscard(selectedCardId)`. Handled by the game page to dispatch discard event.           |

---

## Key Behaviours

- Cards in the hand are laid out in a single horizontal row, wrapping if needed (though hand size is bounded by the variation, max ~14 cards).
- During dragging, the original card position shows a ghost / dimmed placeholder so the hand layout does not collapse.
- `drawnCard` is always shown last (rightmost), and uses the `isDrawn` prop on `Card` to show the teal border.
- When `isDraggable` is false, all cards show the non-interactive locked style (slightly muted, no hover effect).
- The component does not decide what is valid to discard — it simply fires callbacks and lets the game page and server enforce the rules.
