# Gameplay Tutorial Implementation Plan

## Goal

Add a short, optional, solo tutorial that lets a visitor learn Word Dash from the normal Home page without creating a room or finding another player. The tutorial must use the production game board and controls, teach the real turn loop accurately, and finish in one 2–4 minute session.

The tutorial is a deterministic client-side lesson. It does not create a room, open a WebSocket, use the current player session, persist progress, or change backend contracts.

## Product Decisions

- Keep **Create Game** and **Join Game** on the existing Home action row.
- Add **Play Tutorial** as a separate action below that row.
- Never auto-launch the tutorial and never hide its Home action after completion.
- Navigate to a dedicated `/tutorial` route; refreshing that route restarts the lesson.
- Start immediately with the local player labelled **You** and the opponent labelled **Bot Dash**. Do not ask for a name.
- Keep **Exit Tutorial** available throughout the lesson. After winning, replace it with **Complete Tutorial**. Both navigate to `/` without confirmation.
- Teach gameplay only. Room creation, joining, invitations, readiness, variation settings, and other lobby guidance remain out of scope.
- Keep the tutorial untimed, but render the production HUD with a frozen `1:30` timer and an explicit **Tutorial · Timer paused** treatment.
- Keep keyboard controls operational, but teach them only as an optional speed tip after the player completes the lesson.

## Learning Outcomes

By completion, the player should understand that:

1. They win by completing every displayed row with a valid word.
2. Their turn is active before they draw, and they may arrange their board at any time, including during another player's turn.
3. Drawing is optional, but it is the active player's main advantage because it temporarily gives them one extra letter.
4. They may draw once from the face-down pile or from the visible top of the discard pile.
5. After drawing, they discard one card to end their turn.
6. If the real timer expires after a draw, the exact card drawn that turn is automatically discarded, even if it has been moved onto the board.
7. A filled invalid row remains editable but does not count toward winning.
8. Completing the final valid row wins immediately; the winner does not need to discard afterward.
9. Keyboard shortcuts provide a faster way to play once the basic loop is understood.

## Scripted Scenario

Use two empty rows with target lengths `[3, 4]` and this initial local hand:

```text
C A G A M X Y
```

The draw pile is seeded so the first local draw returns `T`. The discard pile begins empty, matching a new production game. Bot Dash's scripted turn later places `E` on top of the discard pile.

### Step 1: Explain the Active Turn and Drawing Advantage

- Render the full board, HUD, both piles, both empty rows, the starting hand, and Bot Dash's player status.
- Show **Your turn** in the HUD and freeze the timer at `1:30` with **Tutorial · Timer paused**.
- Explain that the turn is already active and the board can be arranged now.
- Explain that drawing is optional but gives the active player one extra letter to work with.
- Identify both draw sources. Because the discard pile is empty, highlight the face-down pile and ask the player to try it.
- Accept only a draw from the face-down pile for this step. Other actions remain visibly subdued and produce lightweight corrective feedback.

Suggested coach copy:

> **Your turn is active.** You can arrange your letters at any time, even during another player's turn. During your own turn, you may draw one card from either pile, giving you an extra letter to help form words. Drawing early gives you more options. The discard pile is empty, so try the face-down pile.

### Step 2: Explain the Drawn Card and Timer Consequence

- Reveal the seeded `T`, append it to the hand, move the scripted turn into its arrange phase, and visually mark `T` as the card drawn this turn.
- Keep the timer frozen; explain what would happen in a real timed match.

Suggested coach copy:

> **You now have one extra letter.** Before your timer runs out, discard one card to end your turn. If time expires first, the card you just drew is discarded automatically—even if you moved it onto your board.

### Step 3: Build and Validate `CAT`

- Guide the player through placing `C`, `A`, and `T` into the three-letter row.
- Highlight the next required card and slot while keeping unrelated actions subdued.
- Use the real card movement interaction rather than a tutorial-only substitute.
- Mark the row valid after it spells `CAT` and call out the production valid-word presentation.
- Explain that a filled unrecognized arrangement would remain editable but would be marked invalid and would not count toward winning. Do not force the player to create an invalid example.

### Step 4: Choose a Strategic Discard

- Ask the player to end the turn by discarding either `X` or `Y`.
- Accept both filler cards so the player has a small but meaningful choice.
- Block discarding `C`, `A`, `G`, `M`, or `T` during this guided step so the deterministic scenario cannot become unwinnable.

Suggested coach copy:

> **End your turn by discarding one card.** A good rule is to discard the letter that gives you the fewest word possibilities.

- On the first 15-second hint, pulse `X` and `Y`.
- On the next hint, state that either `X` or `Y` is a strong choice.
- A valid filler discard moves the turn to Bot Dash and places that card on the discard pile.

### Step 5: Run Bot Dash's Turn

- Run a short deterministic opponent animation/state transition with no network delay.
- Explain that the local board remains editable during opponent turns, but do not require an off-turn move because Bot Dash acts quickly.
- Have Bot Dash finish by discarding `E`, which becomes the visible discard-pile top card and buries the player's earlier discard.
- Return turn ownership to the local player in the draw phase.

### Step 6: Draw From the Discard Pile

- Hint that the visible `E` makes a valid four-letter word possible.
- Highlight the discard pile and accept only a draw from that source for this step.
- Explain through the visible pile state that only the top discard is currently available.
- Drawing `E` moves the local turn into its arrange phase and marks `E` as the drawn card.

### Step 7: Independently Complete the Final Word

- Give the player the goal **Complete your final word** without highlighting exact card-to-slot moves.
- Allow real board rearrangement within the four-letter row so filled invalid arrangements can appear and be corrected.
- The seeded letters support `GAME`; the progressive hints should lead toward that word.
- Do not reject another genuinely valid word made from the available letters merely because it differs from the hint target. At minimum, account for `MAGE`, which is an anagram of `GAME`, or choose a small explicit tutorial validator whose accepted words are documented and tested.
- When both rows are valid, transition immediately to the finished state without asking for a second discard.

### Step 8: Complete the Tutorial

- Show the normal win/result treatment adapted for the tutorial.
- Point to the existing keyboard-help button and show a non-blocking speed tip.

Suggested completion copy:

> **Want to play faster?** Select a word row and type its letters directly. Open the keyboard button anytime to see every shortcut.

- Do not automatically open the keyboard-shortcuts dialog.
- Show **Complete Tutorial** as the completion action and return to Home when it is activated.

## Tutorial State Model

Create a purpose-built, pure tutorial reducer/state machine rather than adapting the WebSocket game machine. Keep the script explicit enough that every transition can be tested without rendering React.

Suggested state shape:

```ts
type TutorialStep =
    | 'draw-advantage'
    | 'drawn-card-rule'
    | 'build-cat'
    | 'cat-valid'
    | 'choose-discard'
    | 'bot-turn'
    | 'draw-discard'
    | 'build-final-word'
    | 'complete'

type TutorialState = {
    step: TutorialStep
    game: GameState
    localPlayerId: 'tutorial-player'
    botPlayerId: 'bot-dash'
    hintLevel: 0 | 1 | 2 | 3
    feedback: string | null
    progressRevision: number
}
```

The reducer/controller should:

- Seed stable card IDs, both word rows, player order, draw count, turn ownership, and pile state.
- Expose the same callback signatures consumed by `GameBoard`: draw, place, unplace, clear word/board, and discard.
- Validate every incoming action against the current tutorial step before mutating state.
- Treat rejected actions as feedback events, not partial mutations that must be undone.
- Recompute row validity and `allComplete` locally for the tutorial's intentionally tiny word set.
- Increase `progressRevision` only for meaningful progress so the inactivity timer resets predictably.
- Keep Bot Dash transitions deterministic and cancellable when the page unmounts.
- Keep all copy and step metadata centralized rather than scattering step checks through JSX.

## Hint Timing

Create a small inactivity-hint hook driven by the current step and `progressRevision`:

- Advance one hint level after each 15 seconds without meaningful progress.
- Reset to level zero whenever meaningful progress occurs.
- Do not show a visible hint countdown or impose any penalty.
- Pause hint advancement while the document is hidden so returning to the tab does not immediately reveal every answer.
- Cancel all scheduled timers on step changes and unmount.
- Provide step-specific hint content: target pulses first, a directional clue second, and an explicit answer only at the final level.

## Component and Routing Work

### Home and route entry

- Add `/tutorial` to `frontend/src/App.tsx`.
- Add **Play Tutorial** below the existing Create/Join row in `frontend/src/pages/Home/Home.tsx`.
- Add responsive styling in `frontend/src/pages/Home/Home.css` without changing the existing Create/Join relationship.
- Navigate directly to `/tutorial`; do not write player/session state.

### Tutorial page

Create a colocated page module, following existing page conventions:

```text
frontend/src/pages/Tutorial/
├── Tutorial.tsx
├── Tutorial.css
├── Tutorial.stories.tsx
├── components/
│   └── TutorialCoach.tsx
└── state/
    ├── tutorialFixtures.ts
    ├── tutorialReducer.ts
    ├── tutorialReducer.test.ts
    ├── tutorialSteps.ts
    └── useTutorialHints.ts
```

Names may be adjusted during implementation, but keep fixtures, pure transitions, presentation, and timer behavior separated.

### Reusing production components

- Render the production `GameBoard` and `GameHud`; do not build a miniature duplicate board.
- Keep all tutorial orchestration outside `GameBoard`.
- Add only narrow, generic guidance hooks to shared components where required, such as:
  - stable target identifiers for cards, piles, rows, slots, and the keyboard-help action;
  - optional emphasized/subdued presentation;
  - optional per-action eligibility so unavailable tutorial actions are also unavailable to pointer and keyboard users.
- Avoid tutorial step names, seeded letters, or tutorial copy in shared components.
- Preserve existing production behavior when guidance props are omitted.
- Prefer extending existing types and callbacks over forking `GameBoard` markup.

### HUD and completion treatment

- Either add a generic paused/context presentation to `GameHud` or wrap it with tutorial-only labeling without altering production model behavior.
- Ensure the visible frozen timer and its accessible label both communicate that it is paused.
- Reuse the visual language of `GameOverDialog`, but do not inherit multiplayer-only actions such as Play Again or host checks.

## Accessibility and Interaction Requirements

- Keep every tutorial action completable with pointer, touch-style pointer input, and the production keyboard interaction model.
- Mark blocked guided controls as unavailable semantically as well as visually; do not leave focusable controls that silently do nothing.
- Announce coach-step changes, successful actions, rejected-action feedback, valid/invalid row changes, Bot Dash's discard, and tutorial completion through concise live regions.
- Do not move focus on every automatic step. Move it only when route entry, a dialog, or completion semantics require it.
- Keep **Exit Tutorial** keyboard reachable and give it an unambiguous accessible name.
- Do not rely on color alone for emphasized targets or valid/invalid states.
- Respect reduced-motion preferences for pulses, Bot Dash actions, and completion effects.
- Keep the coach panel and highlighted targets usable at current mobile breakpoints without covering the hand, piles, or required slots.

## Test Plan

### Pure state tests

Cover the tutorial reducer/controller with table-driven tests for:

- Exact initial fixture: `[3, 4]` rows, `C A G A M X Y`, empty discard pile, local turn, and `T` on top of the synthetic draw sequence.
- Drawing `T` only from the permitted source and preserving the drawn-card identity after placement.
- Guided `CAT` placement and valid-row feedback.
- Rejected out-of-step actions leaving state unchanged while producing feedback.
- Accepting either `X` or `Y` as the first discard and rejecting required-letter discards.
- Deterministic Bot Dash transition and `E` becoming the visible discard top.
- Drawing `E` only from the discard pile.
- Filled invalid final-row arrangements remaining editable and incomplete.
- Accepting every explicitly supported valid final anagram.
- Immediate completion when both rows become valid, with no final discard.

### Hint tests

Use fake timers to verify:

- No hint before 15 seconds.
- One escalation at each 15-second inactivity boundary.
- Meaningful progress resets the ladder.
- Rejected noise does not indefinitely postpone useful hints.
- Step changes, hidden-document state, and unmount clean up timers.

### Component and story coverage

- Add Tutorial stories for the opening, drawn-card explanation, valid `CAT`, discard choice, Bot Dash turn, discard draw, invalid final word, final hint, completed state, narrow viewport, and reduced motion.
- Add at least one Storybook interaction that completes the entire scripted lesson through user-visible controls.
- Update Home stories and router fixtures to assert the tutorial action and navigation.
- Add shared-component stories/tests for any new guidance or disabled-control props, proving omitted props preserve production behavior.
- Verify keyboard-only completion and opening the shortcut guide from the completion state.

### Verification commands

Run from `frontend/`:

```bash
npm run lint
npm run build
npx vitest run
```

## Documentation

- Add `docs/internal/frontend/pages/Tutorial.md` with the route, state ownership, scripted steps, hint behavior, accessibility behavior, and scope boundaries.
- Update `docs/internal/frontend/README.md` to list `/tutorial`.
- Update `docs/internal/frontend/pages/Home.md` with the new action hierarchy.
- Update `docs/internal/frontend/pages/Game.md` or the relevant component document only where shared `GameBoard`/HUD guidance hooks change their documented interface.
- Do not change backend protocol documentation; the tutorial has no backend contract.

## Implementation Sequence

1. Add pure tutorial fixtures, step metadata, reducer/controller, validity rules, and unit tests.
2. Add generic shared-board guidance/eligibility hooks with regression stories and tests.
3. Build the `/tutorial` page, coach panel, frozen HUD treatment, hint hook, Bot Dash automation, and completion state.
4. Add the Home action and application route.
5. Add end-to-end Storybook interaction coverage, keyboard/accessibility coverage, narrow-screen states, and reduced-motion states.
6. Update internal frontend documentation.
7. Run lint, production build, and the full frontend browser/unit test suite; fix only tutorial-related regressions.

## Completion Criteria

- A visitor can open Home, choose **Play Tutorial**, and finish without a second player or backend connection.
- The lesson reuses the production board and accurately teaches optional drawing, the one-extra-letter advantage, discard-to-end-turn, timed auto-discard, off-turn arrangement, discard-pile drawing, validation, and immediate victory.
- The deterministic script cannot be made unwinnable by guided actions.
- Hints escalate every 15 seconds of inactivity and reset on progress.
- The full HUD remains visible with a frozen, clearly paused `1:30` timer.
- **Exit Tutorial** is always available; **Complete Tutorial** returns Home after victory.
- Keyboard help is promoted at completion without interrupting the core lesson.
- No room, WebSocket, session, persistence, analytics, lobby flow, or backend change is introduced.
- Home, Tutorial, and affected shared-component stories/tests pass at desktop and narrow layouts.
- Frontend lint, build, and tests pass.
