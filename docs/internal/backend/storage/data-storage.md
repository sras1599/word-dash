# Data Storage Design

## In-Memory Store: Hot, Ephemeral State

Game state is held in a `sync.RWMutex`-guarded map in process memory, keyed by `roomCode`. This is intentionally simple for the hobby-project stage — no external dependency, no persistence across restarts.

| Key          | Type              | Contents |
|--------------|-------------------|----------|
| `roomCode`   | `*domain.GameState` | Full game state including players, board, turn, and draw/discard piles |

Game state is written back to the map after every mutation. Rooms are lost on server restart (acceptable for now).

## PostgreSQL: Durable Data

| Table          | Purpose |
|----------------|---------|
| `words`        | Dictionary word list used for `IsValidWord` lookups |
| `game_records` | Completed game history (future feature) |
| `room_log`     | Audit log of room creation and join events (optional) |
