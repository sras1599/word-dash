# Component: GameBoard

## Purpose

`GameBoard` lays out player status, the local word workspace, the integrated pile dock, and the local hand. It routes pointer, keyboard, and drag-and-drop interactions through the existing game callbacks; presentation emphasis never authorizes game actions.

## Production Layout

```text
Desktop
┌───────────┬──────────────────────────────┬──────────┐
│ Players   │ Word workspace               │ Draw     │
│ in server │                              │ Discard  │
│ order     │                              │ dock     │
├───────────┴──────────────────────────────┴──────────┤
│ Your Hand — compact horizontal overflow             │
└──────────────────────────────────────────────────────┘
```

The dock is visually attached to the workspace, but owns a reserved grid column and never overlaps word slots. At narrower widths the players become a horizontal strip; below `50rem` the intact pile group moves below the workspace.

## Props and Derived Presentation

- `playerOrder` is the authoritative server player order used by the status region.
- `phase`, `turn`, local ownership, and `timerIsUrgent` feed `getGameBoardEmphasis`.
- `data-emphasis` values are `primary`, `available`, `informational`, and `unavailable`.
- The mapping changes outlines/surfaces only. Persistent geometry and action authorization stay unchanged.

Normal phases have one primary board region: piles for local draw, workspace for local arrange, players for an opponent turn, and the discard-capable dock during urgent arrange. The local board and hand remain available during opponent turns.

## Interactions

| Input | Behaviour |
|---|---|
| Click/activate either pile during local draw | Dispatch the unchanged draw callback for that source. |
| Select a hand or board card, then activate discard | Dispatch the unchanged discard callback. This supports pointer and touch play without adding a second action button. |
| Drag hand/board card to a word slot | Place or move through the existing DnD action mapping. |
| Drag a board card to hand | Unplace through the existing callback. |
| Drag a card to discard | Discard only when the discard target is valid; the draw pile never accepts drops. |
| Keyboard shortcuts | Reuse the same draw, place, unplace, clear, and discard callbacks. |

The keyboard shortcut map remains documented in the in-game `KeyboardShortcutsModal`. Collision detection checks pointer hits first, then falls back to nearest-center matching.

## Responsive and Accessibility Rules

- DOM order is players, workspace, piles, hand, then secondary keyboard help; visual reflow preserves that reading order.
- Player rows do not reorder on active-turn changes.
- The hand uses visible horizontal overflow and consistent card order.
- Emphasis uses inset outlines and static copy, so it never resizes a region or relies on color alone.
- Reduced motion removes transition/entry animation while preserving state outlines and text.
