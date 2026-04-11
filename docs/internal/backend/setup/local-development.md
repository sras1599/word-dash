# Getting Started (Local Development)

## Prerequisites

- Go 1.22 or later
- Docker and Docker Compose (for Redis)

## Setup

```bash
# 1. Clone the repository (if not already done)
git clone https://github.com/sras1599/wordit.git
cd wordit/backend

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env with your local DB_URL and REDIS_URL if needed

# 3. Start Redis
docker compose up -d

# 4. Run the server
go run ./cmd/server
```

The server listens on `http://localhost:8080` by default.

Use one of these Redis URLs depending on where the backend runs:

- Backend running on host machine: `redis://localhost:6379`
- Backend running in the same Compose network: `redis://redis:6379`

## Makefile Targets

| Target         | Description |
|----------------|-------------|
| `make run`     | Run the server directly via `go run` |
| `make build`   | Compile to `bin/server` |
| `make test`    | Run all tests |
| `make lint`    | Run `golangci-lint` |
| `make migrate` | Apply pending PostgreSQL migrations |
