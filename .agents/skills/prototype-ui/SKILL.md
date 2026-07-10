---
name: prototype-ui
description: Generate multiple inspectable frontend UI prototype variants from a user's prompt or a referenced prompt file. Use when Codex is asked to explore visual directions, interaction states, animations, Storybook experiments, UI styling alternatives, or temporary comparison components before choosing a production implementation.
---

# Prototype UI

## Overview

Use this skill to turn a UI idea into several concrete, reviewable prototype variants. Default to temporary Storybook experiment stories so the user can visually inspect options before production styling or component behavior is changed.

## Workflow

1. Gather the prompt:
   - Use the user's message as the source prompt when it contains the requested UI direction.
   - If the user references a prompt file, read that file completely before planning variants.
   - If both are present, treat the file as detailed source material and the message as the latest override.

2. Inspect the current UI before editing:
   - Read the target component, nearby stories, CSS, and page usage.
   - Check existing visual language, spacing, responsive behavior, states, and animation patterns.
   - Prefer existing component APIs, CSS custom properties, utilities, and Storybook conventions.

3. Create prototype specs:
   - Generate at least 5 distinct variants unless the user explicitly asks for more.
   - Give each variant a concise intent, such as crisp, playful, minimal, premium, dense, or animated.
   - Include the states the user needs to compare, including hover, focus, selected, disabled, loading, error, or active when relevant.
   - For animation variants, specify duration, easing, trigger, and reduced-motion behavior before implementation.

4. Implement temporary Storybook experiments:
   - Use Storybook titles under `Experiments/...`, for example `Experiments/Game/Card Selection`.
   - Include a `Current` or baseline story when a direct comparison is useful.
   - Always create a comparison matrix story that shows all prototype variants side by side.
   - Always create a separate story for each individual prototype variant so it can be inspected on its own.
   - Keep production components untouched until the user chooses a direction.
   - Inherit the target component's base styling by default. Prototype CSS must override only what is necessary for the specific experiment or state being tested.
   - If a prototype needs alternate styling, scope it to experiment-only wrappers, CSS classes, or local story render functions without restyling the component shell, dimensions, typography, or surrounding surface unless that is the explicit experiment.
   - Avoid adding app routes or permanent toggles unless Storybook cannot represent the requested interaction.

5. Preserve quality constraints:
   - Keep layout dimensions stable across states and animations.
   - Verify mobile and desktop behavior for prototype surfaces.
   - Preserve keyboard focus visibility and accessible names.
   - Respect `prefers-reduced-motion` for motion-heavy prototypes.
   - Do not let prototype text or controls overflow their containers.

6. Present the result:
   - Do not start, open, or restart the Storybook server. The skill's work is done once the prototype stories have been created.
   - Provide the exact Storybook title/path for the created prototypes so the user can find them in their already-running Storybook instance.
   - Summarize each variant by name and visual intent.
   - Make clear that the prototype code is temporary and should be removed or graduated after a decision.

## Story Naming

Prefer story names that make visual comparison easy:

- `Current`
- `Crisp Border`
- `Lift And Shadow`
- `Glow Ring`
- `Filled Accent`
- `Animation Comparison`

## References

- `references/prompt-examples.md`: Example prompts for invoking this skill with direct prompts or referenced prompt files.
