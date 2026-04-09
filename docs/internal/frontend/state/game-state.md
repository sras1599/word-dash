# Game State — TypeScript Types

These are the shared type definitions that the frontend will use to represent all game state. The server sends `GameState` (or partial diffs) over WebSocket; the client stores it in `GameContext`.

---

## Core Types

```ts
/** A single letter card from the deck */
type Card = {
  id: string;       // unique card ID (e.g. "card_042")
  letter: string;   // single uppercase letter, e.g. "A"
};

/** A single slot within a word row */
type WordSlotState = {
  slotIndex: number;  // 0-based position in the word row
  card: Card | null;  // null = empty slot
};

/** One target word row — e.g. the "4-letter word" row */
type WordRowState = {
  targetLength: number;       // number of slots in this row
  slots: WordSlotState[];     // length === targetLength
  isComplete: boolean;        // true when all slots filled AND word is valid
};

/** All word rows for a single player */
type WordBoard = {
  rows: WordRowState[];   // one row per required word, e.g. 3 rows for the 3-4-5 variation
  allComplete: boolean;   // true when every row.isComplete === true → triggers win check
};

/** The game variation config */
type Variation = {
  wordLengths: number[];  // e.g. [3, 4, 5] — one target word per entry
};

/** Phase of a player's turn */
type TurnPhase =
  | 'draw'     // player must draw a card to begin their turn
  | 'arrange'  // player has drawn and timer is running; they arrange cards
  | 'idle';    // it is not this player's turn

/** State of the active turn */
type Turn = {
  currentPlayerId: string;      // whose turn it is
  phase: TurnPhase;             // current phase of that player's turn
  timeRemainingMs: number;      // milliseconds left on the turn timer (starts at 60000)
  drawnCard: Card | null;       // the extra card drawn during this turn; null if not yet drawn
};

/** A player in the game */
type Player = {
  id: string;
  name: string;
  hand: Card[];          // cards in hand (normal hand size = sum of variation.wordLengths)
  wordBoard: WordBoard;  // this player's word arrangement
  isReady: boolean;      // in lobby: has clicked "Ready"
  isConnected: boolean;  // whether the player's WebSocket is currently active
};

/** Overall game lifecycle phase */
type GamePhase =
  | 'waiting'   // in lobby, not all players ready
  | 'playing'   // game in progress
  | 'finished'; // a winner has been declared

/** The full game state — received from and owned by the server */
type GameState = {
  roomCode: string;
  variation: Variation;
  players: Player[];           // all players in the game (2–4 players)
  localPlayerId: string;       // the ID of the player on this client
  drawPileCount: number;       // number of cards remaining in the draw pile (clients don't see cards)
  discardPileTop: Card | null; // top card of the discard pile (visible to all)
  turn: Turn;
  phase: GamePhase;
  winnerId: string | null;     // set when phase === 'finished'
};
```

---

## Notes

- **`localPlayerId`** is derived from the session/auth context and set on the client — it is not sent by the server inside `GameState`.
- **`hand`** contains only the player's normal cards. The drawn card during the arrange phase is tracked separately in `turn.drawnCard` so the UI can clearly distinguish it.
- **`drawPileCount`** is an integer count only — clients never receive the card identities in the draw pile.
- **`wordBoard.rows`** are ordered to match `variation.wordLengths` (index 0 = shortest word).
- The server validates dictionary words; `WordRowState.isComplete` is set server-side and sent to the client — the client never computes it locally.
- Player ordering in `players[]` reflects turn order (clockwise). The dealer is the first element; turns proceed by index.
