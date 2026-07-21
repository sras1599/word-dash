# Component: GameBoard

## Purpose

`GameBoard` lays out player status, the local word workspace, independent card piles, and the wrapping local hand. It routes pointer, touch, keyboard, and drag-and-drop interactions through the existing callbacks.

## Production Layout

```text
Wide desktop
┌────────────────────┐  ┌────────────────────────────┐  Draw
│ Player strips,     │  │ Word workspace             │  Discard
│ vertically centered│  │ (fully rounded)            │  piles
└────────────────────┘  └────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ Your Hand — centered rows that grow in normal flow       │
└──────────────────────────────────────────────────────────┘

Medium
┌──────────────────────────────────────────────────────────┐
│ Player strip grid                                        │
├──────────────────────────────────────────────┬───────────┤
│ Word workspace                               │ Piles     │
├──────────────────────────────────────────────┴───────────┤
│ Wrapping hand                                            │
└──────────────────────────────────────────────────────────┘

Narrow/mobile
Players (horizontal scroll)
Word workspace
Draw pile     Discard pile
Wrapping hand
Keyboard help (fixed at the viewport's bottom-right)
```

Wide layout reserves `20rem`–`22rem` for players, centers the player group vertically against the workspace so it expands outward as players join, uses `minmax(0, 1fr)` for the word workspace, and gives larger pile cards their own `clamp(5.75rem, 6vw, 6.5rem)` size. Explicit column gaps keep piles visually independent. Below `74rem`, players move above the workspace; below `50rem`, piles move below the board and players become a horizontal row.

## Derived Player Data

- `playerOrder` remains the authoritative status-strip order.
- Each player's valid-word count is derived from complete word-board rows; total words is the row count.

## Responsive and Accessibility Rules

- DOM and tab order remain players, workspace, piles, hand, then keyboard help at every visual reflow; CSS fixes the icon-only help button to the viewport's bottom-right safe area.
- The mobile player overflow region is focusable for keyboard scrolling and preserves visible focus indicators.
- Only the word board scrolls horizontally when a supported word variation genuinely exceeds its workspace.
- The hand wraps without horizontal scrolling and remains one DnD target.
- Piles retain touch sizing and switch between vertical and horizontal arrangements without changing callbacks.
- Active, unavailable, selected, disconnected, and drop-target states remain distinguishable in forced colors; reduced motion removes transitions.

No backend, WebSocket, storage, or persistence contract changes are required.
