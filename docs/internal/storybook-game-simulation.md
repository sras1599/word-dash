# Storybook Game Simulation

The interactive game simulation lives at **Experiments/Game/Interactive Simulation** in
Storybook. It renders the production `GameTopBar`, `GameHud`, and `GameBoard` and uses the production
reconciliation reducer and board-operation helpers, but it does not create a room or import the HTTP and WebSocket clients.

Use **Two Player Simulation** or **Four Player Simulation** for interactive development.
The control tray can change the active player and game phase, advance or expire the
controlled clock, toggle connection state, fill valid or invalid words, choose a winner,
reset the fixture, and show or hide the production-style event log. States are reached
through these controls rather than separate scenario stories.

Use **Slow Network Reconciliation** for the board-flicker regression. It places three
cards rapidly, injects the delayed authoritative update for only the first placement,
and verifies that the two newer operations remain projected.

Shared simulation code is in `frontend/src/story-support/gameSimulation/`:

- `fixtures.ts` creates isolated two-player, four-player, and long-content fixtures.
- `simulation.ts` applies simulator events and delegates production interaction semantics
  to the reconciliation reducer and shared projection helpers.
- `controlledClock.ts` supplies an explicitly controlled timer.
- `GameSimulationHarness.tsx` presents the controls, production top bar, persistent HUD,
  game board, and event log. Its controlled clock supplies `GameHud` with remaining time
  and urgency state.

New Storybook experiments should consume `GameSimulationHarness` or the shared fixtures
and transitions instead of copying simulation state logic into individual stories.

## Manual network profiles

In Chrome DevTools, create a custom network throttling profile with `50 kbit/s`
download, `20 kbit/s` upload, and `1500 ms` latency. Select a board row and type
several matching letters quickly; intermediate acknowledgements must not make newer
letters or hand cards reappear. For a stronger check use `25 kbit/s` download,
`10 kbit/s` upload, and `2500 ms` latency. Also disconnect and reconnect with edits
pending: the reconnecting `game:state` must replace the projection and the old
gameplay messages must not be resent.
