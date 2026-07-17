# Game UX Simplification

## Summary

Make the existing game easier to understand without changing its rules. The interface should present one clear goal, one clear next action, and optional faster interaction methods. Clicking will become the primary interaction path; drag-and-drop and keyboard shortcuts will remain available for experienced players.

The gameplay tutorial is intentionally excluded from this plan and is specified separately in `plans/gameplay-tutorial.md`. Persistent game chrome and the overall game layout are also prototype-first efforts specified in `plans/persistent-game-hud.md` and `plans/game-layout-prototypes.md`.

## Product Principles

- Show the player what is happening, what they can do now, and what happens next.
- Prefer recognition over recall: keep the current goal and allowed actions visible.
- Present only actions that work in the current state.
- Use gameplay language consistently: deck, discard pile, hand, word, and turn.
- Preserve expert shortcuts without requiring them for basic play.
- Do not rely on color alone for validity, urgency, selection, or connection state.

## 1. Establish a Single Turn Instruction

- Replace the passive board subtitle with a prominent, state-specific instruction near the board and card piles.
- Derive the instruction from game phase, active player, turn phase, drawn card, urgency, and connection state.
- Use concrete messages such as:
  - Local draw phase: `Your turn — draw from the deck or discard pile.`
  - Local arrange phase: `Arrange your words, then discard one card to end your turn.`
  - Urgent local arrange phase: `15 seconds left — your drawn card will be discarded when time runs out.`
  - Opponent turn: `<Name>'s turn — you can continue arranging your words.`
  - Waiting/finished states: communicate preparation or completion without displaying an actionable instruction.
- Build the instruction so it can be placed in the persistent HUD later; its exact persistent placement is deferred to `plans/persistent-game-hud.md`.
- Remove or reduce duplicate turn messages in player cards once the canonical instruction is in place.
- Announce meaningful instruction changes through a polite live region without announcing every timer tick.

## 2. Make Clicking the Primary Card Interaction

- Implement a consistent select-then-destination model:
  - Clicking a hand card selects it.
  - Clicking an empty or occupied word slot places or swaps the selected card.
  - Clicking a placed card selects it for moving.
  - Clicking another slot moves or swaps the selected placed card.
  - Clicking the selected card again, pressing Escape, or completing an action clears selection.
- When a card is selected, visibly highlight every currently valid destination.
- During the active player's arrange phase, show an explicit `Discard selected card` action after a card is selected.
- Preserve dropping a card directly on the discard pile as the faster pointer interaction.
- Preserve keyboard shortcuts, but route clicking, dragging, and shortcuts through the same action semantics so their behavior cannot diverge.
- Ensure selection survives harmless clicks and is cleared only by an explicit cancellation, an invalidated state transition, or a completed action.
- Clear selection when the game ends, the selected card leaves the local player's possession, or the relevant action becomes unavailable.
- Verify occupied-slot swapping, board-to-hand movement, row clearing, whole-board clearing, and optimistic server reconciliation.

## 3. Clarify Gameplay Language and Board Feedback

- Rename `Your Deck` to `Your Hand`; reserve `deck` for the draw pile.
- Show a visible label for every target row, such as `3-letter word`, instead of hiding all row labels in the game layout.
- Replace unexplained lobby terminology:
  - `Variation` becomes `Word lengths` or `Words to complete`.
  - Avoid `word dash` when the copy means `turn`.
- Supplement valid/invalid row colors with an icon and text:
  - `Valid word`
  - `Not a valid word`
- Announce a row's validation result after it becomes full, without repeatedly announcing unchanged results.
- Keep the goal visible in a compact form, for example `Goal: complete 3, 4, and 5-letter words`.
- Add a visible overflow cue when the horizontally scrolling hand contains off-screen cards; do not make a hidden scrollbar the only indication.

## 4. Clarify Player Status Content

- Give each player's card count a visible label rather than relying on an icon and number.
- Prefer completion progress over decorative status text where space is limited.
- Keep disconnected state visible with text or an icon in addition to reduced opacity.
- Remove duplicate turn wording after the canonical turn instruction exists.
- Defer the top-bar replacement, persistent timer treatment, and final status-card density to the Storybook exploration in `plans/persistent-game-hud.md`.
- Do not add a leave-game control as part of this work.

## 5. Simplify the Lobby

- For non-hosts, replace disabled settings controls with a read-only summary of:
  - Required word lengths
  - Turn duration
  - Who controls the settings
- For hosts, make a recommended preset the default and move custom word lengths behind an `Advanced settings` disclosure.
- Rename difficulty tabs and presets only if their meaning can be understood without inspecting the resulting numbers; otherwise prioritize the actual word lengths in each label.
- Keep room sharing prominent and retain copy-success feedback.
- Remove the ready/not-ready interaction and treat joining the lobby as intent to play.
- Remove `isReady` from frontend and backend player models, lobby reducers/machines, WebSocket payloads/events, room storage, and tests.
- Remove the ready/unready WebSocket routes and storage operations.
- Permit only the host to start a game, and only when at least two connected players are currently in the room.
- Explain the disabled start state as `Need at least 2 players to start.`
- Do not add a leave-lobby button or a start countdown as part of this work.
- Avoid showing empty player slots with more visual weight than waiting players and the host's start action.

## 6. Preserve Current Layout Until Prototypes Are Chosen

- Do not commit to a new play-surface arrangement in this plan.
- Make only layout-neutral changes needed by the interaction, terminology, lobby, and feedback work above.
- Explore desktop, zoomed, and narrow-screen arrangements in Storybook under `plans/game-layout-prototypes.md` before selecting a production layout.

## 7. Add Operational and Error Feedback

- Expose WebSocket state to the page and show `Reconnecting…` when gameplay updates are temporarily unavailable.
- If reconnection is exhausted, show a recovery state with retry and home actions rather than silently leaving stale gameplay on screen.
- Surface rejected gameplay mutations and reconcile to the authoritative server state.
- Explain action failures in player language, for example `That card can no longer be moved. The board has been refreshed.`
- Distinguish an invalid word from a networking failure or a temporarily pending validation.
- Keep transient messages near the affected action and announce them through an appropriate live region.

## Component and State Refactoring

- Extract pure presentation helpers for the canonical turn instruction and allowed actions; cover all game/turn phase combinations with unit tests.
- Replace separate hand-card and board-slot selection state with one discriminated selection model describing a hand or board source.
- Centralize action availability rather than reproducing phase checks across the page, board, piles, and shortcut handler.
- Reuse existing placement, unplacement, discard, clear, and optimistic reducer operations; this plan should not alter server game rules.
- Remove stale or duplicate game styling from page-level CSS when the same selectors are owned by component CSS.
- Add the new states to the interactive Storybook game simulator specified in `plans/interactive-game-simulation.md`; do not require a live room to exercise them.

## Test Plan

- Component interaction tests:
  - Select a hand card and place it in an empty slot.
  - Replace an occupied slot and confirm the displaced card returns to the hand.
  - Select and move a placed card.
  - Select and explicitly discard a card during the arrange phase.
  - Prevent discarding during draw or opponent phases.
  - Cancel selection and clear selection on turn/game transitions.
  - Confirm drag-and-drop and keyboard behavior still match clicking.
- State-message tests for local draw, local arrange, opponent turn, urgency, timeout, waiting, disconnected, and finished states.
- Lobby stories for host editing, guest summary, one-player start restriction, two-player start availability, and disconnected players.
- Backend tests proving that only the host can start and that fewer than two connected players cannot start.
- Accessibility checks for keyboard completion, visible focus, dialog focus management, live-region behavior, non-color status indicators, and touch target size.
- Run frontend unit tests, Storybook browser tests, lint, and production build.
- Manually complete a full two-player game using only clicking, only keyboard controls, and a touch-sized viewport.

## Delivery Order

1. Canonical turn instruction and terminology changes.
2. Unified selection model and click-to-place/discard behavior.
3. Lobby host/guest simplification and readiness removal.
4. Player status content cleanup.
5. Connection and rejected-action feedback.
6. Story, accessibility, and regression coverage.

## Assumptions

- Players may rearrange their own board during another player's turn; the interface will explain this explicitly.
- Discarding a card remains the normal way for the active player to end a turn.
- Timing, word validation, turn rotation, and winning conditions remain server-authoritative and unchanged.
- Drag-and-drop and the existing shortcut set remain supported unless usability testing identifies a direct conflict.
- The separate gameplay tutorial may build on the canonical instruction and copy introduced here, but this plan does not block on it.
- Lobby membership is sufficient intent to play; there is no ready state.
- Starting requires at least two connected players and remains a host-only action.
- Leave controls and a pre-game countdown are explicitly out of scope.
- No persistent HUD or overall game layout is selected until its Storybook prototypes are reviewed.
