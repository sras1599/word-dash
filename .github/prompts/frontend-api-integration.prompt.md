---
description: "Integrate a single REST or WebSocket API route into the Wordit React frontend. Use when: wiring a specific API endpoint or WS event to frontend components, pages, or state."
agent: "agent"
argument-hint: "Route or feature to integrate (e.g. 'create room', 'POST /rooms', 'lobby WebSocket')"
---

You are integrating **one specific API route or feature** into the Wordit React frontend located at `frontend/`.

Target: **${input}**

If the target is empty or unclear, ask:
> "Which route or feature do you want to integrate? Examples: `POST /rooms` (create room), `POST /rooms/:roomCode/join`, `lobby WebSocket`, `game:draw_card`."

Then stop and wait for the user's answer before continuing.

---

## References

Read these before doing any work:

- REST API contract: [docs/internal/backend/api/rest.md](../../docs/internal/backend/api/rest.md)
- WebSocket protocol: [docs/internal/backend/api/websocket.md](../../docs/internal/backend/api/websocket.md)
- Frontend TypeScript types: [docs/internal/frontend/state/game-state.md](../../docs/internal/frontend/state/game-state.md)
- Frontend real-time events: [docs/internal/frontend/realtime/events.md](../../docs/internal/frontend/realtime/events.md)

---

## Phase 1 — Audit

Read the current state of the files relevant to the target route/feature. Then print a gap table in this exact format:

| Gap | File | Detail |
|-----|------|--------|
| (what is missing or wrong) | (file path) | (specific issue) |

Check the following, scoped to what the target route actually needs:

- **`frontend/src/lib/config.ts`** — does it export `API_BASE_URL` and `WS_BASE_URL` from `import.meta.env`?
- **`frontend/src/lib/api.ts`** — does a typed `fetch` wrapper exist, and does it include a function for the target REST route?
- **`frontend/src/lib/ws.ts`** — does a reusable WebSocket client exist? Does it use `{ "event": "...", "payload": ... }` format (not `{ "type": ... }`)?
- **`frontend/src/lib/session.ts`** — do typed helpers exist for `playerId` and `roomCode` in `sessionStorage`?
- **`frontend/src/context/GameContext.tsx`** — does a React Context + `useReducer` store exist for `GameState`? (Only relevant if the target route requires shared game state.)
- **The page or component that owns the target route** — are the API calls wired, or are there TODOs/placeholders?

Do not invent gaps. Only report what you observe in the actual files.

---

## Phase 2 — Implement

Implement **only** the changes needed to integrate the target route/feature. Do not modify anything unrelated to the target.

### Step 1 — Create missing shared infrastructure

Create these files only if they are missing AND the target route needs them.

**`frontend/src/lib/config.ts`**
```ts
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8081';
```

**`frontend/src/lib/session.ts`**
```ts
const PLAYER_ID_KEY = 'wordit_playerId';
const ROOM_CODE_KEY = 'wordit_roomCode';

export const session = {
  setPlayerId: (id: string) => sessionStorage.setItem(PLAYER_ID_KEY, id),
  getPlayerId: () => sessionStorage.getItem(PLAYER_ID_KEY),
  setRoomCode: (code: string) => sessionStorage.setItem(ROOM_CODE_KEY, code),
  getRoomCode: () => sessionStorage.getItem(ROOM_CODE_KEY),
  clear: () => {
    sessionStorage.removeItem(PLAYER_ID_KEY);
    sessionStorage.removeItem(ROOM_CODE_KEY);
  },
};
```

**`frontend/src/lib/api.ts`** — create if missing, or add the function for the target route if the file exists but is missing it. Use this pattern:
```ts
import { API_BASE_URL } from './config';

async function post<TBody, TResponse>(path: string, body: TBody): Promise<TResponse> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<TResponse>;
}

// Export one typed function per REST route, e.g.:
// export const createRoom = (name: string, variation: Variation) =>
//   post<..., ...>('/rooms', { name, variation });
```

**`frontend/src/lib/ws.ts`** — create only if the target is a WebSocket feature and this file is missing.

Requirements:
- Use native `WebSocket`, not socket.io
- All messages must use `{ "event": "<namespace>:<name>", "payload": ... }` — this is the server's wire format
- Provide a `send(event: string, payload?: unknown)` method
- Provide `on(event: string, handler: (payload: unknown) => void)` and `off(event, handler)` for subscriptions
- On unexpected close: reconnect with back-off (100 ms × 2^attempt, max 5 retries)

**`frontend/src/context/GameContext.tsx`** — create only if the target route requires shared game state and this file is missing. Use React Context + `useReducer`. Types must match those defined in [docs/internal/frontend/state/game-state.md](../../docs/internal/frontend/state/game-state.md).

### Step 2 — Wire the target route

After creating any missing infrastructure, wire the target route into the page or component that owns it. Follow the existing code patterns in that file.

For REST routes: call the typed function from `lib/api.ts`, store the returned `playerId`/`roomCode` via `lib/session.ts`, and navigate on success.

For WebSocket events: use `lib/ws.ts` to send client→server events and subscribe to server→client events. Update state via the `GameContext` reducer on each inbound event.

---

## Definition of done

- The target route/feature is fully wired end-to-end in the frontend
- No TypeScript errors: run `cd frontend && npx tsc --noEmit`
- Only files relevant to the target route were modified
