# Word Dash Design Foundation

This document defines the lightweight, app-local UI foundation for Word Dash. It is not a separate design-system package; it is a shared vocabulary for tokens, primitives, game components, page layouts, and Storybook review.

## Scope

The foundation should make repeated interface decisions easier to reuse without flattening the game into generic UI. Shared primitives belong under `frontend/src/components/ui/` when they cover repeated controls or containers. Game components stay in their current component folders and keep ownership of card, hand, board, row, slot, pile, HUD, and turn-specific behavior.

## Principles

- Game actions should be immediately visible in the current phase.
- UI state must not rely on color alone.
- Interactive controls should have consistent focus, disabled, hover, pressed, and pending states.
- Compact operational screens should use restrained layout and avoid marketing-page composition.
- Game-specific components may be expressive, but shared primitives should stay quiet and predictable.
- Tokens should encode semantic intent and common scale decisions.
- Prefer native HTML semantics before custom interaction logic.

## Current Inventory

### Colors

The active app palette is rooted in a warm page surface, a red primary action color, a green secondary action/status color, gold tertiary accents, and muted brown text/outline colors. The current global names in `frontend/src/index.css` are short aliases such as `--primary`, `--secondary`, `--background`, `--surface-container-lowest`, `--on-surface`, `--outline`, and `--error`.

Drift risks:

- Game page CSS redefines most global colors locally, which can hide palette drift.
- Card and pile components use physical-game colors such as teal, red, black, and card-face neutrals. Those should remain game-specific unless reused outside cards.
- Some Home CSS still uses raw `rgba(...)` values for panels, fields, focus, shadows, and footer text.
- Storybook backgrounds contain duplicated raw swatches for review surfaces.

### Typography

The app uses `Plus Jakarta Sans` for headline and button-like text, and `Be Vietnam Pro` for body copy. Root text is `18px/145%` on desktop and `16px` below `1024px`. Headings inherit headline font. Page-level headings frequently use bold weights and tight letter spacing; labels, badges, and eyebrows use uppercase text with widened tracking.

Drift risks:

- Button, label, badge, and compact status typography is repeated across Home, Lobby, Game, and game components.
- Some components fall back to `inherit` when rendered in isolated Storybook contexts.

### Spacing And Layout

Repeated spacing appears around page gutters (`1rem` to `1.5rem`), panel padding (`1.25rem`, `1.5rem`, `2rem`), control gaps (`0.5rem`, `0.75rem`, `1rem`), and large screen composition gaps (`2rem` to `2.75rem`). Home uses a centered first screen. Lobby uses a two-column settings/players grid that stacks at narrower widths. Game uses a thin logo bar, an independently sticky floating command HUD, reserved player and pile columns, and a compact in-flow hand.

Drift risks:

- Panel padding and grid gaps are repeated with page-local values.
- Touch target sizes are defined per component rather than through shared control sizes.
- Narrow viewport pressure points include long player names, full-width lobby controls, compact HUD text, and game board bottom chrome.

### Radius, Borders, Shadows, And Surfaces

The common shape language uses rounded pills for controls and badges, medium radii for fields, and larger radii for panels. Surfaces are often translucent white or low-container colors with soft shadows and backdrop blur. Game-specific cards and board regions use their own borders, stacks, and shadows.

Drift risks:

- Repeated panel shadows and translucent surfaces are hand-authored in Home, Lobby, Game, and HUD CSS.
- `--radius`, `--radius-lg`, and `--radius-xl` are useful but too generic for future additions.
- Some page sections are styled as large cards even when they are page compositions rather than reusable primitives.

### Controls And States

Repeated control patterns include primary and secondary action buttons, ghost/text buttons, icon-only timer controls, form labels and text inputs, segmented variation choices, player-ready buttons, copy buttons, error states, and modal/state-screen actions.

Current states include disabled, active/selected, hover, pressed, focus-visible, loading text, invalid fields, ready/not-ready/disconnected player states, urgent timers, valid/invalid word rows, and read-only game states.

Drift risks:

- `.wd-btn` is a global utility with broad transition behavior and variant classes. It should become a transitional alias while the `Button` primitive takes over repeated controls.
- Home has a page-local form field wrapper that duplicates patterns needed in Lobby and future dialogs.
- Lobby segmented choices and timer buttons are accessible native controls, but their visual states are page-local and repeated.
- Game overlay/state buttons duplicate action button styling.

## Component Categories

### Foundation Primitives

Use these for repeated, app-level UI patterns:

- `Button`: primary, secondary, ghost, and danger actions with size and pending states.
- `IconButton`: icon-only native button with a required accessible label.
- `Panel`: framed surfaces for actual tools, repeated items, dialogs, and compact containers.
- `Dialog`: modal shell with title, description, content, footer, close action, overlay dismissal, and Escape handling.
- `FormField`: label, hint, error, required, disabled, and control association.
- `TextInput`: native text input with consistent size, focus, disabled, and invalid styling.
- `Select`: native select when settings need a dropdown control.
- `SegmentedControl`: native button/radio-style grouped choices for variation and compact mode selection.

### Game Components

Keep these game-specific:

- `Card`, `CardPile`, `PlayerHand`, `WordSlot`, `WordRow`, `WordBoard`, `GameBoard`.
- `GameHud`, `TurnIndicator`, `OpponentStatus`.
- Drag-and-drop interactions, slot validation, card stacking, pile composition, hand overflow, and game phase copy.

These components may consume `--wd-*` tokens where it improves consistency, but they should not be renamed or generalized as foundation components.

### Page Compositions

Route-level layouts and workflows stay as page compositions:

- Home hero, create flow, and join flow.
- Lobby settings, players, room code, readiness, and bottom navigation.
- Game loading/error states, game chrome, board layout, overlays, and game-over flow.

Pages can compose primitives, but page-specific flow and routing behavior should remain in page modules.

## Migration Map

- `Button`: Home create/join/submit actions, Lobby copy/start/ready/apply/timer controls, Game state and overlay actions.
- `IconButton`: Lobby timer increment/decrement controls and future compact chrome actions.
- `Panel`: Home create/join form shell, Lobby settings and players containers, Lobby timer container, Game loading/error state panels, dialog surfaces.
- `Dialog`: Game-over dialog and future tutorial/help/keyboard-shortcut shells.
- `FormField`: Home name/room code fields, Lobby custom word-length input, future settings validation.
- `TextInput`: Home text fields and Lobby custom word-length input.
- `SegmentedControl`: Lobby variation picker and future compact mode controls.

Adoption should start with Home forms and actions, continue through Lobby settings controls, and only then touch Game chrome where primitives do not interfere with gameplay.

## Do Not Abstract Yet

- Physical card visuals, card back patterning, pile depth, and selected/drawn card styling.
- Drag-and-drop board logic, slot validation, and card placement affordances.
- Game HUD layout model and timer copy.
- Lobby player avatar colors and player-card readiness presentation.
- Page-specific floating letter backgrounds and decorative hero details.
- Storybook simulation controls, which serve test harness needs more than app UI needs.

## Token Naming Policy

Use `--wd-*` token names for shared app decisions:

- `--wd-color-*` for brand and status colors.
- `--wd-surface-*` for page, panel, raised, muted, and overlay surfaces.
- `--wd-text-*` for text color roles.
- `--wd-border-*` for border colors and focus rings.
- `--wd-radius-*` for shared shape decisions.
- `--wd-space-*` for repeated spacing steps.
- `--wd-shadow-*` for repeated elevation.
- `--wd-font-*` and `--wd-text-size-*` for shared type choices.
- `--wd-motion-*` for shared durations/easing.
- `--wd-z-*` for layering.

Add a token when a value expresses a repeated semantic decision. Keep values local when they describe one component's physical model or a one-off layout fix.

## Primitive Usage Rules

- Use `Button` for explicit actions and submit buttons. Choose `primary` for the main action in a surface, `secondary` for positive alternate actions, `ghost` for low-emphasis actions, and `danger` for destructive actions.
- Use `IconButton` only when the icon is sufficient in context and always provide a specific accessible label.
- Use `FormField` with `TextInput`, `Select`, or future native controls so labels, hints, errors, `aria-describedby`, and invalid states stay associated.
- Use `Panel` for framed tools, repeated items, dialogs, and settings groups. Avoid wrapping every page section in a panel.
- Use `Dialog` for modal workflows that need a title, optional description, dismissal, and footer actions.
- Use `SegmentedControl` for small choice sets where all options should be visible at once.

## Storybook Organization

Story titles use these groups:

- `WordDash/Foundation/*` for primitives and token-level UI review.
- `WordDash/Game/*` for domain components such as cards, rows, board, HUD, and game dialogs.
- `WordDash/Pages/*` for route-level Home, Lobby, and Game workflows.

Add or update a story when adding a primitive variant, visual state, responsive pressure point, or game state that changes what a user sees. Prefer narrow-container stories before adding custom responsive logic.

## Maintenance Rules

- Add a token when a value expresses a repeated semantic decision.
- Add a primitive only after a pattern appears in at least two places or is clearly foundational.
- Keep game-specific behavior in game components.
- Add or update a Storybook story when adding a variant, state, or visual rule.
- Prefer native HTML semantics before custom interaction logic.
- Do not use legacy token aliases in new code. They are compatibility aliases for older page and game-specific CSS, and should be removed only after those components migrate to `--wd-*` names.

## Global CSS Conventions

Public app-wide classes are intentionally small:

- `wd-page`, `wd-content-layer`, `wd-floating-bg`, and `wd-floating-letter` support shared page-shell structure.
- `wd-floating-letter--tile` supports the decorative page-letter treatment.
- `wd-sr-only` provides reusable visually-hidden content.
- `wd-eyebrow` remains a shared text treatment for compact uppercase labels.

The old `wd-btn` utility classes were removed after Home, Lobby, and Game chrome moved to the `Button` and `IconButton` primitives. New button-like UI should use primitives instead of global utility classes.
