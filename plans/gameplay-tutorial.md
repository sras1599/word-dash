# Gameplay Tutorial

## Summary

Add a short, optional tutorial that teaches the actual Word Dash loop before a player's first game. The tutorial should reduce first-turn uncertainty without delaying returning players or duplicating a permanent rules manual.

This plan is intentionally deferred. The core interface should remain understandable without the tutorial; the tutorial supplements the state-specific guidance described in `plans/game-ux-simplification.md`.

## Learning Objectives

By the end of the tutorial, a player should understand:

1. The goal is to complete one valid word for each displayed target length.
2. On their turn, they draw from either the deck or discard pile.
3. They can arrange letters in their word rows, including during another player's turn.
4. The active player discards one card to end their turn.
5. If time expires, the newly drawn card is automatically discarded.
6. The first player to complete every required word wins.

Keyboard shortcuts, whole-board clearing, custom lobby settings, reconnection behavior, and other advanced features are outside the first-run tutorial.

## Entry and Persistence

- Offer the tutorial in the lobby before the first game rather than interrupting a live timed turn.
- Show a concise host-independent prompt such as `New to Word Dash? Learn the game in under a minute.`
- Provide clear `Start tutorial`, `Not now`, and close actions.
- Store tutorial completion locally, versioned independently from player/session identity.
- Treat dismissal separately from completion so the product can offer a nonintrusive `How to play` entry later.
- Always provide a `How to play` action from the lobby and game help surface, even after completion.
- Do not require tutorial completion to mark ready, join a game, or play.

Suggested local state:

```ts
type TutorialProgress = {
    version: number
    status: 'not-started' | 'dismissed' | 'completed'
}
```

## Tutorial Experience

- Use a small interactive practice board with synthetic local state; do not connect tutorial actions to the real room or WebSocket.
- Prefer learning by doing over a sequence of text-only slides.
- Keep the experience to four short steps:

### Step 1: Understand the Goal

- Show example rows labelled by target length.
- Explain that every row must contain a valid word.
- Demonstrate both `Not a valid word` and `Valid word` using text/icon feedback as well as color.
- Continue after the player acknowledges the goal; no spelling task is required yet.

### Step 2: Draw a Card

- Present a small deck and discard pile with a visible top discard card.
- Ask the player to choose either pile.
- Show the drawn card joining the practice hand and explain that only the active player draws.
- Do not penalize either choice.

### Step 3: Build a Word

- Ask the player to select a supplied hand card and then select its highlighted destination.
- Mention that dragging and keyboard shortcuts are optional faster methods, without teaching their details.
- Validate the completed example row and show clear success feedback.
- Explain that word arrangement remains available while opponents take their turns.

### Step 4: Discard and Finish the Turn

- Ask the player to select a card and use the explicit discard action.
- Show the turn moving to a fictional opponent.
- Explain the timer and automatic discard consequence in one sentence.
- Finish with a compact recap and `Done` action.

## Content Guidelines

- Use the exact terminology and action labels from the production game.
- Keep each step to one instruction sentence and, where useful, one supporting sentence.
- Put instructions next to the element the player should interact with.
- Do not expose the entire game screen behind a sequence of disconnected spotlights.
- Let players move backward, close at any time, and restart from the first step.
- Preserve progress only if resuming adds value; otherwise restart the sub-minute experience cleanly.
- Avoid countdown pressure inside the practice interaction.

## Implementation Approach

- Build the tutorial as a dedicated modal or route rendered from lobby-level UI.
- Reuse visual components such as cards, piles, hand, slots, and rows, but keep tutorial state in a purpose-built local reducer.
- Do not reuse the live `GameBoard` wholesale if doing so requires fake networking props or hides tutorial-specific focus order.
- Define tutorial steps as data where possible, while keeping interactive transitions explicit and testable.
- Version persistence so substantially revised rules or interaction patterns can be retaught.
- Centralize gameplay copy shared with the main interface to reduce terminology drift.
- If product analytics are introduced, limit events to tutorial offered, started, step completed, dismissed, and completed; do not add analytics as a prerequisite.

## Accessibility

- Move focus into the tutorial on open and restore it to the trigger on close.
- Trap focus while presented as a modal and support Escape without losing the user's real lobby state.
- Announce step changes and successful practice actions without reading the entire practice board repeatedly.
- Provide full keyboard operation and ensure practice actions do not depend on dragging.
- Use text and icons in addition to color for valid, invalid, selected, and completed states.
- Respect reduced-motion preferences and avoid celebratory motion that blocks the next action.

## Test Plan

- First-time state offers the tutorial; completed state does not automatically offer it again.
- `Not now` dismisses without blocking readiness or gameplay.
- `How to play` can reopen the tutorial after dismissal or completion.
- Each practice step advances only after its intended action.
- Back, close, restart, and completion produce the expected persisted status.
- Opening or closing the tutorial does not mutate real lobby/game state or send WebSocket messages.
- Keyboard-only and screen-reader flows can complete all steps.
- Tutorial examples match the current word validity and card interaction presentation.
- Storybook stories cover every step, dismissal, completion, narrow screens, and reduced motion.
- Run frontend unit tests, Storybook browser tests, lint, and production build.

## Open Decisions for Future Work

- Whether the tutorial should be offered immediately on lobby entry or placed beside the Ready action.
- Whether dismissed tutorials should be offered again after a time interval or only through `How to play`.
- Whether a later advanced tutorial should teach shortcuts and board-clearing actions.
- Whether tutorial completion should be local-device only or eventually associated with a persistent account.

## Assumptions

- The production game has already adopted clear click-to-place and explicit discard interactions before this tutorial is implemented.
- No user account exists, so tutorial progress initially belongs in local storage.
- The tutorial teaches stable game rules and should be revised when those rules or primary interactions change.
- A player can understand and complete the tutorial in approximately one minute.
