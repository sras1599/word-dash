# Game Layout Prototypes

## Summary

Explore multiple Storybook layouts that keep the actions required for the current game phase visible without forcing a production layout decision in advance. The prototypes should address the current problem—player status and the word board can push draw/discard piles below the initial viewport—while preserving legibility, card usability, and responsive reflow.

This plan produces reviewable prototypes first. It does not assume a side-by-side board-and-piles layout or any other final arrangement.

## Dependency

- Use the interactive Storybook game simulation specified in `plans/interactive-game-simulation.md` so every layout can be exercised without starting a real room.
- Use a neutral HUD placeholder until a persistent HUD direction is selected; then verify shortlisted layouts with that chosen HUD.
- Do not duplicate game simulation logic inside individual layout stories.

## Core Layout Requirement

At the start of each phase, the player should see the information and controls required to act:

- Always: current turn/phase and timer.
- Draw phase: draw pile and discard pile.
- Arrange phase: word board, hand, and discard action/target.
- Opponent turn: local word board and hand, because local arrangement remains available.

Secondary player details, decorative backgrounds, advanced help, and inactive controls must not displace these primary elements.

The requirement is not to shrink every element until the entire application fits at every possible zoom. At constrained sizes, preserve readable cards and controls, then use intentional local overflow or compact secondary information rather than uncontrolled whole-page scrolling.

## Prototype Directions

Create at least three structurally distinct layout variants. Candidate questions to explore include:

1. Can the existing vertical hierarchy work after aggressively compacting player status, spacing, and hand chrome?
2. Does a desktop workspace with the board and piles grouped in one central play area make actions easier to scan?
3. Can a phase-adaptive layout emphasize draw controls during draw and board/discard controls during arrange without causing disorienting movement?
4. On constrained screens, should player status become a horizontal strip, a compact active-player summary, or an expandable secondary panel?

The resulting variants should answer these questions through working components. They should not be cosmetic restyles of the same DOM arrangement.

## Prototype Constraints

- Keep production card dimensions and minimum readable text sizes unless a variant explicitly tests a documented alternative.
- Do not hide an available primary action behind a menu.
- Do not require drag-and-drop; click-based placement and discard must remain usable.
- Keep the hand usable with large card counts and expose horizontal overflow clearly when needed.
- Preserve visible target-word labels and row validation feedback.
- Support two to four players and the longest allowed target rows.
- Avoid layout shifts on every one-second timer update.
- Respect safe-area insets, keyboard focus visibility, reduced motion, and touch target sizing.
- Keep overlays, help, validation messages, and reconnection feedback unobscured.

## Story Matrix

Render every layout variant with the same deterministic scenarios:

- Two players, local draw phase, ordinary timer.
- Four players, local draw phase.
- Local arrange phase with a selected hand card.
- Local arrange phase with an urgent timer and selected discard candidate.
- Opponent turn with an editable local board.
- Three short word rows and multiple long word rows.
- Small hand, overflowing hand, and nearly complete board.
- Disconnected opponent and reconnecting local client.

Review at representative desktop, laptop, tablet, and phone viewports, plus 125%, 150%, and 200% browser-zoom/reflow equivalents.

## Evaluation Criteria

- Time to locate the correct next action.
- Whether all current-phase actions are visible without whole-page scrolling at the target desktop and laptop conditions.
- Whether zoom/reflow preserves access without shrinking controls below usable sizes.
- Visual distance between a selected card and its destinations.
- Stability when the turn phase, active player, hand size, or validation state changes.
- Amount of permanent space consumed by secondary player information.
- Behavior with four players, long names, long rows, and a large hand.
- Keyboard tab order and screen-reader reading order relative to the visual arrangement.
- Touch reachability and absence of overlapping fixed elements.

## Review Deliverables

- Interactive Storybook stories for each variant and scenario.
- Matching screenshots at a fixed viewport matrix for quick side-by-side comparison.
- A short decision record added to this plan after review containing:
  - Selected layout direction.
  - Useful ideas retained from other variants.
  - Rejected directions and their concrete drawbacks.
  - Any unresolved behavior at extreme zoom or small screens.
- A follow-up production checklist based on the selected variant; do not treat prototype structure as production architecture automatically.

## Production Follow-Up

- Move only the selected layout into production components.
- Preserve game action/state logic independently from layout components.
- Remove obsolete duplicated page/component CSS and prototype-only variants after the decision is recorded.
- Add regression stories for supported phase, player-count, word-length, hand-size, and viewport combinations.
- Verify the selected layout with the chosen persistent HUD from `plans/persistent-game-hud.md`.

## Test Plan

- Storybook browser tests exercise draw, place, move, discard, clear, and turn-transition actions in every shortlisted variant.
- Visual checks cover the complete story and viewport matrix.
- Automated assertions verify that current-phase actions are rendered and not covered by fixed UI.
- Keyboard-only tests confirm that visual reordering does not create a confusing focus order.
- Zoom/reflow and touch-device manual checks confirm primary actions remain discoverable and operable.
- Run frontend unit tests, Storybook browser tests, lint, and production build after production integration.

## Assumptions

- “Everything actionable” means every action available in the current phase, not every possible game command simultaneously.
- Secondary player information may be compacted or locally scrollable before primary gameplay controls are allowed to leave the initial view.
- A layout will be selected only after interactive Storybook review.
- The prototype phase may reveal that different desktop and mobile structures are preferable, provided their interaction semantics remain consistent.
