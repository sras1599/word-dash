# WebSocket Protocol

## Connection

```
ws://<host>/ws?roomCode=ABC123&playerId=player_uuid
```

Both `roomCode` and `playerId` are required query parameters. The server validates them on upgrade. If invalid, it closes the connection immediately.

## Message Format

All messages in both directions are JSON objects with the shape:

```json
{
  "event": "<event:name>",
  "payload": { ... }
}
```

`payload` may be `null` or omitted for events with no data.

## Lobby Events

### Client -> Server

| Event                     | Host only | Payload                      |
|---------------------------|-----------|------------------------------|
| `lobby:join`              | No        | _(none)_                     |
| `lobby:settings_changed`  | Yes       | `{ "variation": Variation, "turnDurationMs": number }` |
| `lobby:player_ready`      | No        | _(none)_                     |
| `lobby:player_unready`    | No        | _(none)_                     |
| `lobby:start_game`        | Yes       | _(none)_                     |

### Server -> Client

| Event                     | Payload |
|---------------------------|---------|
| `lobby:state`             | `{ roomCode, hostPlayerId, variation, turnDurationMs, players: [{ id, name, isReady, isConnected }] }` |
| `lobby:player_joined`     | `{ player: { id, name, isReady, isConnected } }` |
| `lobby:player_ready`      | `{ playerId }` |
| `lobby:player_unready`    | `{ playerId }` |
| `lobby:player_disconnected` | `{ playerId, hostPlayerId }` |
| `lobby:settings_changed`  | `{ variation, turnDurationMs }` |
| `lobby:game_starting`     | `{ roomCode }` |
| `lobby:restart`           | _(none)_ - host-only trigger; all clients navigate back to lobby (Play Again flow) |

`lobby:state` is sent immediately after a successful WebSocket connect. `lobby:join` remains an idempotent manual re-sync event.

## Game Events

### Client -> Server

| Event               | Payload                                 | Valid phase |
|---------------------|-----------------------------------------|-------------|
| `game:draw_card`    | `{ "source": "draw" \| "discard" }` | `draw`      |
| `game:place_card`   | `{ "cardId", "rowIndex", "slotIndex" }` | `draw` or `arrange` |
| `game:unplace_card` | `{ "rowIndex", "slotIndex" }`       | `draw` or `arrange` |
| `game:discard_card` | `{ "cardId" }`                        | `arrange`   |

Draw and discard events must come from the current turn holder. Board-edit events (`game:place_card` and `game:unplace_card`) apply only to the sender's own board and are accepted during any player's `draw` or `arrange` turn phase. Events received outside their valid phase, or turn-owned events from a non-current player, are rejected with `game:error`.

`game:place_card` accepts cards from the sender's hand or board. Hand cards placed onto occupied slots displace the old board card to the end of the sender's hand; board cards placed onto occupied slots swap with the target board card in place, including across word rows.

### Server -> Client

| Event                      | Payload |
|----------------------------|---------|
| `game:state`               | Full `GameState` snapshot. Sent to all players on game start and to the reconnecting player on reconnect. |
| `game:turn_started`        | `{ currentPlayerId, timeRemainingMs: 60000 }` |
| `game:card_drawn`          | `{ playerId, source, card: Card \| null, drawPileCount, discardPileTop, timeRemainingMs }`. `card` is `null` for non-drawing players. |
| `game:board_updated`       | `{ playerId, wordBoard: WordBoard }`. Broadcast to all players after every `place` or `unplace` action. |
| `game:timer_warning`       | `{ currentPlayerId, timeRemainingMs }`. Emitted only when remaining time crosses warning thresholds (`10s`, `5s`, `1s`). |
| `game:turn_ended`          | `{ playerId, reason: "discarded" \| "timeout", discardedCard: Card, discardPileTop: Card, nextPlayerId, timeRemainingMs }` |
| `game:turn_skipped`        | `{ playerId, reason: "disconnected", nextPlayerId, timeRemainingMs }` |
| `game:player_won`          | `{ winnerId, winnerName, winningWordBoard: WordBoard }` |
| `game:player_disconnected` | `{ playerId }` |
| `game:player_reconnected`  | `{ playerId }` |
| `game:error`               | `{ code, message }` - sent only to the offending player. |

Clients should render a local one-second countdown between server events. The server remains authoritative for timeout enforcement.

## Error Codes

| Code            | Meaning |
|-----------------|---------|
| `NOT_YOUR_TURN` | Event received from a player who is not the active player |
| `INVALID_PHASE` | Event received during the wrong turn phase |
| `INVALID_CARD`  | `cardId` does not exist in the player's hand or board |
| `INVALID_SLOT`  | `rowIndex` or `slotIndex` is out of range |
| `ROOM_NOT_FOUND`| WS upgrade attempted with an unknown `roomCode` |
