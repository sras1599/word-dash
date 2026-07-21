# Layout Redesign — Phase 5: Validation and Documentation

## Goal

Finish the layout redesign with regression coverage, full-page verification, and documentation that describes the new production behavior accurately.

## Regression Coverage

Expand Storybook stories and interaction tests so the redesigned layout is exercised as a system, not only as isolated components.

Required scenarios:

- Local player's draw phase.
- Local player's arrange phase with a drawn card.
- Opponent's turn.
- Disconnected player.
- Finished game and winner state.
- Three- and four-player server ordering.
- Partially completed word boards so player progress differs.
- Empty, ordinary, and large multi-row hands.
- Empty and active draw/discard piles.
- Selected-card discard and discard drag-over.
- Desktop, medium, and mobile production compositions.

Keep assertions focused on stable behavior and accessibility rather than pixel values that make normal visual refinement costly.

## Manual Visual Review

Compare the complete Storybook game page against the supplied references:

- `assets/player-strips.png`
- `assets/pill-imagined.png`
- `assets/draw-pile.png`
- `assets/hand.png`

Confirm that:

- Player strips have enough room for all intended information.
- Active-player treatment is border-led and does not add layout-shifting copy.
- Piles float beside the word workspace with no attached background panel.
- Piles are visibly larger and have no green borders.
- Hand cards are centered and wrap cleanly into multiple rows.
- The overall game-page layout remains balanced rather than allowing a redesigned region to dominate it.

## Automated Verification

Run from `frontend/`:

```bash
npm run lint
npm run build
npx vitest run
```

If browser infrastructure is unavailable, record the exact blocked command and complete the remaining checks. Do not weaken or delete unrelated tests to make the redesign pass.

## Documentation Updates

Update these documents after the implementation is stable:

- `docs/internal/frontend/components/PlayerStatusStrip.md`
  - Describe the wider information layout and word-progress statistic.
  - Document active-border and responsive behavior.
- `docs/internal/frontend/components/CardPile.md`
  - Remove language describing an attached dock.
  - Document the independent transparent pile group and non-green interaction feedback.
- `docs/internal/frontend/components/PlayerHand.md`
  - Replace the single-row horizontal-overflow rule with centered multi-row wrapping.
- `docs/internal/frontend/components/GameBoard.md`
  - Update desktop, medium, and mobile layout diagrams and breakpoint behavior.

No protocol documentation should change because this redesign uses fields already present in `GameState`.

## Final Review Checklist

- Pointer, touch, keyboard, and drag/drop actions dispatch the same callbacks as before.
- Player statistics match authoritative game state.
- Server player order is preserved.
- Layout emphasis does not authorize actions or shift geometry.
- Focus remains visible without green pile borders.
- Forced-colors and reduced-motion modes remain supported.
- No backend, WebSocket, or persistence behavior has changed.
- Unrelated working-tree changes are excluded from the implementation commits.

## Completion Criteria

- Frontend lint, build, and available browser tests pass.
- Storybook covers the redesigned components and integrated responsive layouts.
- Internal documentation matches production behavior.
- Visual review confirms all concerns from the supplied screenshots are addressed.
