# Layout Redesign — Phase 3: Centered, Wrapping Player Hand

## Goal

Center the cards inside the existing hand tray and allow the hand to form two, three, or more rows when the card count exceeds the available width.

## Layout Direction

- Keep the hand tray at its current full width.
- Center every line of cards, including a partially filled final line.
- Preserve the server-provided card order from left to right and then top to bottom.
- Let the hand tray grow in normal document flow as rows are added.
- Avoid overlaying or covering the word board, pile controls, or keyboard-help control.

## Implementation Work

1. Remove the production override that forces `.player-hand__cards` to `flex-wrap: nowrap` and `justify-content: flex-start`.
2. Use a wrapping flex container with centered lines:

   ```css
   flex-wrap: wrap;
   justify-content: center;
   align-content: center;
   ```

3. Remove normal horizontal scrolling once wrapping is enabled. Do not clip card hover, focus, selected, or drawn-state elevation at the tray edges.
4. Keep the entire expanded hand region registered as a single DnD drop target.
5. Ensure card gaps remain consistent horizontally and vertically.
6. Keep card sizes responsive through the existing page-level card-width variable rather than shrinking cards to force one line.

## Drawn Card Handling

- Preserve the drawn card's position in the hand order used by production.
- Continue to distinguish it through the existing drawn-card state.
- Review the optional `drawnCard` plus divider composition used by standalone stories. A divider must not become an isolated item at the start or end of a wrapped line.
- If a robust divider cannot be guaranteed with arbitrary wrapping, replace it with spacing or a drawn-card wrapper treatment rather than forcing the card onto a particular line.

## Empty and Interactive States

- Keep the empty-hand message centered.
- Preserve a useful minimum drop-target height when all cards are on the word board.
- Verify selected-card keyboard navigation remains based on logical card order, not visual row calculations.
- Ensure dragging a board card back to a multi-row hand behaves exactly like dropping it on a single-row hand.

## Storybook and Test Coverage

Add fixed-width story containers that deliberately produce:

- One centered row.
- Two rows with an incomplete final row.
- Three rows.
- A large hand with several rows.
- A wrapped hand containing the drawn card.
- Empty and drag-over hand states.
- Narrow mobile cards and long desktop rows.

Keep interaction coverage for selection, drag start/end, drawn-card styling, and drop-on-hand behavior.

## Primary Files

- `frontend/src/components/PlayerHand/PlayerHand.css`
- `frontend/src/components/PlayerHand/PlayerHand.tsx`, only if divider markup needs adjustment
- `frontend/src/components/PlayerHand/PlayerHand.stories.tsx`
- `frontend/src/components/GameBoard/GameBoard.css`
- `frontend/src/components/GameBoard/GameBoard.stories.tsx`

## Completion Criteria

- A normal hand is centered rather than left aligned.
- Cards wrap into as many rows as necessary without horizontal clipping.
- Each flex line, including the last, is centered.
- Card order, selection, dragging, and drop-on-hand behavior are unchanged.
- Additional rows increase page height cleanly and do not overlap another region.
