# Data Storage Design

## Redis: Hot, Ephemeral State

Redis holds everything that is read and written on every event during an active game.

| Key pattern                    | Type        | Contents |
|--------------------------------|-------------|----------|
| `room:{roomCode}:state`        | JSON string | Full serialized `GameState` |
| `room:{roomCode}:draw_pile`    | List        | Ordered card IDs (top = index 0); identities hidden from clients |
| `room:{roomCode}:discard_pile` | List        | Ordered card IDs (top = index 0) |
| `session:{playerId}`           | Hash        | `name`, `roomCode` player session metadata |

Game state is written back to Redis after every mutation. TTL is set on room keys to expire idle rooms automatically.

## PostgreSQL: Durable Data

| Table          | Purpose |
|----------------|---------|
| `words`        | Dictionary word list used for `IsValidWord` lookups |
| `game_records` | Completed game history (future feature) |
| `room_log`     | Audit log of room creation and join events (optional) |
