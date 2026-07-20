# Phase 1: Reproduction and Baseline Tests

## Summary

Make the current flicker mode reproducible in tests and Storybook support before changing the reconciliation model. This phase should prove why intermediate server board updates currently rewind newer optimistic local moves.

## Scope

- Add reducer-level tests that simulate multiple local placements followed by an authoritative server update for only the first placement.
- Add a focused game simulation or helper test that models delayed `game:board_updated` messages for rapid typed letters.
- Document a manual Chrome throttling profile for checking the behavior in the browser.
- Identify any existing test helpers that can be reused for game state fixtures.

## Key Changes

- Extend `frontend/src/pages/Game/state/gameReducer.test.ts` with a regression case that would fail against the current replacement behavior and passes once Phase 2 is implemented:
  - local placement A is applied,
  - local placement B is applied,
  - a server `game/boardUpdated` payload for only A arrives,
  - current rendered state loses B.
- Add a second regression case for hand replacement:
  - local hand has cards B and C removed by pending optimistic moves,
  - an intermediate server hand still contains B or C,
  - current replacement can make the same letter/card selectable again.
- Add test fixtures that make card identity explicit enough to catch duplication, disappearance, and out-of-order hand contents.
- Add a short note to frontend realtime docs or this plan folder describing the manual throttle profile:
  - Download: `50 kbit/s`
  - Upload: `20 kbit/s`
  - Latency: `1500 ms`
  - Escalation profile if needed: `25 kbit/s`, `10 kbit/s`, `2500 ms`

## Non-Goals

- Do not implement the queue/replay fix in this phase.
- Do not change the WebSocket protocol.
- Do not add artificial latency to production code.

## Acceptance Criteria

- There is a deterministic regression test that captures the rewind scenario and passes with the completed reconciliation implementation.
- The test fixture describes rapid keyboard placement using real card ids, rows, and slots.
- The manual reproduction steps are written down in enough detail that the bug can be reproduced without rediscovering the throttling values.
- No expected-failing or skipped regression test remains at the end of the implementation branch.

## Test Plan

- Run `cd frontend && npx vitest run src/pages/Game/state/gameReducer.test.ts`.
- Manually reproduce in Chrome DevTools with the custom throttling profile by selecting a row and typing several matching letters quickly.

## Implementation Notes

- Prefer a pure reducer test first. Browser-level latency tests are useful later, but the state bug can be shown without a live socket.
- Use small boards and distinct card ids so assertions are readable.
- If Phase 1 is developed before Phase 2, use the failing test locally to demonstrate the bug, but do not commit it as failing or skipped. When the phases are delivered together, commit only the passing regression.
- Reuse the existing game simulation fixtures where they fit, but do not duplicate reconciliation rules in a Storybook-only state model.
