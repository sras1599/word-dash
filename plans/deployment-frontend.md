# Frontend Deployment Plan — GitHub Pages

**TL;DR:** Add `base: '/wordit/'` to Vite config, set production API URLs in `.env.production`, build, handle SPA routing with a `404.html` copy, then push `dist/` to the `gh-pages` branch using the `gh-pages` npm package.

**Prerequisite:** The backend must be deployed and reachable at `https://wordit-api.duckdns.org` before running these steps — the production env vars point to it.

---

## Phase 1 — Code changes

### Step 1 — Add `base` to `frontend/vite.config.ts`

Add `base: '/wordit/',` inside `defineConfig({ ... })`. The file currently starts with:
```ts
export default defineConfig({
  plugins: [react()],
```
Change it to:
```ts
export default defineConfig({
  base: '/wordit/',
  plugins: [react()],
```

This tells Vite to prefix all asset paths with `/wordit/`, which is required because the site lives at `sras1599.github.io/wordit/` not the root.

### Step 2 — Create `frontend/.env.production`

Create this file with:
```
VITE_API_URL=https://wordit-api.duckdns.org
VITE_WS_URL=wss://wordit-api.duckdns.org
```

Vite automatically picks up `.env.production` during `npm run build`. The WebSocket client in `frontend/src/lib/ws.ts` appends `/ws?roomCode=...&playerId=...` to `VITE_WS_URL` at runtime, so the base URL must not include `/ws`.

### Step 3 — Add the `gh-pages` dev dependency

From the `frontend/` directory:
```bash
cd frontend
npm install --save-dev gh-pages
```

### Step 4 — Add a `deploy` script to `frontend/package.json`

In the `"scripts"` block, add:
```json
"deploy": "npm run build && cp dist/index.html dist/404.html && gh-pages -d dist"
```

The `cp dist/index.html dist/404.html` step is critical: GitHub Pages serves `404.html` when a visitor navigates directly to a deep URL like `sras1599.github.io/wordit/game`. Without this, React Router routes will return a 404.

---

## Phase 2 — Deploy

### Step 5 — Authenticate `gh-pages` with GitHub

The `gh-pages` CLI pushes to the `gh-pages` branch using your local git credentials. Verify your remote:
```bash
git remote -v
# SSH:   git@github.com:sras1599/wordit.git
# HTTPS: https://github.com/sras1599/wordit.git
```

- **SSH remote:** should work out of the box if your SSH key is added to GitHub
- **HTTPS remote:** run `gh auth login` (GitHub CLI) or ensure a credential helper is configured

### Step 6 — Run the deploy script

From the `frontend/` directory:
```bash
npm run deploy
```

This does four things in sequence:
1. `tsc -b && vite build` → outputs built files to `frontend/dist/`
2. `cp dist/index.html dist/404.html` → adds SPA routing fallback
3. `gh-pages -d dist` → force-pushes the contents of `dist/` to the `gh-pages` branch on GitHub

You should see output ending in `Published`.

---

## Phase 3 — Enable GitHub Pages

### Step 7 — Configure Pages in the GitHub repo

1. Go to `https://github.com/sras1599/wordit`
2. **Settings → Pages**
3. Under **Build and deployment → Source**, select **Deploy from a branch**
4. Branch: `gh-pages`, folder: `/ (root)` → click **Save**

GitHub will deploy within ~60 seconds. The live URL will appear at the top of the Pages settings page.

---

## Phase 4 — Verify

### Step 8 — End-to-end smoke test

1. Open `https://sras1599.github.io/wordit/` in a browser
2. Open DevTools → Network tab → filter by WS
3. Create a room — you should see a WebSocket connection to `wss://wordit-api.duckdns.org/ws?roomCode=...`
4. Open the same URL in a second browser tab, join the room with a different name
5. Both tabs should reflect each other's actions in real time

**If the site loads but API calls fail (CORS error in console):**
- Verify `CORS_ORIGIN=https://sras1599.github.io` is set in `~/wordit/.env` on the EC2 instance
- Run `sudo systemctl restart wordit` on the server after fixing the env file

**If assets 404 (blank page, JS not loading):**
- Verify `base: '/wordit/'` is set in `frontend/vite.config.ts`
- Verify the `gh-pages` branch has `index.html` at its root (not inside a `wordit/` subfolder)

**If navigating directly to a route (e.g. `/wordit/game`) returns a 404:**
- Verify `dist/404.html` exists after build — the `cp` in the deploy script should handle this

---

## Redeployment (after frontend changes)

From `frontend/`:
```bash
npm run deploy
```
