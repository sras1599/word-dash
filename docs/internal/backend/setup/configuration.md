# Configuration

All configuration is loaded from environment variables at startup. A `.env.example` file in the project root documents the available keys.

| Variable           | Required | Description                                            | Default |
|--------------------|----------|--------------------------------------------------------|---------|
| `PORT`             | No       | Port the HTTP + WebSocket server listens on            | `8080`  |
| `WS_PORT`          | No       | Port the dedicated WebSocket server listens on         | `8081`  |
| `DB_URL`           | Yes      | PostgreSQL connection string (DSN or URL format)       | -       |
| `REDIS_URL`        | No       | Redis connection URL. If unset, in-memory storage is used | -    |
| `TURN_DURATION_MS` | No       | Duration of the arrange phase in milliseconds          | `90000` |
