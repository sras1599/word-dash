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
  "payload": { ... },
  "meta": {
    "serverNowMs": 1710000000000,
    "turn": { "sequence": 4, "endsAtMs": 1710000060000, "durationMs": 60000 }
  }
}
```

`payload` may be `null` or omitted for events with no data. Every successful server-to-client `game:*` event includes `meta`; lobby events and `game:error` may omit it. Finished games send `"turn": null`.

## Lobby Events

### Client -> Server

| Event                     | Host only | Payload                      |
|---------------------------|-----------|------------------------------|
| `lobby:join`              | No        | _(none)_                     |
| `lobby:settings_changed`  | Yes       | `{ "variation": Variation, "turnDurationMs": number }` |
| `lobby:start_game`        | Yes       | _(none)_                     |

### Server -> Client

| Event                     | Payload |
|---------------------------|---------|
| `lobby:state`             | `{ roomCode, hostPlayerId, variation, turnDurationMs, players: [{ id, name, isConnected }] }` |
| `lobby:player_joined`     | `{ player: { id, name, isConnected } }` |
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
| `game:place_card`   | `{ "cardId", "rowIndex", "slotIndex", "clientActionId"? }` | `draw` or `arrange` |
| `game:unplace_card` | `{ "rowIndex", "slotIndex", "clientActionId"? }`       | `draw` or `arrange` |
| `game:clear_word`   | `{ "rowIndex": number, "clientActionId"? }`            | `draw` or `arrange` |
| `game:clear_board`  | `{ "clientActionId"? }` or _(none)_                    | `draw` or `arrange` |
| `game:discard_card` | `{ "cardId", "clientActionId"? }`                        | `arrange`   |

Draw and discard events must come from the current turn holder. Board-edit events (`game:place_card`, `game:unplace_card`, `game:clear_word`, and `game:clear_board`) apply only to the sender's own board and are accepted during any player's `draw` or `arrange` turn phase. Events received outside their valid phase, or turn-owned events from a non-current player, are rejected with `game:error`.

`game:place_card` accepts cards from the sender's hand or board. Hand cards placed onto occupied slots displace the old board card to the end of the sender's hand; board cards placed onto occupied slots swap with the target board card in place, including across word rows.

`game:clear_word` returns all cards in the requested word row to the sender's hand in slot order. `game:clear_board` returns all placed board cards to the sender's hand in row-major order. Empty slots and empty rows are ignored.

`clientActionId` is an optional opaque correlation value for backward compatibility. The server does not interpret or deduplicate it.

### Server -> Client

| Event                      | Payload |
|----------------------------|---------|
| `game:state`               | Personalized full `GameState` snapshot. Every player includes persisted `boardRevision`; only the recipient includes their private hand. Sent on game start, reconnect, and after terminal reconciliation. |
| `game:card_drawn`          | `{ playerId, source, card: Card \| null, drawPileCount, discardPileTop }`. `card` is `null` for non-drawing players. |
| `game:board_updated`       | `{ playerId, wordBoard, handCount, hand?, boardRevision, clientActionId? }`. `hand` and the echoed action id are included only for the actor. |
| `game:turn_ended`          | `{ playerId, reason: "discarded" \| "timeout", discardedCard: Card, discardPileTop: Card, nextPlayerId }` |
| `game:turn_skipped`        | `{ playerId, reason: "disconnected" \| "timeout", nextPlayerId }` |
| `game:player_won`          | `{ winnerId, winnerName, winningWordBoard: WordBoard }` |
| `game:player_disconnected` | `{ playerId }` |
| `game:player_reconnected`  | `{ playerId }` |
| `game:error`               | `{ code, message, clientActionId? }` - sent only to the offending player; correlation is echoed when recoverable. |

`game:state` establishes the active turn on initial connection and reconnection. Later turns begin as part of `game:turn_ended` or `game:turn_skipped`; `nextPlayerId` identifies the new active player.

Clients derive remaining time from `endsAtMs - serverNowMs` at receipt and elapsed local monotonic time afterward. Intervals repaint only; they do not decrement game state. Metadata with an older turn sequence is ignored. Urgency begins after 80% of `durationMs` has elapsed (20% remains).

After a backend restart, the first connection to a persisted playing room recreates its in-memory deadline watcher and reconciles the deadline before the connection snapshot is sent. Reconnection never resets or extends a deadline, and backend downtime counts against the turn.

Each accepted board-mutation request increments the acting player's persisted monotonic `boardRevision`. Clients use revisions to ignore stale or duplicate board updates and use `clientActionId` separately to acknowledge one exact optimistic operation. A winning placement is followed by `game:player_won` and then a personalized terminal `game:state`, which is the boundary for discarding any remaining local projection.

## Error Codes

| Code            | Meaning |
|-----------------|---------|
| `NOT_YOUR_TURN` | Event received from a player who is not the active player |
| `INVALID_PHASE` | Event received during the wrong turn phase |
| `INVALID_CARD`  | `cardId` does not exist in the player's hand or board |
| `INVALID_SLOT`  | `rowIndex` or `slotIndex` is out of range |
| `TURN_EXPIRED`  | The turn deadline passed before the gameplay mutation was accepted |
| `ROOM_NOT_FOUND`| WS upgrade attempted with an unknown `roomCode` |
| `NOT_ENOUGH_PLAYERS` | Host attempted to start with fewer than two lobby players |
