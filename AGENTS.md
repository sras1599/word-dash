# Repository Guidelines

## Project Structure & Module Organization

Word Dash is split into two applications:

- `backend/` contains the Go server: entry points in `cmd/server`, handlers in `api/`, configuration in `config/`, and domain/storage code in `internal/`.
- `frontend/` contains the React, TypeScript, and Vite client: pages in `src/pages`, reusable UI in `src/components`, shared clients in `src/lib`, and static files in `public/`.
- `docs/internal/` documents architecture, protocols, game behavior, and UI. Update it when changing contracts or workflows.
- `docker-compose.yml` provides the optional local Redis service.

## Build, Test, and Development Commands

Run commands from the relevant application directory:

```bash
docker compose up -d redis       # Start Redis on port 6379
cd backend && make run           # Run REST :8080 and WebSocket :8081 servers
cd backend && make build         # Build backend/bin/server
cd backend && make test          # Run all Go tests
cd backend && make lint          # Run golangci-lint
cd frontend && npm ci            # Install locked frontend dependencies
cd frontend && npm run dev       # Start Vite on :5173
cd frontend && npm run build     # Type-check and create production assets
cd frontend && npm run lint      # Run ESLint
cd frontend && npm run storybook # Browse component stories on :6006
cd frontend && npx vitest run    # Run Storybook browser tests
```

## Coding Style & Naming Conventions

Format Go with `gofmt`; use lowercase package names, exported `PascalCase` identifiers, and descriptive error wrapping. Frontend code follows ESLint’s TypeScript, React Hooks, and Storybook rules. Use `PascalCase` for components and directories (`Card/Card.tsx`), `camelCase` for functions and variables, and colocate `.css` and `.stories.tsx` files. Preserve nearby formatting.

## Testing Guidelines

Place Go tests beside packages as `*_test.go`, favoring table-driven cases. Frontend interaction coverage belongs in `*.stories.tsx`; Vitest runs stories through headless Playwright/Chromium. Add regression coverage for behavior changes. No numeric threshold is enforced.

## Commit & Pull Request Guidelines

Recent commits use imperative prefixes such as `fix:`, `ui:`, `docs:`, `chore:`, and `dev:`; scoped forms like `chore (ui):` also appear. Keep commits focused. Pull requests should explain behavior, note API or configuration changes, link issues, and include UI screenshots. Confirm backend tests and frontend lint/build pass.

## Configuration & Security

The backend works in memory when `REDIS_URL` is unset. Common variables include `PORT`, `WS_PORT`, `REDIS_URL`, `CORS_ORIGIN`, `TURN_DURATION_MS`, and `DEFAULT_WORD_LENGTHS`; the frontend uses `VITE_API_URL` and `VITE_WS_URL`. Never commit credentials or local environment files.
