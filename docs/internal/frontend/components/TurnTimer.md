# Component: TurnTimer

---

## Purpose

A visual countdown showing how much time the active player has left in their arrange phase. Visible to all players — not just the active one. Triggers a visual urgency state as time runs low.

---

## Layout

```
Normal state:          Urgent state (≤15s):
  ┌──────────┐           ┌──────────┐
  │  0:42    │           │  0:09    │  ← red + pulsing
  └──────────┘           └──────────┘
  [=========]            [==        ]  ← progress bar
```

Displays remaining time as `M:SS`. An optional circular or linear progress bar shows the proportion of time remaining.

---

## Props / Data Needed

| Prop               | Type      | Description                                                              |
|--------------------|-----------|--------------------------------------------------------------------------|
| `timeRemainingMs`  | `number`  | Milliseconds remaining in the turn. Drives the display.                  |
| `totalDurationMs`  | `number`  | Total turn duration (default: 60000ms). Used to calculate progress %.    |
| `isActive`         | `boolean` | Whether the timer is currently ticking (distinguish paused/idle states). |

---

## Interactions

- This is a display-only component. It does not fire events.
- The parent (game page) passes the `timeRemainingMs` from `GameState.turn.timeRemainingMs`, which is updated by the server via WebSocket ticks.

---

## Key Behaviours

- **Urgency threshold:** When `timeRemainingMs ≤ 15000` (15 seconds), the timer turns red and the text pulses with a CSS animation.
- **Sync:** The server sends periodic `game:timer_tick` events with the authoritative `timeRemainingMs`. The client may interpolate between ticks for smooth display, but the server value is always the source of truth.
- **Zero:** When `timeRemainingMs` reaches 0, the timer shows `0:00` and the component enters an expired state (solid red, no pulse). The server handles the actual turn transition.
- **Idle state:** When `isActive` is false (between turns), the timer is hidden or shows a neutral/empty state — it should not show the previous player's final time.
