# Foundation Primitives

Foundation primitives live under `frontend/src/components/ui/`. They provide common app chrome and form behavior without replacing game-specific components.

## Components

| Primitive | Use For | Avoid For |
|-----------|---------|-----------|
| `Button` | Primary, secondary, ghost, danger, submit, and pending actions | Card clicks, drag targets, or game gestures |
| `IconButton` | Compact icon-only actions with clear accessible labels | Actions where the icon is ambiguous without visible text |
| `Panel` | Framed tools, repeated items, dialog surfaces, and settings containers | Generic page section decoration or nested card layouts |
| `Dialog` | Modal shells with title, description, content, footer, Escape, and overlay dismissal | Inline state panels or game board overlays that are not modal |
| `FormField` | Label, hint, error, required, disabled, and field association | Owning input state or custom validation logic |
| `TextInput` | Native text inputs with shared focus, invalid, disabled, and size treatment | Numeric timer steppers with specialized formatting |
| `Select` | Native dropdown settings | Segmented choice groups where all options should be visible |
| `SegmentedControl` | Small visible option sets such as lobby variation selection | Large option sets or free-form input |

## Accessibility

- Use native controls first.
- Associate field descriptions with `getFormFieldDescription(id, hasHint, hasError)`.
- Do not rely on color alone for selected, invalid, success, urgent, or disconnected states.
- Keep visible focus treatment intact on every interactive primitive.
- Icon-only actions must use a specific `label`, such as "Increase timer" rather than "Plus".

## Storybook Review

Review primitives under `WordDash/Foundation/*`. Stories should cover variants, sizes, disabled and pending states, errors and hints for fields, dense and comfortable panels, dialog dismissal, and narrow containers.
