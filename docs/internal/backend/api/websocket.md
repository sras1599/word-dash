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
| `lobby:variation_changed` | Yes       | `{ "variation": Variation }` |
| `lobby:player_ready`      | No        | _(none)_                     |
| `lobby:start_game`        | Yes       | _(none)_                     |

### Server -> Client

| Event                     | Payload |
|---------------------------|---------|
| `lobby:state`             | `{ roomCode, hostPlayerId, variation, players: [{ id, name, isReady, isConnected }] }` |
| `lobby:player_joined`     | `{ player: { id, name, isReady, isConnected } }` |
| `lobby:player_ready`      | `{ playerId }` |
| `lobby:variation_changed` | `{ variation }` |
| `lobby:game_starting`     | `{ roomCode }` |
| `lobby:restart`           | _(none)_ - host-only trigger; all clients navigate back to lobby (Play Again flow) |

`lobby:state` is sent to a player immediately after a successful `lobby:join`, and to all players when the variation changes.

## Game Events

### Client -> Server

| Event               | Payload                                 | Valid phase |
|---------------------|-----------------------------------------|-------------|
| `game:draw_card`    | `{ "source": "draw" \| "discard" }` | `draw`      |
| `game:place_card`   | `{ "cardId", "rowIndex", "slotIndex" }` | `arrange` |
| `game:unplace_card` | `{ "rowIndex", "slotIndex" }`       | `arrange`   |
| `game:discard_card` | `{ "cardId" }`                        | `arrange`   |

Events received outside their valid phase, or from a player who is not the current turn holder, are rejected with `game:error`.

### Server -> Client

| Event                      | Payload |
|----------------------------|---------|
| `game:state`               | Full `GameState` snapshot. Sent to all players on game start and to the reconnecting player on reconnect. |
| `game:turn_started`        | `{ currentPlayerId, timeRemainingMs: 60000 }` |
| `game:card_drawn`          | `{ playerId, source, card: Card \| null, drawPileCount, discardPileTop }`. `card` is `null` for non-drawing players. |
| `game:board_updated`       | `{ playerId, wordBoard: WordBoard }`. Broadcast to all players after every `place` or `unplace` action. |
| `game:timer_tick`          | `{ timeRemainingMs }`. Emitted every second during the arrange phase. |
| `game:turn_ended`          | `{ playerId, reason: "discarded" \| "timeout", discardedCard: Card, discardPileTop: Card, nextPlayerId }` |
| `game:player_won`          | `{ winnerId, winnerName, winningWordBoard: WordBoard }` |
| `game:player_disconnected` | `{ playerId }` |
| `game:player_reconnected`  | `{ playerId }` |
| `game:error`               | `{ code, message }` - sent only to the offending player. |

## Error Codes

| Code            | Meaning |
|-----------------|---------|
| `NOT_YOUR_TURN` | Event received from a player who is not the active player |
| `INVALID_PHASE` | Event received during the wrong turn phase |
| `INVALID_CARD`  | `cardId` does not exist in the player's hand |
| `INVALID_SLOT`  | `rowIndex` or `slotIndex` is out of range |
| `ROOM_NOT_FOUND`| WS upgrade attempted with an unknown `roomCode` |
