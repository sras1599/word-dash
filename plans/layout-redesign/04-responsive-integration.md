# Layout Redesign — Phase 4: Responsive Integration

## Goal

Rebalance the complete game-page layout after widening player strips, enlarging piles, and allowing the hand to wrap. The result should preserve the intended hierarchy without squeezing the word workspace or introducing overlaps.

## Wide Desktop Layout

- Retain the three-column structure: players, word workspace, and piles.
- Size the player column for the redesigned strips and the pile column for the larger cards.
- Keep explicit gaps between all three regions.
- Protect the word workspace with `minmax(0, 1fr)` and verify every supported word-length variation still fits or scrolls only within the word board when genuinely necessary.
- Keep the hand below all three columns and allow its height to expand.

## Medium Layout

- Move player strips above the workspace before the wider cards begin to compress their contents.
- Render players as a responsive grid with a minimum card width based on the new strip design, not the previous `10rem` compact-card width.
- Keep the workspace and pile column side by side while both have enough room.
- Adjust the transition breakpoint based on measured content fit rather than preserving `72rem` automatically.

## Narrow and Mobile Layout

- Use the current reading order: players, workspace, piles, hand, help.
- Keep player cards in a horizontally scrollable row when a usable multi-column grid no longer fits.
- Place the transparent pile group below the workspace and arrange the two piles horizontally.
- Let hand cards wrap at mobile card sizes; avoid reintroducing full-hand horizontal scrolling.
- Preserve safe-area padding and ensure the final hand row does not collide with the help control.

## Required Viewport Checks

Review at least these widths in the full production page composition:

- `1600px`: target screenshot scale and primary three-column layout.
- `1280px`: smaller desktop with all content still readable.
- `1024px`: likely player-grid-above-workspace transition.
- `800px`: workspace and pile reflow boundary.
- `375px`: narrow mobile overflow, wrapping, and touch targets.

At every width, check variations `[3, 4, 5]`, `[5, 6]`, `[8]`, and `[4, 4, 4]`, plus three- and four-player games.

## Interaction and Accessibility Checks

- Tab order must continue to follow DOM order even when CSS grid areas move visually.
- Horizontal player overflow must be keyboard-scrollable and must not hide focus indicators.
- Word-board internal scrolling must not create an ambiguous nested horizontal scroller beside the player list.
- Touch targets must retain their existing minimum sizes.
- Active, unavailable, selected, and drop-target states must survive each reflow.
- Forced-colors and reduced-motion behavior must remain effective.

## Primary Files

- `frontend/src/components/GameBoard/GameBoard.css`
- `frontend/src/pages/Game/Game.css`
- `frontend/src/components/GameBoard/GameBoard.stories.tsx`
- `frontend/src/story-support/gameSimulation/GameSimulationHarness.css`, only if the full-page harness imposes conflicting bounds

## Completion Criteria

- No viewport has overlapping regions, clipped focus indicators, or unreadably compressed status strips.
- The word workspace keeps priority over decorative whitespace.
- Player strips change layout before their information truncates excessively.
- Larger piles remain usable in vertical and horizontal arrangements.
- Multi-row hands remain in normal flow and centered at every supported width.
