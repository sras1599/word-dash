# Word Dash: Render setup

Last checked: October 16, 2026.

Deploy the existing Go backend and React frontend without maintaining a VPS.
The backend now uses one port for REST, health checks, and WebSockets. Cold-start
and connection-recovery preparation below remains pending. No Render services
have been created as part of this code preparation.

## 1. Account setup

1. Create an account at [Render](https://render.com/).
2. Connect the Git provider containing this repository and grant access to it.
3. Use a Hobby workspace and choose **Free** for the backend's instance type.
4. Return to this project before deploying: complete the code preparation below,
   then commit and push the changes to the branch you intend to deploy.

Use Render-provided `onrender.com` addresses initially; a custom domain is optional.
Keep credentials in Render environment settings, outside the repository.

## 2. Prepare the code before deployment

### Complete: share one backend port

The backend registers `/rooms`, `/healthz`, and `/ws` on one HTTP server listening
on `PORT` (default `8080`) in `backend/cmd/server/main.go`. This is the standard
configuration for local development and all deployments; no additional mode
setting is needed. `WS_PORT` has been removed.

WebSocket upgrades bypass the REST logging/CORS wrapper so the connection retains
HTTP upgrade support. REST routes keep their existing logging and CORS behavior.
Local frontend defaults now use `http://localhost:8080` and `ws://localhost:8080`.

Tests, builds, and deployment verification for this change have been deferred.

Source: [Render WebSocket port requirements](https://render.com/docs/websocket).

### Pending: prepare for cold starts and interrupted connections

- Show a useful waiting state when the backend is starting. Render documents a
  roughly one-minute wake-up delay; the frontend should not treat that as a missing
  room or immediately invite repeated create/join submissions.
- Review `frontend/src/lib/ws.ts`: its five reconnect delays total about three
  seconds. Allow recovery over a longer startup window with bounded backoff and
  visible connection status. Do not replay non-idempotent gameplay actions.
- Add WebSocket ping/pong handling to detect stale clients during an active
  session. Let unused services sleep; do not add an external keep-awake service.
- With memory storage, show a clear recovery path when reconnecting to a room
  that disappeared after a backend restart.

Sources: [Free-service startup behavior](https://render.com/docs/free),
[WebSocket connection guidance](https://render.com/docs/websocket).

## 3. Create the backend web service

After the shared-port changes are pushed, choose **New → Web Service**, connect
the repository, and use:

| Setting | Value |
| --- | --- |
| Name | `word-dash-api`, or another available name |
| Branch | The branch containing the prepared code |
| Root Directory | `backend` |
| Runtime | Docker |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context | `.` |
| Instance Type | Free |
| Health Check Path | `/healthz` |
| Region | Closest available region to your players |

The Dockerfile already builds the Go binary and embeds the dictionary. No
separate dictionary service or database is needed for word validation.
Dockerfile and build-context paths above are relative to the `backend` root
directory. [Render monorepo settings](https://render.com/docs/monorepo-support).

Configure these environment variables:

| Variable | Value |
| --- | --- |
| `PORT` | Use Render's injected value; the single listener honors it |
| `CORS_ORIGIN` | Exact frontend origin, e.g. `https://word-dash.onrender.com` |
| `TURN_DURATION_MS` | Optional; current code defaults to `90000` |
| `DEFAULT_WORD_LENGTHS` | Optional; current code defaults to `3,4,5` |
| `REDIS_URL` | Leave unset for memory storage; see the persistence section |

If the frontend address is not assigned yet, update `CORS_ORIGIN` after creating
the static site. Allow the resulting backend deployment to finish before testing.

Do not copy `backend/.env.example` wholesale: it includes localhost database and
Redis URLs. `DB_URL` currently does not enable database storage; the store factory
selects only memory or Redis.

Record the actual backend address. Verify:

```text
GET https://<actual-backend-host>/healthz
Expected: HTTP 200 with {"status":"ok"}
```

## 4. Create the frontend static site

Choose **New → Static Site**, connect the same repository, and use:

| Setting | Value |
| --- | --- |
| Name | `word-dash`, or another available name |
| Branch | The branch containing the prepared code |
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |

Use Node 24, matching the existing frontend Dockerfile. If Render's default
differs, set `NODE_VERSION=24` in the site's environment settings.

Set these build-time variables using the backend's actual address:

```text
VITE_API_URL=https://<actual-backend-host>
VITE_WS_URL=wss://<actual-backend-host>
```

Use origins without trailing slashes. Do not append `/ws`: the client adds that
path itself. Vite embeds these values during the build, so changing them requires
a new frontend build.

Add this rule in **Redirects/Rewrites** so refreshing a lobby or game URL works:

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | Rewrite |

After Render assigns the frontend URL, set the backend's `CORS_ORIGIN` to that
exact origin. [Render static-site hosting](https://render.com/docs/static-sites).

## 5. Decide how rooms survive restarts

Memory storage is the smallest first deployment, but it is an initial option,
not a commitment to discard persistence. A database-backed store can be added
while retaining the Go game engine.

| Storage | What survives |
| --- | --- |
| Existing memory store | Nothing survives a backend restart, deployment, or sleep |
| Existing Redis adapter + Render Free Key Value | Backend restarts, provided Key Value itself does not restart |
| Future database-backed `room.Store` + external managed database | Backend restarts, subject to the database's retention and availability |

Render Free Key Value is not durable: it loses all data on its own restart.
Render Free Postgres expires after 30 days. Local SQLite on a free web service
also cannot provide persistence because its filesystem is ephemeral.
[Render free storage limitations](https://render.com/docs/free).

A future database adapter must persist hidden piles, hands, connection state,
and turn deadlines; serialize room mutations transactionally; and normalize
connection state on backend startup. Existing players must reconnect before
being considered connected. Merely setting `DB_URL` will not implement this.

While the backend sleeps, no Go timers execute. Persisted deadlines can be
reconciled after waking; persistence alone does not execute timeout transitions
during downtime.

## 6. Verify the first deployment

- Confirm `/healthz` succeeds and both REST and `/ws` use the same public host.
- Open the frontend in two independent browser sessions or on two devices.
- Create a room, join by code, start a game, and complete several turns.
- Check private hands, drawing, board edits, discards, and automatic turn expiry.
- Refresh direct `/lobby/<code>` and `/game/<code>` links; confirm the app loads.
- Disconnect and reconnect one player; check that state and deadlines reconcile.
- Let the backend become idle for over 15 minutes, then start a new session.
  Confirm the startup wait is understandable and the app recovers.
- Restart the backend intentionally and confirm the selected storage behavior:
  memory rooms disappear; a future persistent store should restore them.
- Check browser network errors and Render logs for CORS, mixed-content, upgrade,
  and storage failures. Confirm the deployed frontend uses HTTPS and WSS.

Before shipping code changes, run backend tests and frontend lint/build, plus
regression coverage for listener routing and changed connection behavior.

## Free-tier expectations

Render Free sleeps after 15 minutes without inbound HTTP or WebSocket messages
and wakes on a new request or connection. Incoming gameplay can prevent idle
sleep; an open socket alone is not a guarantee. Render can restart free instances
at any time.

The workspace receives 750 free instance-hours per month shared by its free web
services. Static hosting does not consume those hours, but frontend and backend
both use bandwidth and build allowances. Check current usage in Billing. With a
payment method attached, excess bandwidth/build usage can incur charges;
without one, service or build restrictions apply instead.
[Current free-tier conditions](https://render.com/docs/free).

For game nights, wait for the backend to become healthy before inviting others,
and avoid deploying during an active game when using memory storage.
