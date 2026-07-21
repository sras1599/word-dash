# Component: PlayerStatusStrip

## Purpose

Shows all players in authoritative server turn order. It answers who is active and how many of their word rows are valid; the command HUD remains the source for what to do next.

## Content

Each stable-height strip has three zones: a large initials avatar, the player's real name and activity, and a non-shrinking word-progress statistic. The local player keeps their real name as the primary identity and receives a secondary `You` tag. Activities follow the existing precedence for `Drawing…`, `Building…`, `Waiting`, `Winner`, and `Disconnected`.

The statistic shows valid words / total words. `GameBoard` derives word progress from the existing word board (`isComplete` rows over total rows), so no protocol field is added. Word progress is included in the article's accessible name and has a labelled visible group.

## Responsive Behaviour

- Wide desktop: wide vertical strips centered against the word workspace. The group's midpoint stays fixed so additional players expand it upward and downward.
- Medium: a responsive grid above the workspace, using the strip's information width as its minimum.
- Mobile/reflow: a keyboard-scrollable horizontal row that preserves DOM and server order.

The active player is indicated by an inset border treatment without an `ACTIVE` badge. Disconnected strips retain a dashed border, so the state does not rely on color. Rows never reorder, scale, or change border width when turn state or counts update.
