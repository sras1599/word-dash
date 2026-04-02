---
description: "Scaffold a new React page from a page README in docs/internal/frontend/pages/"
agent: "agent"
argument-hint: "Page name in PascalCase, e.g. Game"
tools: [read_file, create_file, file_search]
---

Scaffold a new React page for the Wordit frontend using the page README as the source of truth.

## Inputs

The page to build is: `$input`

Page README: [docs/internal/frontend/pages/$input.md](../../../docs/internal/frontend/pages/$input.md)

## Reference implementation

Study the Card component as the canonical example of code style and CSS conventions:

- Component: [frontend/src/components/Card/Card.tsx](../../../frontend/src/components/Card/Card.tsx)
- Styles: [frontend/src/components/Card/Card.css](../../../frontend/src/components/Card/Card.css)

Also check whether any files already exist in `frontend/src/pages/` — if so, read one as an additional reference for page-level conventions.

Read all reference files before writing any code.

## What to produce

Create two files in `frontend/src/pages/$input/`:

1. **`$input.tsx`** — React page component
2. **`$input.css`** — Page styles

## Rules

### Page component (`$input.tsx`)
- Export a named function component: `export function $input()`
- Use `useParams` (React Router) to destructure any route params declared in the README's **Route** line (e.g. `/game/:roomCode` → `const { roomCode } = useParams()`)
- Use `useNavigate` for all navigations described in the **Interactions** table
- Consume shared context with hooks (e.g. `useGame`, `useSession`) wherever the README's **Data Needed** section references non-local state; if the hook does not exist yet, add a `// TODO` comment
- Derive local UI state (form fields, panel visibility, loading/error flags) with `useState`
- Any WebSocket connection described in **Data Needed** must be opened inside a `useEffect` and closed in its cleanup function
- Sub-views and states from the README's **Sub-views / States** section must be rendered conditionally inside the single page component — do not split them into separate route-level components
- Compose child components from `../../components/` as the **Layout** section directs; do not re-implement UI that belongs to an existing component
- Inline validation errors (required fields, invalid codes) must be stored in local state and rendered adjacent to the relevant input
- Import CSS as `./$input.css`
- Do not import anything not needed

### Styles (`$input.css`)
- Anchor CSS custom properties on the root page class (e.g. `.page-game { --page-gap: 1rem; }`)
- Implement the top-level layout from the README's **Layout** section using CSS Grid or Flexbox
- Scope all class names with a `page-{name lowercase}` prefix: block `.page-{name}`, sections `.page-{name}__header`, `.page-{name}__board`, etc.
- Full-screen overlays (e.g. win overlay) use `position: fixed; inset: 0` with a `rgba(0,0,0,0.6)` backdrop
- Transitions on opacity and transform use `0.15s ease`
- Use `clamp()` or `min()` for responsive sizing where the README's layout implies variable widths
