# Persistent Game HUD Prototypes

## Summary

Create five temporary, interactive Storybook HUD prototypes using the existing game simulation harness. Each prototype keeps the timer, turn ownership, and current action visible while scrolling. Production game components and behavior remain unchanged until a direction is selected.

## Implementation

- Add an experiment-only HUD view model derived from simulation state: active player, local/opponent turn, draw/arrange phase, primary instruction, supporting instruction, remaining time, progress, and urgency.
- Extend `GameSimulationHarness` with an optional HUD variant while retaining the existing controlled clock and state controls.
- Use consistent player-facing copy:
  - Local draw: `Draw a card` / `Choose the deck or discard pile.`
  - Local arrange: `Build words or discard` / `Discard one card to end your turn.`
  - Urgent arrange: `Discard now` / `Your drawn card will be discarded when time expires.`
  - Opponent: `<Name>'s turn` / `You can continue arranging your words.`
  - Waiting and finished states display status without an actionable command.
- Keep all prototype components and CSS under story-support experiment files. Do not modify `GameTopBar`, `GameBoard`, or production page styling.
- Use `180ms ease-out` phase transitions without changing HUD dimensions. Disable decorative movement under `prefers-reduced-motion`; never animate the numeric timer itself.

## Prototype Variants

1. **Hand Command Deck — contextual**
   - Attach the instruction, numeric timer, and full-width progress edge to the fixed hand footer.
   - On mobile, use a two-row header above the horizontally scrolling cards.

2. **Vertical Turn Rail — distinctive**
   - Fix a labelled rail to the right edge with turn owner, action, numeric timer, and vertically draining progress.
   - Collapse it into an expandable horizontal edge tab below `48rem`.

3. **Active Player Pill — minimal**
   - Start with the active player's status pill and dock a compact copy to the viewport when the original scrolls away.
   - Show the active player rather than always showing the local user; include action and timer in the docked state.

4. **Compact Command Bar — conventional**
   - Prototype a game-specific persistent top bar containing the brand/home affordance, dominant action copy, and timer.
   - Add a progress line along its lower edge; hide non-game navigation and collapse supporting copy on narrow screens.

5. **Central Timer Puck — playful**
   - Place a compact circular HUD above the fixed hand, containing timer and action.
   - Expand briefly on phase changes, then return to its compact size without covering cards or board targets.

## Storybook Deliverables

Create stories under `Experiments/Game/Persistent HUD`:

- `Current`
- `Hand Command Deck`
- `Vertical Turn Rail`
- `Active Player Pill`
- `Compact Command Bar`
- `Central Timer Puck`
- `Comparison Matrix`

Each individual story uses the full interactive simulator with long content and supports draw, arrange, urgent, opponent, waiting, and finished states. The comparison matrix renders the current UI and all five variants in contained preview frames driven by the same selected scenario.

## Test Plan

- Verify every variant remains visible after scrolling and does not cover the hand, piles, board targets, shortcuts button, or event log.
- Exercise draw-to-arrange, normal-to-urgent, local-to-opponent, waiting, and finished transitions with the controlled clock.
- Assert the correct primary and supporting copy for each state and ensure one accessible timer and one canonical instruction are exposed.
- Check keyboard focus, accessible names, live-region phase announcements, non-color urgency cues, reduced motion, safe-area insets, long player names, and timer-width stability.
- Review desktop, tablet, and phone Storybook viewports.
- Run `npm run lint`, `npm run build`, and `npx vitest run`; do not start or restart Storybook.

## Assumptions

- The selected scope is the five core variants above.
- These are disposable comparison prototypes, not production architecture.
- The simulator remains the single source of prototype game state; no server, room, route, or protocol changes are required.
- Choosing and graduating a HUD into production is a separate follow-up.

## Decision Record — 2026-07-17

- Selected **Vertical Turn Rail** for production.
- Retained a slim, non-sticky `GameTopBar` for the existing brand/home action.
- On screens below `48rem`, the collapsed rail always shows a short action and numeric
  timer; expanding it reveals the full instruction.
- Removed the duplicate board subtitle so the rail is the canonical turn instruction.
- Rejected prototype implementations were removed after the selected rail was graduated
  into production components and regression stories.
