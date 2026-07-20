# Phase 4: Protocol Hardening and UX Polish

## Summary

Strengthen the reconciliation model after explicit acknowledgements are in place. This phase focuses on edge cases: reconnects, duplicate sends, stale updates, pending validation indicators, and optional batching for very rapid keyboard input.

## Scope

- Add a persisted monotonic player-board revision for stale and duplicate snapshot detection.
- Discard pending actions on reconnect and prevent implicit gameplay-action resend without server idempotency.
- Define an authoritative terminal reconciliation boundary.
- Add lightweight pending UI affordances where useful.
- Evaluate typed-letter micro-batching only if measurements show WebSocket chatter or UI pressure; otherwise leave it out.
- Update docs and Storybook simulation states.

## Key Changes

- Add backend `boardRevision`:
  - increment for each accepted board mutation for that player,
  - include it in `game:state` player snapshots and `game:board_updated`,
  - persist it through both memory and Redis-backed game state,
  - frontend ignores stale or duplicate per-player board updates whose revision is not newer than that player's authoritative base.
- Define reconnect behavior:
  - clear pending actions on every reconnect `game:state` and trust the personalized snapshot,
  - update `WsClient` connection/queue behavior so gameplay mutations are not silently resent across a reconnect,
  - do not add resend support unless the server first implements idempotency for client action ids.
- Define terminal behavior:
  - when the game finishes, pair the terminal event with a personalized authoritative snapshot or extend the terminal payload enough to reconcile private local state,
  - stop rendering pending projection and clear it only at that authoritative boundary.
- Add subtle pending state only if it helps:
  - avoid spinners on every slot,
  - avoid disabling placement,
  - consider a small reconnect/pending indicator in game chrome if updates are delayed.
- Only after measuring a real need, consider 30-75 ms keyboard micro-batching:
  - collect multiple typed placements in the same event loop window,
  - keep immediate local projection,
  - send the same operations in order,
  - do not wait for a batch before showing cards.
- Add a slow-network Storybook or simulation scenario that injects delayed intermediate board updates through the same reconciliation helpers used by production state. Do not maintain a second implementation of projection rules for the story.

## Non-Goals

- Do not make gameplay dependent on latency indicators.
- Do not hide server rejection or validation states.
- Do not introduce a large offline-first sync system unless personal hosting reliability demands it later.

## Acceptance Criteria

- Reconnect behavior is explicit and tested.
- Stale or duplicated server board updates cannot rewind current local state.
- Terminal state is reconciled from authoritative server data before pending projection is discarded.
- The UI remains responsive while pending operations exist.
- Slow-network simulation exists without needing Chrome throttling for every regression check.
- Documentation names the reconciliation strategy clearly.

## Test Plan

- Backend persistence and protocol tests for monotonically increasing board revisions.
- Frontend tests for stale and duplicate revision handling.
- Frontend and WebSocket-client tests for reconnect clearing and no-resend behavior.
- Frontend tests for terminal reconciliation.
- Storybook simulation for delayed intermediate acknowledgements.
- Manual testing with:
  - 1500 ms latency,
  - 2500 ms latency,
  - WebSocket disconnect/reconnect during pending edits,
  - invalid action rejection during pending edits.
- Run `cd backend && make test` for protocol/storage changes.
- Run `cd frontend && npx vitest run`.
- Run `cd frontend && npm run lint`.
- Run `cd frontend && npm run build`.

## Implementation Notes

- `boardRevision` and `clientActionId` solve different problems. Action ids identify confirmations; revisions identify stale authoritative state. Both are required for the final acceptance criteria.
- Keep pending UI restrained. The goal is smooth play, not making the player think about synchronization.
- Defer batching unless message volume or UI measurements justify it; projection is the core flicker fix.
