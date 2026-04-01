# Component: CardPile

---

## Purpose

Represents either the **draw pile** (face-down stack) or the **discard pile** (face-up, top card visible). Displayed in the centre of the game board between the two teams. During the local player's draw phase, the piles become clickable to draw from.

---

## Layout

```
Draw pile:           Discard pile:
┌──────────┐         ┌──────────┐
│▓▓ WordIt ▓│         │  T       │
│▓▓  logo ▓│         │          │
│▓▓▓▓▓▓▓▓▓│         │    T     │
└──────────┘         └──────────┘
  42 cards              top card
```

The draw pile shows a face-down `Card` with a small count badge below it ("42 cards"). The discard pile shows the top `Card` face-up. When the pile is empty, it shows a distinct empty-slot outline.

---

## Props / Data Needed

| Prop           | Type                   | Description                                                                  |
|----------------|------------------------|------------------------------------------------------------------------------|
| `type`         | `'draw' \| 'discard'`  | Which pile this component represents.                                        |
| `topCard`      | `Card \| null`         | The top card to display (irrelevant for draw pile, shown face-down anyway).  |
| `cardCount`    | `number`               | Total cards in the pile. Used as the badge on the draw pile.                 |
| `isActive`     | `boolean`              | True when it is the local player's draw phase — enables click interaction.   |
| `isDropTarget` | `boolean`              | True during arrange phase — player can drag a card here to discard it.       |

---

## Interactions

| Trigger                           | Behaviour                                                                                  |
|-----------------------------------|--------------------------------------------------------------------------------------------|
| Click (when `isActive`)           | Fires `onDraw` callback with the pile type. Parent dispatches `game:draw_card` to server.  |
| Card dragged over (drop target)   | Highlights with a green border to indicate valid drop.                                     |
| Card dropped (when `isDropTarget`)| Fires `onDiscard` callback with the dragged `cardId`. Parent dispatches discard event.     |

---

## Key Behaviours

- The draw pile always renders face-down regardless of `topCard`.
- The discard pile renders its `topCard` face-up. If `topCard` is null (pile empty), it shows an empty outlined placeholder.
- When `isActive` is true, show a subtle pulsing glow or animated border to signal that the player should interact with this pile.
- When `isDropTarget` is true (arrange phase), the discard pile shows a drop ring on drag-over. The draw pile is never a drop target.
- The stack illusion (multiple cards underneath) is achieved with CSS box-shadow or two extra offset `div`s behind the top card.
