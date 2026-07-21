# Component: PlayerStatusStrip

## Purpose

Shows all players in authoritative server turn order. It answers who is active and each player's connection/card state; the command HUD remains the source for what to do next.

## Content

Each stable-height row contains initials, `You` or the player's name, concise activity (`Drawing…`, `Building…`, `Waiting`, `Winner`, or `Disconnected`), and an explicitly labelled card count. Active, local, disconnected, and winner meaning is included in text or accessible names.

## Responsive Behaviour

- Wide desktop: compact vertical sidebar in the reserved left column.
- Narrow desktop/tablet: horizontal grid above the workspace.
- Mobile/reflow: horizontally scrollable strip that preserves DOM and server order.

Active changes use an inset outline and an `Active` text cue. Rows never reorder, scale, or change border width, so turn and count updates do not shift layout.
