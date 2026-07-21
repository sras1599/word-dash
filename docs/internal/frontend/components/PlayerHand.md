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
| `selectedCardId` | `string \| null`      | The currently selected card, for keyboard navigation.                    |

---

## Interactions

| Trigger                       | Behaviour                                                                                        |
|-------------------------------|--------------------------------------------------------------------------------------------------|
| Drag card from hand           | Initiates drag with `cardId` as data. The card dims in-place while being dragged.                |
| Drop card back onto hand      | If dragged from a `WordSlot`, the card returns to the hand. Parent handles the `unplace_card` event. |
| Click card (selectable)       | Marks the card as `selected`. Only one card is selected at a time.                              |
| `Shift+D` with card selected  | Handled by `GameBoard` to dispatch discard during the arrange phase.                            |

---

## Key Behaviours

- Cards remain in a single horizontal row. Overflow scrolls intentionally with a visible scrollbar instead of increasing tray height.
- During dragging, the original card position shows a ghost / dimmed placeholder so the hand layout does not collapse.
- `drawnCard` is always shown last (rightmost), and uses the `isDrawn` prop on `Card` to show the teal border.
- When `isDraggable` is false, all cards show the non-interactive locked style (slightly muted, no hover effect).
- The component does not decide what is valid to discard; `GameBoard` and the server enforce discard rules.
- The production shell is labelled `Your Hand`, uses compact padding, and stays in normal layout flow so it cannot cover the board or pile dock.
