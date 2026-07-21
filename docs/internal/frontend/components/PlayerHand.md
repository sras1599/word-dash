# Component: PlayerHand

## Purpose

Displays the local player's cards in their server-provided order and acts as one DnD return target. Cards are draggable only when the parent authorizes editing.

## Layout

The full-width tray uses centered wrapping flex lines. Order flows left to right and then top to bottom, and every line—including an incomplete last line—is centered. Card sizes continue to come from `--page-game-card-width`; cards are not shrunk to force a single row. Additional rows grow the tray in normal document flow without a hand-level horizontal scroller.

The optional standalone `drawnCard` remains last in logical order and is wrapped as one flex item. It uses the shared drawn-card treatment instead of a divider that could become stranded at a line edge. Production normally identifies the drawn card already present in `hand` through `drawnCardId`.

## Interactions and States

- Selection and keyboard navigation follow logical array order rather than visual row calculations.
- Dragging preserves the original position while the overlay is active.
- The whole multi-row region remains one drop target for returning a board card to hand.
- Empty hands retain a centered message and useful minimum target height.
- Hover, focus, selected, and drawn-card elevation remain visible because the tray does not clip card overflow.

The component does not decide which actions are legal; `GameBoard` and the server continue to enforce placement and discard rules.
