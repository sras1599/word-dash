# Real-time Events

All game communication happens over a WebSocket connection. The client connects when entering the lobby or game route and disconnects when navigating away.

Events are namespaced by prefix: `lobby:*` for pre-game, `game:*` for in-game.

Server messages use `{ event, payload, meta? }`. Every successful `game:*` event includes:

```ts
type GameEventMeta = {
  serverNowMs: number;
  turn: { sequence: number; endsAtMs: number; durationMs: number } | null;
};
```

Lobby events and `game:error` may omit `meta`; finished games use `turn: null`.

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

Clients optimistically apply safe local updates for board placement, unplacement, row clearing, board clearing, discard, and drawing the public discard-pile top card. Server events remain authoritative and reconcile local state. Draw-pile cards are never revealed optimistically because their identities are private until `game:card_drawn`.

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
Place a card from hand or move a placed board card into a word slot.
Valid during any player's draw or arrange phase; the server applies it only to the sender's own board.
```ts
{
  cardId: string;
  rowIndex: number;
  slotIndex: number;
  clientActionId?: string;
}
```
If the target slot is occupied, hand cards displace the old board card to the end of hand, while board cards swap positions with the target card.

#### `game:unplace_card`
Remove a card from a word slot back to hand.
Valid during any player's draw or arrange phase; the server applies it only to the sender's own board.
```ts
{
  rowIndex: number;
  slotIndex: number;
  clientActionId?: string;
}
```

#### `game:clear_word`
Remove all cards from one word row back to hand in slot order.
Valid during any player's draw or arrange phase; the server applies it only to the sender's own board.
```ts
{
  rowIndex: number;
  clientActionId?: string;
}
```

#### `game:clear_board`
Remove all cards from the word board back to hand in row-major order.
Valid during any player's draw or arrange phase; the server applies it only to the sender's own board.
```ts
{ clientActionId?: string }
```

#### `game:discard_card`
Discard a card to end the arrange phase.
```ts
{
  cardId: string;
  clientActionId?: string;
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
Every player snapshot includes a persisted monotonic `boardRevision`. A full snapshot is the reconnect and terminal authority boundary: the frontend trusts it and clears pending board operations.

#### `game:card_drawn`
When a player draws from the draw pile, only that player receives the actual card contents. When a player draws from the discard pile, every client can see the card because it was already public.
```ts
{
  playerId: string;
  source: 'draw' | 'discard';
  card: Card | null;
  drawPileCount: number;
  discardPileTop: Card | null;
}
```

#### `game:board_updated`
Sent after a `place_card`, `unplace_card`, `clear_word`, or `clear_board` action.
```ts
{
  playerId: string;
  wordBoard: WordBoard;
  handCount: number;
  hand?: Card[];
  boardRevision: number;
  clientActionId?: string;
}
```

Only the acting player receives `hand` and the optional echoed `clientActionId`. All recipients receive `boardRevision`.

#### `game:turn_ended`
Broadcast when the active player ends their turn by discarding or times out after drawing.
```ts
{
  playerId: string;
  reason: 'discarded' | 'timeout';
  discardedCard: Card;
  discardPileTop: Card;
  nextPlayerId: string;
}
```

#### `game:turn_skipped`
Broadcast when the server skips a turn start because the active player is still disconnected when their turn begins.
```ts
{
  playerId: string;
  reason: 'disconnected';
  nextPlayerId: string;
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
  clientActionId?: string;
}
```

---

## Notes

- The server is the single source of truth. For the local player, the frontend renders the latest authoritative snapshot plus its queue of unacknowledged board operations. An intermediate update replaces the authoritative base, removes only its exactly correlated operation, and replays the rest.
- Missing or unknown action ids never discard pending intent. Stale or duplicate `boardRevision` values cannot replace the authoritative base, although an exact action id may still acknowledge its matching operation.
- Opponent updates are applied directly when their revision is newer. `game:turn_ended` and `game:turn_skipped` do not clear the local queue because neither contains board and hand state.
- `game:error` removes only a matching operation and exposes transient accessible feedback. A personalized `game:state` clears the queue on initial load, reconnect, and terminal reconciliation.
- `WsClient` may flush messages queued before its first connection opens, but it drops gameplay mutations sent during reconnect rather than silently resending non-idempotent actions.
- `lobby:state` and `game:state` are full snapshots. The other events are incremental updates.
- Lobby disconnects remove the player immediately. In-game disconnects do not remove the player; they are marked disconnected and can be skipped later with `game:turn_skipped`.
- Every successful server-to-client `game:*` event includes `{ serverNowMs, turn }` envelope metadata. `turn` contains `{ sequence, endsAtMs, durationMs }`, or is `null` after the game finishes.
- `game:state` establishes the active turn on connection. Later turns begin with the post-transition `game:turn_ended` or `game:turn_skipped` event and its `nextPlayerId`.
- The frontend derives remaining time from deadline metadata and local elapsed time. Its one-second interval only repaints, visibility changes repaint immediately, older turn sequences are ignored, and urgency begins when 20% of the turn duration remains.
