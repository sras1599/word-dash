# Component: CardPile

## Purpose

Represents either the draw pile (face-down stack) or discard pile (face-up top card). Production places both in an independent transparent group beside the word workspace, with whitespace separating them from the fully rounded board.

## Layout

The draw pile shows a face-down `Card` and count text; the discard pile shows its top card. Empty piles use the shared empty-card placeholder. Production supplies a dedicated responsive pile width (`--game-board-pile-card-width`) so piles are larger without changing word slots or hand cards. The group stacks vertically on wide and medium screens and becomes a horizontal pair below the workspace on narrow screens.

## Props / Data Needed

| Prop | Type | Description |
|---|---|---|
| `type` | `'draw' \| 'discard'` | Which pile this component represents. |
| `topCard` | `Card \| null` | Top discard card; draw piles remain face-down. |
| `cardCount` | `number` | Total pile count and empty-state source. |
| `isActive` | `boolean` | Enables drawing during the local draw phase. |
| `isDropTarget` | `boolean` | Enables discard drops during arrange. |

## Interactions

- Click, Enter, or Space on an active pile dispatches the unchanged draw callback.
- Activating an eligible discard pile with a selected card dispatches the unchanged discard callback.
- Dragging a card over the eligible discard pile uses warm primary surface tint and elevation; dropping dispatches the existing discard callback.
- Keyboard focus uses the page's primary red. Forced-colors mode supplies system-color outlines.

The group and pile cards have no green decorative borders. Draw/discard authorization and DnD event mapping remain owned by `GameBoard` and the server.
