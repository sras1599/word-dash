# Real-time Events

All game communication happens over a WebSocket connection. The client connects when entering the lobby or game route and disconnects when navigating away.

Events are namespaced by prefix: `lobby:*` for pre-game, `game:*` for in-game.

---

## Connection

The client connects to the WebSocket server with the following query params:
```ts
ws://<host>/ws?roomCode=ABC123&playerId=player_001
```

The server uses these query params to identify the player and automatically sends an initial snapshot for the current phase.

---

## Lobby Events

### Client -> Server

#### `lobby:join`
Optional manual re-sync event. The server already sends `lobby:state` automatically on connect.
```ts
// No payload
```

#### `lobby:settings_changed` *(host only)*
```ts
{
  variation: Variation;
  turnDurationMs: number; // between 60000 and 300000
}
```

#### `lobby:player_ready`
```ts
// No payload
```

#### `lobby:player_unready`
```ts
// No payload
```

#### `lobby:start_game` *(host only)*
```ts
// No payload
```

---

### Server -> Client

#### `lobby:state`
Sent on connect and after any full lobby resync.
```ts
{
  roomCode: string;
  hostPlayerId: string;
  variation: Variation;
  turnDurationMs: number;
  players: Array<{
    id: string;
    name: string;
    isReady: boolean;
    isConnected: boolean;
  }>;
}
```

#### `lobby:player_joined`
Sent to the other connected lobby members when a player joins.
```ts
{
  player: {
    id: string;
    name: string;
    isReady: boolean;
    isConnected: boolean;
  };
}
```

#### `lobby:player_ready`
```ts
{
  playerId: string;
}
```

#### `lobby:player_unready`
```ts
{
  playerId: string;
}
```

#### `lobby:player_disconnected`
Lobby-only disconnect event. The disconnected player is removed immediately from the lobby snapshot, and `hostPlayerId` is included so clients can update host ownership if needed.
```ts
{
  playerId: string;
  hostPlayerId: string;
}
```

#### `lobby:settings_changed`
```ts
{
  variation: Variation;
  turnDurationMs: number;
}
```

#### `lobby:game_starting`
Signals all clients to navigate to `/game/:roomCode`.
```ts
{
  roomCode: string;
}
```

---

## Game Events

### Client -> Server

Clients optimistically apply safe local updates for board placement, unplacement, discard, and drawing the public discard-pile top card. The WebSocket event shapes do not change; server events remain authoritative and reconcile local state. Draw-pile cards are never revealed optimistically because their identities are private until `game:card_drawn`.

#### `game:player_connected`
Optional manual re-sync event. Current clients do not need to send it because the server automatically syncs `game:state` when a game-phase socket connects.
```ts
// No payload
```

#### `game:draw_card`
Draw the top card from a pile. Only valid during the local player's draw phase.
```ts
{
  source: 'draw' | 'discard';
}
```

#### `game:place_card`
Place a card from hand into a word slot.
Valid during any player's draw or arrange phase; the server applies it only to the sender's own board.
```ts
{
  cardId: string;
  rowIndex: number;
  slotIndex: number;
}
```

#### `game:unplace_card`
Remove a card from a word slot back to hand.
Valid during any player's draw or arrange phase; the server applies it only to the sender's own board.
```ts
{
  rowIndex: number;
  slotIndex: number;
}
```

#### `game:discard_card`
Discard a card to end the arrange phase.
```ts
{
  cardId: string;
}
```

---

### Server -> Client

#### `game:state`
Full game snapshot. Sent to all players when the game starts and to the reconnecting player when their connection is restored.
```ts
GameState
```

Only the receiving player gets their full hand in the snapshot. Other players are represented by `handCount` plus public state.

#### `game:turn_started`
```ts
{
  currentPlayerId: string;
  timeRemainingMs: number;
}
```

#### `game:card_drawn`
When a player draws from the draw pile, only that player receives the actual card contents. When a player draws from the discard pile, every client can see the card because it was already public.
```ts
{
  playerId: string;
  source: 'draw' | 'discard';
  card: Card | null;
  drawPileCount: number;
  discardPileTop: Card | null;
  timeRemainingMs: number;
}
```

#### `game:board_updated`
Sent after a `place_card` or `unplace_card` action.
```ts
{
  playerId: string;
  wordBoard: WordBoard;
  handCount: number;
  hand?: Card[];
}
```

Only the acting player receives the optional `hand` field.

#### `game:timer_warning`
Sent only when the remaining turn time crosses warning thresholds.
```ts
{
  roomCode: string;
  currentPlayerId: string;
  timeRemainingMs: number;
}
```

#### `game:turn_ended`
Broadcast when the active player ends their turn by discarding or times out after drawing.
```ts
{
  playerId: string;
  reason: 'discarded' | 'timeout';
  discardedCard: Card;
  discardPileTop: Card;
  nextPlayerId: string;
  timeRemainingMs: number;
}
```

#### `game:turn_skipped`
Broadcast when the server skips a turn start because the active player is still disconnected when their turn begins.
```ts
{
  playerId: string;
  reason: 'disconnected';
  nextPlayerId: string;
  timeRemainingMs: number;
}
```

#### `game:player_won`
Broadcast when a player completes all required words. Current clients keep the user on the game route and mark the local game state as finished so the win UI can appear in place.
```ts
{
  winnerId: string;
  winnerName: string;
  winningWordBoard: WordBoard;
}
```

#### `game:player_disconnected`
```ts
{
  playerId: string;
}
```

#### `game:player_reconnected`
```ts
{
  playerId: string;
}
```

#### `game:error`
Sent only to the client whose action was rejected.
```ts
{
  code: string;
  message: string;
}
```

---

## Notes

- The server is the single source of truth. Clients should wait for `game:board_updated`, `game:turn_ended`, or `game:state` before reconciling game state.
- `lobby:state` and `game:state` are full snapshots. The other events are incremental updates.
- Lobby disconnects remove the player immediately. In-game disconnects do not remove the player; they are marked disconnected and can be skipped later with `game:turn_skipped`.
- The timer is authoritative on the server. Clients can run a local countdown for display and re-sync from server events such as `game:timer_warning`, `game:turn_ended`, and `game:turn_skipped`.
