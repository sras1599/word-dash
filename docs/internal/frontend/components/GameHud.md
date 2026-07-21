# Component: GameHud

## Purpose

`GameHud` is the floating top-center command HUD above the word workspace. It is separate from the logo-only `GameTopBar` and is the single visible source for current-turn ownership, the next action, supporting guidance, remaining time, and timer progress.

## States

| Game state | Primary guidance | Supporting guidance |
|---|---|---|
| Local draw | Your turn · Draw a card | Choose the deck or discard pile. |
| Local arrange | Your turn · Build words or discard | Discard one card to end your turn. |
| Urgent local arrange | Your turn · Discard now | The drawn card will be discarded when time expires. |
| Opponent turn | `<Name>'s turn` | You can continue arranging your words. |
| Waiting | Preparing the board | The round will begin shortly. |
| Finished | Hidden | `GameOverDialog` owns the result and actions. |

The numeric timer is outside the polite live region, so one-second updates are not announced. Ownership, phase, and instruction changes are announced atomically. Urgency uses consequence copy, a stronger outline, and color.

## Layout and Responsive Behaviour

- The page owns a dedicated sticky HUD layer whose responsive grid mirrors `GameBoard`, keeping the HUD centered over the word workspace and visually independent from the header.
- The timer has a fixed width and tabular figures. Guidance truncates inside a bounded column without moving it.
- Progress drains horizontally along the HUD's bottom edge and does not change geometry.
- At `48rem` and below, supporting detail is visually omitted while the owner/action line and timer stay visible in the floating HUD.
- There is no side rail, expansion state, or mobile expansion toggle.
- Reduced-motion preferences suppress progress and emphasis transition duration.
