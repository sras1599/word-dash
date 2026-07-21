# Layout Redesign — Phase 1: Player Status Strips

## Goal

Replace the compact player cards with wide horizontal status strips that comfortably show identity, turn state, cards in hand, and word progress. The strip should follow the structure in `assets/pill-imagined.png` while retaining the current game-state behavior and player ordering.

## Design Direction

- Reserve approximately `20rem` to `22rem` for the desktop player column instead of the current `11rem`.
- Give each strip three readable zones:
  1. A larger circular avatar.
  2. The player's name and current status, stacked vertically.
  3. Two right-aligned statistics: cards in hand and valid words out of total words.
- Use the player's real name as the primary identity. A local-player qualifier such as `You` may be secondary rather than replacing the name.
- Show `Drawing…`, `Building…`, `Waiting`, `Winner`, or `Disconnected` using the existing status precedence.
- Indicate the active player through the strip border treatment. Remove the separate `ACTIVE` corner label so turn changes do not compete with the statistics.
- Keep disconnected state distinguishable without relying on color alone.

## Data and Component Changes

1. Extend `PlayerStatusStripPlayer` with explicit word-progress fields:

   ```ts
   validWordCount: number
   totalWordCount: number
   ```

2. In `GameBoard`, derive these values for every player from their existing word board:
   - `validWordCount` is the number of rows where `row.isComplete` is true.
   - `totalWordCount` is `wordBoard.rows.length`.
3. Do not change the backend or WebSocket contract. Every player already includes the information needed for these values.
4. Include both statistics in each article's accessible name. Give visible statistic groups meaningful accessible labels where appropriate.
5. Preserve authoritative `playerOrder`; active-turn changes must never reorder the strips.

## Styling Work

- Rework `.player-status-strip__card` into a stable three-zone grid.
- Increase the avatar size and ensure two-character initials still fit.
- Allocate enough width for long player names while keeping statistics non-shrinking.
- Use tabular numerals for changing counts to avoid visual jitter.
- Keep all strip heights stable across active, inactive, disconnected, and winner states.
- Apply active borders with an inset treatment or reserved border width so the layout does not shift.
- Retain forced-colors support and reduced-motion behavior.

## Storybook and Test Coverage

Update `PlayerStatusStrip.stories.tsx` to cover:

- Local draw and arrange turns.
- Opponent turn.
- At least one completed word, shown as valid / total.
- Long player names.
- Disconnected and finished/winner states.
- Three or four players in server order.
- Narrow mobile overflow.

Interaction assertions should verify the real player name, status, card count, word progress, accessible label, and preserved server order.

## Primary Files

- `frontend/src/components/PlayerStatusStrip/PlayerStatusStrip.tsx`
- `frontend/src/components/PlayerStatusStrip/PlayerStatusStrip.css`
- `frontend/src/components/PlayerStatusStrip/PlayerStatusStrip.stories.tsx`
- `frontend/src/components/GameBoard/GameBoard.tsx`
- `frontend/src/components/GameBoard/GameBoard.css`

## Completion Criteria

- No player identity or statistic is truncated at the target desktop layout with ordinary names.
- Every strip shows cards in hand and valid words / total words.
- The active player is recognizable from the strip border without an `ACTIVE` badge.
- No backend or protocol changes are introduced.
- Existing turn-state and player-order behavior remains intact.
