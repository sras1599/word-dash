---
description: "Redesign a single frontend page to match the Word Dash visual overhaul spec. Use when: overhauling the UI of the Home, Lobby, or Game page to match the new Word Dash design."
agent: "agent"
argument-hint: "Page name in PascalCase, e.g. Home, Lobby, or Game"
---

Redesign the **$input** page of the Word Dash frontend to match the new visual design.

## Step 1 — Read all reference files first

Before writing any code, read every file listed below in full. Do not skip any.

1. **Design spec HTML**: [docs/internal/frontend/ui-redesign/$input/code.html](../../../docs/internal/frontend/ui-redesign/$input/code.html) — the source of truth for visual structure, colour values, spacing, and typography.
2. **Visual reference** (if it exists): [docs/internal/frontend/ui-redesign/$input/screen.png](../../../docs/internal/frontend/ui-redesign/$input/screen.png) — view this image to understand the target visual design.
3. **Existing page component**: [frontend/src/pages/$input/$input.tsx](../../../frontend/src/pages/$input/$input.tsx) — extract all business logic that must be preserved.
4. **Existing page styles**: [frontend/src/pages/$input/$input.css](../../../frontend/src/pages/$input/$input.css) — study the BEM + CSS custom property conventions, then replace the content.
5. **Global HTML shell**: [frontend/index.html](../../../frontend/index.html) — check whether Google Fonts are already linked.

---

## Step 2 — Inject Google Fonts into `frontend/index.html`

Add the three tags below inside `<head>` **only if they are not already present**. Do not duplicate existing font links.

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Be+Vietnam+Pro:wght@400;500;700&display=swap" rel="stylesheet" />
```

---

## Step 3 — Rewrite `frontend/src/pages/$input/$input.css`

Replace the full contents of the existing CSS file. Follow the rules below precisely.

### 3a. Derive design tokens from the Tailwind config

The design spec HTML contains a `<script id="tailwind-config">` block with a `colors`, `borderRadius`, and `fontFamily` configuration. Extract every value used by this page's HTML and map them to CSS custom properties on the root page class.

The root page class is `.page-{pagename}` where `{pagename}` is `$input` lowercased (e.g. `$input` = `Home` → `.page-home`).

```css
/* Example — actual values must come from the tailwind-config block */
.page-home {
  /* Colours — use the exact name from the tailwind config as the custom property name */
  --primary: #bb000f;
  --secondary: #406926;
  --background: #f9f9f9;
  --on-surface: #1b1b1b;
  --surface-container-lowest: #ffffff;
  /* … all colours referenced in this page's HTML … */

  /* Border radii */
  --radius: 1rem;
  --radius-lg: 2rem;
  --radius-xl: 3rem;
  --radius-full: 9999px;

  /* Typography */
  --font-headline: 'Plus Jakarta Sans', sans-serif;
  --font-body: 'Be Vietnam Pro', sans-serif;
}
```

Only include colours that actually appear in this page's HTML — do not copy the entire Tailwind palette.

### 3b. Assign BEM class names

Derive semantic BEM class names from the **role** of each HTML element, not from its Tailwind utilities. Every class must be prefixed with `page-{pagename}__`. Examples:

| Element role | Class name |
|---|---|
| Root page element | `.page-home` |
| Top navigation bar | `.page-home__nav` |
| Logo image inside nav | `.page-home__nav-logo` |
| Account/user icon button | `.page-home__nav-account` |
| Decorative floating letters container | `.page-home__floating-bg` |
| Individual floating letter tile | `.page-home__floating-letter` |
| Per-letter position variant | `.page-home__floating-letter--w`, `--a`, etc. |
| Hero section | `.page-home__hero` |
| Hero main heading | `.page-home__hero-title` |
| Hero tagline paragraph | `.page-home__hero-tagline` |
| CTA button group | `.page-home__cta` |
| Primary CTA button | `.page-home__cta-btn--primary` |
| Secondary CTA button | `.page-home__cta-btn--secondary` |
| Shared button base | `.page-home__cta-btn` |
| Footer | `.page-home__footer` |
| Footer logo | `.page-home__footer-logo` |
| Footer copyright line | `.page-home__footer-copy` |
| Footer nav link | `.page-home__footer-link` |

Define equivalent names for every element in the actual design spec.

### 3c. Write the CSS rules

Translate every Tailwind utility on each element into CSS rules for its BEM class. Use the custom properties defined in Step 3a instead of hard-coded hex values or size literals. **Scope every rule under `.page-{pagename}` — no global selectors.**

Key reference mappings (apply to all elements, not just these):

| Tailwind utility | CSS equivalent |
|---|---|
| `bg-primary` | `background-color: var(--primary)` |
| `text-on-surface` | `color: var(--on-surface)` |
| `font-headline` | `font-family: var(--font-headline)` |
| `font-body` | `font-family: var(--font-body)` |
| `rounded-full` | `border-radius: var(--radius-full)` |
| `rounded-xl` | `border-radius: var(--radius-xl)` |
| `rounded-lg` | `border-radius: var(--radius-lg)` |
| `backdrop-blur-xl` | `backdrop-filter: blur(24px)` |
| `shadow-2xl` | `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25)` |
| `transition-all` | `transition: all 0.2s ease` |
| `hover:-translate-y-1` | `:hover { transform: translateY(-4px) }` |
| `active:scale-95` | `:active { transform: scale(0.95) }` |

### 3d. Floating background element positioning

Each floating letter tile in the design has absolute positioning with a rotation, opacity, blur, and scale. Implement individual positions through class modifiers (e.g. `.page-home__floating-letter--w`), reading the exact `top`, `left`, `right`, `bottom`, `rotate`, `opacity`, `blur`, and `scale` values from the design spec's inline Tailwind classes and translating them to CSS properties.

The container `.page-home__floating-bg` must have:

```css
.page-home__floating-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}
```

---

## Step 4 — Rewrite `frontend/src/pages/$input/$input.tsx`

Replace the full contents of the existing TSX file. Follow the rules below precisely.

### 4a. Logo

Import the Word Dash SVG logo as a static asset and render it as an `<img>`. **Never render the logo as CSS text, raw SVG markup, or styled `<span>` elements.**

```tsx
import wordDashLogo from '../../assets/word-dash-logo.svg'

// In JSX — appears in the nav and optionally the footer:
<img src={wordDashLogo} alt="Word Dash" className="page-home__nav-logo" />
```

The import path from `frontend/src/pages/$input/` to assets is always `../../assets/word-dash-logo.svg`.

### 4b. JSX structure

Map each major section of the design spec HTML to JSX using the BEM class names defined in Step 3b. Use semantic HTML elements throughout:

- Navigation bar → `<nav>`
- Decorative floating letters → `<div className="page-home__floating-bg">` containing individual `<div>` tiles — **static elements only, no JS animation**
- Hero content → `<main>` wrapping a `<section>`
- Headings → `<h1>` (or `<h2>`, etc. as appropriate)
- CTA buttons → `<button>`
- Footer → `<footer>`

The **root element** of the component must carry `className="page-{pagename}"` (lowercased, e.g. `className="page-home"`).

### 4c. Preserve all business logic

**Copy every piece of logic below directly from the existing `$input.tsx` — do not simplify, omit, or rewrite any of it:**

- All `import` statements for `useState`, `useEffect`, `useNavigate`, `useParams`, and any other React hooks
- All imports from `../../lib/api`, `../../lib/session`, `../../lib/ws`, or any other utility
- Every `useState` declaration and its setter
- Every `useEffect` with its dependency array and cleanup function
- Every event handler function body, including form submit handlers and their validation branches
- Every `session.*` read and write call
- Every API call site and its `try/catch` block
- All inline validation error rendering (error messages adjacent to their inputs, tied to error state variables)
- All loading state rendering (disabled buttons, loading indicators)

Integrate this logic into the new JSX structure. The new layout must wire up every interaction that the original component had.

### 4d. Rules

- No Tailwind classes, no inline `style=` attributes.
- Do not import anything that is not used.
- Do not touch `$input.stories.tsx`.
- Floating background tiles are inert JSX — `pointer-events: none` — no `setTimeout`, `setInterval`, animation libraries, or JS-driven position changes.
- Forms that existed in the original page must still function identically: same validation rules, same API calls, same navigation on success.
