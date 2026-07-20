# Phase 3: Action Acknowledgements and Rejection Handling

## Summary

Add explicit client action ids to board mutation requests and echo them in server responses. This lets the frontend remove confirmed pending actions precisely, handle rejected actions cleanly, and avoid relying on positional inference.

## Scope

- Extend relevant WebSocket request payloads with an optional `clientActionId`.
- Echo `clientActionId` in `game:board_updated` after successful board mutations.
- Include `clientActionId` in `game:error` when a request with that id is rejected.
- Update frontend pending-action handling to remove the exact acknowledged or rejected operation.
- Listen for `game:error` in the frontend game-room hook.
- Surface rejected actions to the user with concise feedback and reconcile safely.

## Key Changes

- Backend request structs:
  - `placeCardRequest`
  - `unplaceCardRequest`
  - `clearWordRequest`
  - a new clear-board request decoded by the existing clear-board route
  - `discardCardRequest`, because discarding can mutate the board and emits `game:board_updated`
- Backend response payloads:
  - add `clientActionId?: string` to `boardUpdatedPayload`
  - add `clientActionId?: string` to structured errors for action failures
  - include the action id in a board update only for the acting client; opponents do not need another player's correlation id
- Frontend WebSocket send path:
  - generate genuinely unique ids with `crypto.randomUUID()` or a connection nonce plus monotonic counter,
  - enqueue the pending operation with that id,
  - send the id with the mutation request.
- Frontend WebSocket receive path:
  - on successful `game:board_updated`, remove the pending operation with that id,
  - replace authoritative base with server board/hand,
  - replay remaining pending operations,
  - on rejected `game:error`, remove the matching pending operation and reproject from the latest authoritative base.
  - on a missing or unknown acknowledgement, accept a non-stale authoritative base and replay the unchanged pending queue; never discard newer local intent merely because the id is unknown.
- Add an accessible user-visible transient error for rejected local actions, for example `That move was rejected. The board was refreshed.`

## Non-Goals

- Do not make the server store client action ids durably yet.
- Do not implement at-least-once resend semantics unless reconnection work requires it.
- Do not change game rules.

## Acceptance Criteria

- The client no longer guesses which pending operation a server update confirms.
- A rejected action does not leave a ghost card on the board.
- Multiple pending operations with the same card cannot leave duplicate card instances after one is rejected.
- Existing clients without `clientActionId` remain tolerated by the backend during local development.
- Malformed payload errors include the action id when it can be decoded safely; otherwise the field may be absent.
- WebSocket docs accurately describe the optional or required action id field.

## Test Plan

- Backend tests for:
  - successful place echoes `clientActionId`,
  - successful unplace, clear-word, clear-board, and discard echoes `clientActionId` to the actor,
  - clear-board decodes its request payload instead of dropping it in the route,
  - rejected invalid card includes `clientActionId` in `game:error`.
- Frontend reducer/hook tests for:
  - exact acknowledgement removes only the matching pending operation,
  - rejection removes the matching pending operation and replays the rest,
  - missing and unknown acknowledgements update a non-stale authoritative base while preserving and replaying pending operations,
  - rejection feedback is exposed accessibly.
- Run `cd backend && make test`.
- Run `cd frontend && npx vitest run`.
- Run `cd frontend && npm run lint`.
- Run `cd frontend && npm run build`.

## Implementation Notes

- Keep `clientActionId` opaque to the server. It should be carried, not interpreted.
- Prefer making the id optional server-side at first to avoid breaking old clients during development.
- If `game:error` is currently too generic, add a typed error envelope without removing the existing `code` and `message` fields.
- Do not add durable resend or deduplication semantics merely because ids now exist; reconnect policy is defined separately in Phase 4.
