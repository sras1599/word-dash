# Remove the Standalone `TurnTimer`

## Summary

Delete the redundant `TurnTimer` component and all component-specific assets. Use the production `GameTopBar` as the timer renderer in both the game page and interactive simulation. Keep the shared timer helpers, controlled simulation clock, server timer behavior, and lobby timer settings intact.

## Key Changes

- Delete `frontend/src/components/TurnTimer/`, including its implementation, CSS, and Storybook stories.
- Replace `TurnTimer` in `GameSimulationHarness` with the production `GameTopBar`, passing the controlled clock's remaining time and derived urgency state. Keep the simulation's home action local/inert so the Storybook story does not navigate.
- Retain the controlled simulation clock because it still drives the top-bar display, board urgency behavior, auto-discard simulation, and timer controls.
- Remove the simulation-only timer header and label markup, the now-unused `timerActive` calculation, and their related CSS.
- Remove the unused `timeRemainingMs` and `totalDurationMs` fields from `GameBoardTurn`. Stop injecting those fields into `GameBoard` from `Game`, `GameSimulationHarness`, and component stories; timer rendering and urgency decisions belong to the page or harness rather than `GameBoard`.
- Delete the standalone `TurnTimer` documentation and update the frontend docs to identify `GameTopBar` as the game-page timer renderer.
- Correct `GameBoard` documentation so its layout no longer claims to render the page header or timer.
- Preserve `frontend/src/lib/turnTimer.ts`, its tests, `TurnTimerControl`, backend timer code, and historical changelog entries.

## Test Plan

- Confirm no imports or UI references remain for the deleted component.
- Confirm `GameBoardTurn` and every `GameBoard` call site no longer carry unused timer values.
- Run frontend lint and production build.
- Run Storybook/Vitest browser tests to verify the interactive simulation still works with `GameTopBar` driven by its controlled clock.
- Verify the simulation's clock controls update `GameTopBar` for normal, urgent, and zero-time values while expiry still triggers the expected simulated turn transition or automatic discard. No standalone replacement stories will be added.

## Assumptions

- “Remove completely” applies to the standalone React component and its dedicated documentation, not the game’s timer feature or shared timing utilities.
- `GameTopBar` is the single timer renderer for the production game page and the interactive simulation; it receives derived timer state and does not own deadline synchronization or expiry behavior.
- The simulation remains isolated from routing and networking when it renders `GameTopBar`.
- Existing uncommitted `.gitignore` and `plans/` changes are unrelated and will remain untouched.
