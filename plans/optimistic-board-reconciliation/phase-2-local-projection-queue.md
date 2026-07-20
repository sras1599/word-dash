# Phase 2: Local Projection Queue

## Summary

Introduce a frontend pending-action queue for local board operations. The rendered local player state should be computed by applying pending local operations on top of the latest authoritative server state. This phase removes the visible rewind without requiring backend protocol changes.

## Scope

- Track pending local board actions in game state context or a colocated hook reducer.
- Convert optimistic board edits into enqueue-and-project operations.
- When a local-player `game:board_updated` arrives, replace the authoritative base state, then reapply still-pending local actions before rendering.
- If this phase ships without Phase 3, compact pending actions using a narrowly scoped FIFO inference for local-player updates only. Do not retain that inference when explicit acknowledgements are implemented.

## Key Changes

- Split local player board data conceptually into:
  - authoritative board/hand from the latest server update,
  - pending local operations that have been sent but not fully reconciled,
  - projected board/hand shown to the user.
- Represent pending operations with enough detail to replay them:
  - `place`: `cardId`, `rowIndex`, `slotIndex`
  - `unplace`: `rowIndex`, `slotIndex`
  - `clear-word`: `rowIndex`
  - `clear-board`
  - `discard`: `cardId`, because discarding may optimistically remove a card from the board before its `game:board_updated`
- Extract pure helpers from `gameReducer.ts` so local optimistic mutation and replay use exactly the same rules.
- On local-player `game/boardUpdated`:
  - update the authoritative local player board and hand from the payload,
  - acknowledge one pending board action only in a Phase-2-only delivery where the protocol does not yet identify actions,
  - reapply the remaining pending board actions to produce the visible state.
- On opponent `game/boardUpdated`, keep current behavior and apply the server payload directly.
- On every personalized full `game/state`, replace the authoritative state and clear pending actions. This is the safe initial-load and reconnect boundary.
- Do not clear pending board actions on `game:turn_ended` or `game:turn_skipped`; those incremental events contain no authoritative board or hand, and board edits remain legal across turn changes.
- On a terminal transition, stop rendering pending projection and clear it only as part of a defined terminal reconciliation policy backed by an authoritative snapshot or sufficient terminal payload.

## Non-Goals

- Do not introduce client action ids in this phase.
- Do not implement durable resend or idempotency.
- Do not change server storage.

## Acceptance Criteria

- Rapid local placements remain visible while intermediate `game:board_updated` payloads arrive.
- Pending local operations cannot duplicate a card in hand and board after replay.
- Pending operations that no longer apply become no-ops rather than crashing.
- Opponent board updates continue to render authoritative server state directly.
- Row completion flags may temporarily reflect the latest server base until the final acknowledgement arrives; this should not cause card flicker.

## Test Plan

- Add reducer tests for:
  - two local placements followed by a server update for the first placement still rendering both placements,
  - three typed-letter placements with two intermediate updates,
  - placing onto an occupied slot while another placement is pending,
  - moving a board card while another placement is pending,
  - clearing pending actions on full `game/state`,
  - preserving and replaying pending actions across `game:turn_ended` and `game:turn_skipped`,
  - opponent updates bypassing local replay.
- Run `cd frontend && npx vitest run src/pages/Game/state/gameReducer.test.ts`.
- Run `cd frontend && npm run lint`.
- Run `cd frontend && npm run build`.
- Manually verify with the 1500 ms latency throttling profile.

## Risks

- Without protocol acknowledgements, matching server updates to pending actions is inferred by order on the local player's connection. This is acceptable only as a temporary Phase-2-only delivery; it is not enough for reconnection, retries, rejected actions, or a combined implementation of all four phases.
- Replaying a now-invalid pending action can mask a server rejection until a later full reconciliation. Phase 3 addresses this.

## Implementation Notes

- Start with placement because keyboard flicker is the reported issue.
- Keep replay helpers pure and deterministic.
- Store authoritative state and pending actions outside the wire-shaped `GameState` so protocol state and client-only state do not blur together. Derive the projected `GameState` exposed to the UI.
