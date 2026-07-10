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
   - Generate 3-5 distinct variants unless the user asks for a different count.
   - Give each variant a concise intent, such as crisp, playful, minimal, premium, dense, or animated.
   - Include the states the user needs to compare, including hover, focus, selected, disabled, loading, error, or active when relevant.
   - For animation variants, specify duration, easing, trigger, and reduced-motion behavior before implementation.

4. Implement temporary Storybook experiments:
   - Use Storybook titles under `Experiments/...`, for example `Experiments/Game/Card Selection`.
   - Include a `Current` or baseline story when a direct comparison is useful.
   - Prefer side-by-side stories and compact comparison matrices for visual review.
   - Keep production components untouched until the user chooses a direction. If a prototype needs alternate styling, isolate it in experiment-only wrappers, CSS classes, or local story render functions.
   - Avoid adding app routes or permanent toggles unless Storybook cannot represent the requested interaction.

5. Preserve quality constraints:
   - Keep layout dimensions stable across states and animations.
   - Verify mobile and desktop behavior for prototype surfaces.
   - Preserve keyboard focus visibility and accessible names.
   - Respect `prefers-reduced-motion` for motion-heavy prototypes.
   - Do not let prototype text or controls overflow their containers.

6. Present the result:
   - Start Storybook when practical, or provide the exact command from the frontend package.
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
