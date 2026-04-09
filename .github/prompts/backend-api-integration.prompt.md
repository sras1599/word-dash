---
description: "Implement a single REST endpoint or WebSocket event handler in the Wordit Go backend. Use when: implementing a specific API endpoint or WS event that is currently stubbed or missing."
agent: "agent"
argument-hint: "Endpoint or event to implement (e.g. 'POST /rooms', 'POST /rooms/:roomCode/join', 'lobby:join', 'game:draw_card')"
---

You are implementing **one specific REST endpoint or WebSocket event handler** in the Wordit Go backend located at `backend/`.

Target: **${input}**

If the target is empty or unclear, ask:
> "Which endpoint or event do you want to implement? Examples: `POST /rooms`, `POST /rooms/:roomCode/join`, `lobby:join`, `game:draw_card`."

Then stop and wait for the user's answer before continuing.

---

## References

Read these before doing any work:

- REST API contract: [docs/internal/backend/api/rest.md](../../docs/internal/backend/api/rest.md)
- WebSocket protocol: [docs/internal/backend/api/websocket.md](../../docs/internal/backend/api/websocket.md)
- Architecture overview: [docs/internal/backend/architecture/overview.md](../../docs/internal/backend/architecture/overview.md)
- Game domain models: [docs/internal/backend/game/domain-models.md](../../docs/internal/backend/game/domain-models.md)
- Data storage: [docs/internal/backend/storage/data-storage.md](../../docs/internal/backend/storage/data-storage.md)

---

## Phase 1 — Audit

Read the current state of the backend code relevant to the target endpoint/event. Then print a gap table in this exact format:

| Gap | File | Detail |
|-----|------|--------|
| (what is not implemented) | (file path) | (specific issue) |

Check the following, scoped to what the target endpoint/event actually needs:

- **The handler function** — is it in `backend/api/http/handlers.go` or `backend/api/ws/handlers.go`? Is it stubbed (returns `StatusNotImplemented` or `TODO`) or missing entirely?
- **Internal package dependencies** — what functions in `backend/internal/` (room, game, store, deck, dictionary) does the handler need? Do they exist and are they implemented, or are they stubs?
- **Request validation** — is incoming JSON decoded and validated, or is it missing?
- **Store reads/writes** — are the necessary persistence calls present?

Do not invent gaps. Only report what you observe in the actual files.

---

## Phase 2 — Implement

Implement **only** the target endpoint or event handler. Do not modify anything unrelated to the target.

### Step 1 — Read existing code first

Before writing any code, read the relevant internal package files (`backend/internal/room/room.go`, `backend/internal/game/game.go`, etc.) to understand existing data structures. Do not introduce duplicate types or conflicting patterns.

### Step 2 — Implement missing internal functions

If the handler depends on internal functions that are missing or stubbed, implement them first — one file at a time.

### Step 3 — Implement the handler

Wire the internal functions into the handler. Follow these conventions observed in the existing codebase:

**HTTP error responses** — always JSON, matching the contract in the REST docs:
```go
writeJSON(w, http.StatusBadRequest, map[string]string{"error": "<message>"})
```

Expected status codes (from REST docs):
- `400` — missing or invalid fields
- `404` — room not found
- `409` — room full or game already in progress

**WebSocket error events** — send only to the offending client:
```json
{ "event": "game:error", "payload": { "code": "NOT_YOUR_TURN", "message": "..." } }
```

**Error handling** — use idiomatic Go; return errors rather than panicking.

**Input decoding** — decode request body JSON with `json.NewDecoder(r.Body).Decode(...)` and validate required fields before passing to internal logic.

### Step 4 — Verify

After implementing, confirm:
```
cd backend && go build ./...
```

If there are compile errors, fix them before finishing.

---

## Definition of done

- The target endpoint/event is fully implemented per the API contract in the docs
- `go build ./...` in `backend/` succeeds with no errors
- Only files relevant to the target endpoint/event were modified
