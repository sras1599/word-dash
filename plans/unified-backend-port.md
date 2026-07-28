# Unified Backend HTTP and WebSocket Port Implementation Plan

## Goal

Expose the backend REST API and WebSocket API through one Go HTTP server and one
backend port. The unified listener uses `PORT` (default `8080`) and serves the
existing REST routes, `/healthz`, and `/ws` without changing the externally
visible production URL structure.

This is a coordinated breaking deployment. Remove the old WebSocket port
configuration rather than maintaining a transitional dual-port mode.

## Confirmed Decisions

- Run exactly one `http.Server` and one listener.
- Use `PORT`, defaulting to `8080`, for both REST and WebSocket traffic.
- Remove `WS_PORT`, `Config.WSPort`, `WSAddr()`, port `8081`, and all second-server
  startup/shutdown behavior.
- Rename `RESTAddr()` to the protocol-neutral `Addr()`.
- Preserve the existing middleware boundary:
  - REST routes use origin enforcement and HTTP request logging.
  - `/ws` must not pass through the current REST logging response-writer wrapper.
  - WebSocket connection/disconnection/upgrade logging remains in the WebSocket
    hub.
- Keep one process health endpoint at `/healthz`.
- Preserve route contracts:
  - internal REST paths remain unchanged;
  - the internal WebSocket path remains `/ws`;
  - production REST remains externally available below `/api`;
  - production WebSockets remain externally available below `/realtime/ws`.
- Keep `VITE_API_URL` and `VITE_WS_URL` independently configurable because their
  schemes and external path prefixes differ. Only change the local/default
  WebSocket port from `8081` to `8080`.
- Update Kubernetes so both ingress routes target the same backend Service port.
- A brief interruption during deployment is acceptable. Do not add temporary
  compatibility listeners or a two-phase migration.
- Make `CORS_ORIGIN` the shared REST and WebSocket browser-origin policy.
- Add a real same-listener regression test using `httptest.Server` and an actual
  Gorilla WebSocket dial/upgrade.

## Origin Policy

### Configuration contract

`CORS_ORIGIN` must contain exactly one concrete HTTP(S) origin, for example:

```text
http://localhost:5173
https://word-dash.rasmalai.dev
```

At startup:

- require an `http` or `https` scheme;
- require a non-empty host;
- reject `*`;
- reject user information, non-root paths, query strings, and fragments;
- tolerate a single trailing slash by canonicalizing it away;
- fail startup with a clear log message when the value is invalid.

Keep the existing default `http://localhost:5173`. Validate the configuration in
the executable startup path without broadening this task into a redesign of the
package-level `config.Cfg` used for game defaults.

### Request behavior

Apply the following policy consistently to REST requests and WebSocket handshake
requests:

| Request `Origin` | Result |
| --- | --- |
| Header absent | Allow |
| Exactly equals canonical `CORS_ORIGIN` | Allow |
| Any other value | Reject before the route/upgrader |

An origin rejection must return:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{"error":"origin not allowed"}
```

Log the rejected origin, but do not echo it in the response. For an allowed REST
request with an `Origin`, set the normal CORS response headers and include
`Vary: Origin`. Preserve the current successful `OPTIONS` response behavior for
an allowed or absent origin.

Use one shared origin-policy helper rather than duplicating comparison rules in
the REST and WebSocket packages. Ordinary CORS response headers are not a
substitute for validating the WebSocket handshake's `Origin` header.

## Server Composition

Build one top-level handler with this effective shape:

```text
single http.Server on Config.Addr()
└── top-level router
    ├── /ws → origin gate → WebSocket hub
    └── /    → REST logging → REST CORS/origin middleware → REST router
              ├── /healthz
              └── /rooms...
```

The exact helper names may follow nearby style, but extract handler construction
from `main()` so tests and production use the identical composition. A reasonable
shape is:

```go
func newHandler(
    store room.Store,
    dict dictionary.DictionaryChecker,
    cfg config.Config,
) http.Handler
```

Important constraints:

- Do not wrap `/ws` with `api/http.LoggingMiddleware` as currently written. Its
  custom `responseWriter` does not forward `http.Hijacker`, so Gorilla's upgrade
  would fail.
- Do not solve that problem by expanding the REST wrapper unless a concrete test
  requires it; route-level middleware composition is the agreed design.
- Remove the WebSocket API package's duplicate `/healthz` registration. There can
  be only one health route on the combined server.
- Keep `/ws` on its existing exact path and preserve its query parameters,
  validation, event protocol, and reconnect behavior.
- Give the single server a neutral log label such as `HTTP` or `backend`.
- Retain graceful shutdown, but invoke it once for the single server.

## Suggested Work Breakdown

### 1. Configuration

Update `backend/config/config.go`:

- remove `defaultWSPort` and `Config.WSPort`;
- replace `RESTAddr()`/`WSAddr()` with `Addr()`;
- add focused origin validation/canonicalization;
- keep existing parsing behavior for unrelated settings;
- ensure the executable reports invalid configuration and exits before creating
  the server.

Add table-driven config tests covering at least:

- default origin;
- valid HTTP origin with port;
- valid HTTPS origin;
- trailing-slash canonicalization;
- wildcard rejection;
- missing scheme or host;
- unsupported scheme;
- user info;
- path, query, and fragment rejection.

### 2. Shared origin enforcement

Introduce a small internal origin policy abstraction usable by both transports.
It should own the canonical allowed origin and answer whether a request origin is
allowed. Keep request rejection/output close to the respective HTTP layers if
that avoids coupling response helpers across packages.

Update REST middleware to:

- allow absent origins;
- add CORS headers for the configured allowed origin;
- reject a present nonmatching origin with the agreed JSON `403` before invoking
  the next handler;
- add `Vary: Origin` where appropriate;
- preserve allowed preflight behavior.

Update WebSocket handling to:

- enforce the same policy before room/player validation and before upgrade;
- produce the agreed JSON `403` for a mismatch;
- remove the globally permissive `CheckOrigin` behavior;
- ensure Gorilla's upgrader also uses the policy as defense in depth, without
  replacing the stable pre-upgrade JSON response.

### 3. One listener and router

Update `backend/cmd/server/main.go`:

- construct the store, dictionary, hub, REST router, and combined top-level
  handler;
- start one server at `cfg.Addr()`;
- reduce the error channel capacity and lifecycle handling to one server where
  appropriate;
- shut down one server on `SIGINT`/`SIGTERM`;
- keep unrelated storage and dictionary startup behavior unchanged.

Update `backend/api/ws/handlers.go` so it no longer owns a duplicate health
endpoint. Preserve `/ws` registration in the API layer unless a smaller,
well-tested composition is clearer.

### 4. Regression tests

Add a composition test beside the server entry point (for example,
`backend/cmd/server/main_test.go`) that:

1. creates an in-memory store;
2. constructs the production handler composition with a no-op dictionary;
3. starts one `httptest.Server`;
4. creates a room through `POST /rooms` on that server;
5. uses the returned `roomCode` and `playerId` to dial `/ws` through the same
   temporary server address;
6. supplies the configured allowed `Origin` header;
7. verifies that the WebSocket upgrade succeeds.

This test must use a real Gorilla client handshake rather than only invoking a
handler with `httptest.ResponseRecorder`; the real handshake proves that routing
and response-writer composition preserve connection hijacking.

Add focused origin-policy tests for both REST and WebSocket paths:

- absent `Origin` succeeds;
- exact configured `Origin` succeeds;
- a different `Origin` returns status `403`, JSON content type, and the exact
  stable error payload;
- rejected requests do not reach the underlying REST handler or WebSocket room
  validation/upgrader;
- allowed REST preflight requests retain the expected status and headers.

Retain all existing handler and hub tests. Avoid timing-sensitive assertions on
long-lived WebSocket goroutines; close successful test connections explicitly.

### 5. Frontend defaults and build configuration

Update:

- `frontend/src/lib/config.ts`: default `WS_BASE_URL` becomes
  `ws://localhost:8080`;
- `frontend/Dockerfile`: default `VITE_WS_URL` becomes
  `ws://localhost:8080`.

Do not remove `VITE_WS_URL`, derive it from `VITE_API_URL`, or change deployed
`/api` and `/realtime` prefixes.

### 6. Container and Kubernetes deployment

Update `backend/Dockerfile` to expose only `8080`.

Update `deploy/k8s/backend.yaml`:

- remove the WebSocket container port and `WS_PORT` environment variable;
- retain one named container port on `8080`, preferably with a neutral name;
- expose one Service port targeting that container port;
- keep health probes on `/healthz` through the unified port.

Update `deploy/k8s/ingressroute.yaml`:

- preserve both `/api` and `/realtime` matches and both prefix-stripping
  middlewares;
- send both routes to the same backend Service port `8080`.

Do not alter the public host, TLS/WebSocket scheme, route prefix behavior, or
frontend ingress route.

### 7. Documentation

Update every repository reference that claims separate ports or documents
`WS_PORT`, including at least:

- `AGENTS.md` development commands and configuration section;
- `deploy/README.me` architecture/configuration text;
- backend/frontend internal documentation if affected by the final composition.

After editing, search the entire repository (excluding generated/vendor content)
for `8081`, `WS_PORT`, `WSPort`, `WSAddr`, and `RESTAddr`. Any remaining occurrence
must be intentional and explained.

## Verification Commands

Run from the relevant application directories:

```bash
cd backend && gofmt -w <changed-go-files>
cd backend && make test
cd backend && make build
cd backend && make lint
cd frontend && npm run lint
cd frontend && npm run build
```

If dependencies are already installed, also run any focused frontend tests that
cover configuration consumers. Do not modify lockfiles merely to run checks.

Perform final static searches from the repository root:

```bash
rg -n '8081|WS_PORT|WSPort|WSAddr|RESTAddr' . \
  --glob '!frontend/node_modules/**' \
  --glob '!frontend/dist/**' \
  --glob '!.git/**'
```

Optionally run the backend locally and verify both endpoints on `8080`, but do
not make Redis a requirement; the in-memory store is sufficient.

## Acceptance Criteria

- The backend opens only one application listener, on `PORT`.
- REST, `/healthz`, and a successful `/ws` upgrade all work through that port.
- No supported configuration or deployment artifact refers to `WS_PORT` or
  backend port `8081`.
- Existing internal and public API paths remain unchanged.
- REST middleware does not break WebSocket upgrades.
- Missing origins are allowed; the configured origin is allowed; all other
  origins receive the exact JSON `403` response for both REST and WebSocket
  handshakes.
- Invalid `CORS_ORIGIN` values prevent startup with a clear diagnostic.
- Local frontend defaults target WebSockets on port `8080` while retaining the
  independent API and WebSocket environment variables.
- Kubernetes routes `/api` and `/realtime` to the same Service port.
- Backend tests, build, and lint pass; frontend lint and build pass.

## Explicitly Out of Scope

- A temporary second listener or backwards-compatible `WS_PORT` no-op.
- A zero-downtime mixed-version Kubernetes rollout.
- Changing `/ws`, `/api`, or `/realtime` paths.
- Combining or deriving the two frontend URL environment variables.
- Supporting multiple allowed browser origins or wildcard origins.
- Authentication, authorization, CSRF design, or changes to player identity.
- Changes to the WebSocket event protocol, reconnect policy, or gameplay state.
- General refactoring of the global `config.Cfg` game-default dependency.
- Making all REST logging middleware wrappers implement optional
  `http.ResponseWriter` interfaces.

## Implementation Notes and Pitfalls

- `http.Server.Shutdown` does not manage hijacked WebSocket connections like
  ordinary HTTP requests. Preserve current lifecycle behavior; a broader socket
  drain design is not part of this task.
- Browser WebSocket handshakes send an HTTP(S) `Origin` even when the WebSocket
  URL uses `ws`/`wss`; compare it with the configured frontend HTTP(S) origin.
- Do not compare the WebSocket URL itself to `CORS_ORIGIN`.
- Do not use a simple substring or prefix match for origins. The match is exact
  after configuration canonicalization.
- The current REST logging wrapper hides `http.Hijacker`; the top-level routing
  structure must prevent `/ws` from reaching it.
- Both existing API muxes register `/healthz`; combining them without removing
  one registration will panic due to duplicate patterns.
- Untracked files are worktree-local. Commit this plan before creating the
  implementation worktree, or explicitly copy it into that worktree.
