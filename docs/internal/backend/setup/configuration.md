# Configuration

All configuration is loaded from environment variables at startup. A `.env.example` file in the project root documents the available keys.

| Variable           | Required | Description                                            | Default |
|--------------------|----------|--------------------------------------------------------|---------|
| `PORT`             | No       | Port the HTTP + WebSocket server listens on            | `8080`  |
| `DB_URL`           | Yes      | PostgreSQL connection string (DSN or URL format)       | -       |
| `REDIS_URL`        | Yes      | Redis connection string (for example `redis://localhost:6379`) | - |
| `TURN_DURATION_MS` | No       | Duration of the arrange phase in milliseconds          | `60000` |
