---
description: "Scaffold a new React component and its Storybook stories from a component README in docs/internal/frontend/components/"
agent: "agent"
argument-hint: "Component name, e.g. WordSlot"
tools: [read_file, create_file, file_search]
---

Scaffold a new React component for the Wordit frontend using the component README as the source of truth.

## Inputs

The component to build is: `$input`

Component README: [docs/internal/frontend/components/$input.md](../../../docs/internal/frontend/components/$input.md)

## Reference implementation

Study the Card component as the canonical example of how components are structured:

- Component: [frontend/src/components/Card/Card.tsx](../../../frontend/src/components/Card/Card.tsx)
- Styles: [frontend/src/components/Card/Card.css](../../../frontend/src/components/Card/Card.css)
- Stories: [frontend/src/components/Card/Card.stories.tsx](../../../frontend/src/components/Card/Card.stories.tsx)

Read all three files before writing any code.

## What to produce

Create three files in `frontend/src/components/$input/`:

1. **`$input.tsx`** — React component
2. **`$input.css`** — Component styles
3. **`$input.stories.tsx`** — Storybook stories

## Rules

### Component (`$input.tsx`)
- Export a named `interface ${input}Props` and a named function component `export function $input(...)`
- Derive props directly from the README's "Props / Data Needed" table
- Add callback props (e.g. `onClick`, `onDragStart`) as needed based on the "Interactions" section
- Use BEM class names: block `${input.toLowerCase()}`, elements `__element`, modifiers `--modifier`
- Compute `className` by joining conditional class strings, filtered with `.filter(Boolean).join(' ')` — same pattern as Card
- All interactions described in the README must be implemented (click, drag, keyboard where appropriate)
- Non-interactive variants must set `role` and `tabIndex` to `undefined`
- Interactive elements must be keyboard accessible (`Enter`/`Space` → trigger action, `tabIndex={0}`)
- Include correct ARIA attributes (`aria-label`, `aria-pressed`, etc.) appropriate to the component's role
- Import CSS as `'./$input.css'`
- Do not import anything not needed

### Styles (`$input.css`)
- Use CSS custom properties (`--component-width`, colours, radii, shadows) anchored on the root class
- Every modifier and element class described in the README gets its own rule
- Transitions on interactive state changes (`transform`, `box-shadow`, `border-color`) should use `0.15s ease`
- Use `aspect-ratio`, `clamp()`, or `em` for proportional sizing as directed by the README's layout section

### Stories (`$input.stories.tsx`)
- Import from `'@storybook/react-vite'` and `'storybook/test'`
- Set `title` to `'WordIt/$input'`
- Include `tags: ['autodocs']`
- Set a custom `backgrounds` parameter matching the game's palette: red (`#E8231A`), teal (`#2DB89C`), light (`#f5f5f5`) — default to red
- Use `fn()` for all callback args
- Export one named `Story` per meaningful visual/interactive state described in the README (use the "Key Behaviours" section as a guide)
- Each story export must have a JSDoc comment (`/** description */`) explaining what it demonstrates
- The `meta` object must `satisfies Meta<typeof $input>`
