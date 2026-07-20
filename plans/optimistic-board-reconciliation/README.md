# Optimistic Board Reconciliation Plan

## Summary

Fix board flicker during slow WebSocket round trips by changing the frontend from "replace local state with every server board update" to "render authoritative server state plus newer local intent." The player should be able to type or move cards quickly without seeing already-entered cards disappear when intermediate acknowledgements arrive.

The final system should keep the server authoritative while making local gameplay feel immediate. Server confirmations should reconcile state, not visibly rewind newer moves.

## Problem

Today, board actions are applied optimistically in the frontend and then sent over WebSocket. Every successful server action broadcasts `game:board_updated` with the actor's full board and private hand. The frontend replaces the local player's board and hand with that payload.

On a slow connection, a player can issue several local moves before the first server update returns. When the first update arrives, it represents only the first accepted move, so it overwrites newer local moves that the player can already see. Later updates reintroduce those moves. This creates the visible slot/card flicker.

## Target Outcome

- Rapid keyboard typing and drag/click placement never visibly loses newer local moves because an older server update arrived.
- Server snapshots remain authoritative for accepted actions, rejected actions, reconnects, turn changes, validation flags, and winning state.
- The local player can keep issuing board edits while previous board edits are pending.
- Opponent boards continue to update directly from server broadcasts.
- The fix is testable without depending on a real slow network.

## Phase Order

1. [Phase 1: Reproduction and Baseline Tests](./phase-1-reproduction-and-baseline-tests.md)
2. [Phase 2: Local Projection Queue](./phase-2-local-projection-queue.md)
3. [Phase 3: Action Acknowledgements and Rejection Handling](./phase-3-action-acknowledgements.md)
4. [Phase 4: Protocol Hardening and UX Polish](./phase-4-protocol-hardening-and-ux-polish.md)

## Recommended Implementation Strategy

Implement phases 1 and 2 together as the first useful batch if the work will be delivered incrementally. Phase 2 can remove the visible flicker without changing the WebSocket protocol if it carefully replays pending local moves after every local-player `game:board_updated`.

When all four phases are delivered as one change, do not build and then remove a FIFO acknowledgement mechanism. Add client action ids as part of the queue implementation and use exact acknowledgement from the start. Complete phases 3 and 4 in the same change so rejected actions, reconnection, duplicate or stale updates, and terminal reconciliation are covered before release.

## Cross-Phase Principles

- Keep the server as the source of truth for persisted board state, hand contents, row completion, turn state, and winners.
- Keep local optimism purely client-side until the server accepts an action.
- Do not block typing, clicking, or dragging while a board action is pending.
- Do not apply local-player pending operations to opponent views.
- Prefer pure reducer helpers so replay behavior can be covered with deterministic tests.
- Treat client action ids and board revisions as separate guarantees: action ids correlate results, while revisions reject stale authoritative state.
- Do not clear pending board operations in response to incremental events that do not contain an authoritative board and hand.
- Update protocol docs whenever WebSocket payloads change.

## Verification Baseline

At minimum, each implementation batch should run:

- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && npx vitest run src/pages/Game/state/gameReducer.test.ts`
- `cd frontend && npx vitest run src/pages/Game/state/gameMachine.test.ts`
- `cd frontend && npx vitest run src/components/GameBoard/shortcuts.test.ts`

For protocol changes, also run:

- `cd backend && make test`
- focused frontend WebSocket/reconciliation tests using paths relative to `frontend/`
- `cd frontend && npx vitest run`

`frontend/src/lib/schemas.test.ts` covers form validation, not the WebSocket protocol. Add protocol-specific tests rather than treating that file as protocol coverage.

Manual verification should include a custom Chrome throttling profile with high latency, such as 50 kbit/s download, 20 kbit/s upload, and 1500 ms latency.

## Assumptions

- Board edits remain legal during any player's `draw` or `arrange` turn phase, matching current server behavior.
- The most common flicker path is local-player `game:board_updated` overwriting newer local optimistic placement state.
- WebSocket message order is preserved per connection, but updates from different connections and reconnect generations can interleave, and server updates can still represent intermediate accepted states.
- The existing XState machine can keep owning the game state, with richer reducer context if needed.
