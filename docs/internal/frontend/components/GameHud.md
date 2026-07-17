# Component: GameHud

## Purpose

`GameHud` is the persistent turn rail on the game page. It is the single visible source
for current-turn ownership, the next action, supporting guidance, remaining time, and
timer progress. `GameTopBar` contains only the non-sticky brand/home action.

## States

| Game state | Primary guidance | Supporting guidance |
|---|---|---|
| Local draw | Draw a card | Choose the deck or discard pile. |
| Local arrange | Build words or discard | Discard one card to end your turn. |
| Urgent local arrange | Discard now | The drawn card will be discarded when time expires. |
| Opponent turn | `<Name>'s turn` | You can continue arranging your words. |
| Waiting | Preparing the board | The round will begin shortly. |
| Finished | Hidden | `GameOverDialog` owns the result and actions. |

The numeric timer is outside the polite live region so one-second updates are not
announced. Phase, ownership, and instruction changes are announced atomically.

## Responsive Behaviour

- Desktop: fixed right rail with vertically draining progress.
- Below `48rem`: compact tab above the fixed hand showing a short action and timer.
- The compact tab expands leftward to reveal full guidance and retains its expansion
  state across timer and phase updates.
- The expansion control exposes `aria-expanded` and `aria-controls`, remains keyboard
  operable, and preserves visible focus.
- Urgency uses explicit copy as well as color, and reduced-motion preferences suppress
  visible transition duration.
