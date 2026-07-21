# Layout Redesign — Phase 2: Card Pile Layout

## Goal

Make the draw and discard piles larger and visually independent from the word workspace. The pile column should feel like a collection of controls placed beside the board, not an attached sidebar panel.

## Design Direction

- Remove the pile dock's background, border, negative joining margin, and attached rounded-panel silhouette.
- Add visible horizontal space between the word workspace and the pile column.
- Restore a fully rounded right edge on the word workspace.
- Keep piles stacked vertically on wide screens and side by side when the responsive layout places them below the workspace.
- Increase pile cards without changing word-slot or hand-card sizes.
- Remove green decorative borders from the dock and pile cards.

## Layout and Sizing Work

1. Give the main grid a real column gap instead of relying on touching edges.
2. Remove the current asymmetric border radius from `.game-board__board-section`.
3. Strip `.game-board__piles` down to a transparent layout container:
   - No background.
   - No panel border.
   - No panel radius needed for decoration.
   - No negative margin.
4. Introduce a dedicated pile size variable, for example:

   ```css
   --game-board-pile-card-width: clamp(5.75rem, 6vw, 6.5rem);
   ```

   Pass this variable to `CardPile` through `--pile-width`. Do not reuse `--page-game-card-width`, because that variable also controls word slots.
5. Widen the pile grid column enough for the larger card, label, count, focus indicator, and stack offsets.
6. Check that labels remain centered and do not wrap unnecessarily.

## Interaction States

- Remove the current green static outline used during the local draw phase.
- Keep clickable affordance through cursor, elevation, and a restrained hover/focus response.
- Use the page's primary red for keyboard focus if a colored ring is needed.
- Preserve a clear discard drop-target and drag-over state, but do not use a green border. Prefer surface tint, elevation, icon/copy, or a primary-color treatment.
- Ensure state feedback is still visible in forced-colors mode.
- Do not change draw/discard authorization or DnD event handling.

## Storybook and Test Coverage

Update pile and board stories to cover:

- Normal, active, empty, and nearly exhausted draw piles.
- Normal, active, empty, drop-target, and drag-over discard piles.
- Both piles in the desktop vertical dock.
- Both piles in the narrow horizontal layout.
- Keyboard focus without green decorative borders.
- Production board parity with the larger pile size.

Existing tests for drawing, selected-card discard, keyboard activation, and drag/drop must continue to pass.

## Primary Files

- `frontend/src/components/GameBoard/GameBoard.css`
- `frontend/src/components/GameBoard/GameBoard.tsx`
- `frontend/src/components/CardPile/CardPile.css`
- `frontend/src/components/CardPile/CardPile.stories.tsx`
- `frontend/src/components/GameBoard/GameBoard.stories.tsx`

Avoid changing the shared `Card` component unless a pile-only override cannot express the required state. A shared-card change would also affect the hand, word board, and result dialog.

## Completion Criteria

- The pile area has no independent panel surface or border.
- The word workspace and piles are separated by clear whitespace.
- The board has complete rounded corners.
- Pile cards are visibly larger than before without changing other card compositions.
- No green decorative or interaction borders remain around the piles.
- Drawing and discarding remain fully operable with pointer, touch, drag, and keyboard input.
