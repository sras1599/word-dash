# Component: Card

---

## Purpose

Represents a single letter card from the deck. Used in the player's hand, on the word board (inside `WordSlot`), in the discard pile (top card), and in the results screen. Has two visual states: **face-up** (shows the letter) and **face-down** (shows the card back — only used in the draw pile representation).

---

## Layout

```
┌──────────┐
│ A        │   ← letter, top-left
│          │
│    A     │   ← large letter, centred
│          │
│        A │   ← letter, bottom-right (rotated 180°)
└──────────┘
```

Face-down variant shows the WordIt! logo/pattern instead of a letter.

Card proportions follow the physical card: roughly 2:3 aspect ratio.

---

## Props / Data Needed

| Prop          | Type                   | Description                                                   |
|---------------|------------------------|---------------------------------------------------------------|
| `card`        | `Card \| null`         | The card to display. `null` renders an empty placeholder.     |
| `faceDown`    | `boolean`              | If true, shows back side (no letter visible). Default: false. |
| `draggable`   | `boolean`              | Whether drag-and-drop is enabled. Default: false.             |
| `selected`    | `boolean`              | Highlights the card as selected (e.g. for discard action).   |
| `isDrawn`     | `boolean`              | Marks the card drawn this turn with a distinct border.        |
| `readOnly`    | `boolean`              | Disables all interactions (used in results screen).           |

---

## Interactions

| Trigger             | Behaviour                                                                      |
|---------------------|--------------------------------------------------------------------------------|
| Click (selectable)  | Toggles `selected` state. Parent decides what to do with the selection.        |
| Drag start          | Initiates HTML5 drag with `cardId` as drag data.                               |
| Drag end            | Clears drag state regardless of whether drop succeeded.                        |

---

## Key Behaviours

- The card should have a slight drop shadow and rounded corners matching the physical card aesthetic.
- When `isDrawn` is true, a teal (`#2DB89C`) border highlights the card so the player can identify which one they must eventually discard.
- When `selected` is true, the card lifts slightly (CSS transform scale/translate) and shows a coloured ring.
- The card does not know about game logic — it simply renders the given state and emits events. All game logic is handled by the parent.
- Font size of the letter should scale with the card's rendered size (use `em` or `clamp()`).
