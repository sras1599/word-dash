# Storybook Game Simulation

The interactive game simulation lives at **Experiments/Game/Interactive Simulation** in
Storybook. It renders the production `GameTopBar`, `GameHud`, and `GameBoard` and uses the production
`gameReducer`, but it does not create a room or import the HTTP and WebSocket clients.

Use **Two Player Simulation** or **Four Player Simulation** for interactive development.
The control tray can change the active player and game phase, advance or expire the
controlled clock, toggle connection state, fill valid or invalid words, choose a winner,
reset the fixture, and show or hide the production-style event log. States are reached
through these controls rather than separate scenario stories.

Shared simulation code is in `frontend/src/story-support/gameSimulation/`:

- `fixtures.ts` creates isolated two-player, four-player, and long-content fixtures.
- `simulation.ts` applies simulator events and delegates production interaction semantics
  to `gameReducer`.
- `controlledClock.ts` supplies an explicitly controlled timer.
- `GameSimulationHarness.tsx` presents the controls, production top bar, persistent HUD,
  game board, and event log. Its controlled clock supplies `GameHud` with remaining time
  and urgency state.

New Storybook experiments should consume `GameSimulationHarness` or the shared fixtures
and transitions instead of copying simulation state logic into individual stories.
