# Game State Machine

## Room Phases

```
waiting -> playing -> finished
```

- `waiting`: Lobby. Players join and mark ready. Host selects variation.
- `playing`: Active game. Turn loop is running.
- `finished`: A player has won. Game is over. Host may trigger `lobby:restart`.

## Turn Phases

```
idle -> draw -> arrange -> (discard) -> idle (next player)
                 |
              (timeout)
                 |
               idle (next player, drawn card auto-discarded)
```

- `idle`: Between turns. No events accepted.
- `draw`: Active player must draw exactly one card from the draw pile or discard pile. Hand size = normal + 1.
- `arrange`: 60-second timer is running. Active player may freely place and unplace cards. All `game:board_updated` events are broadcast.
- `discard` / `timeout`: Active player discards exactly one card, returning to normal hand size. If the timer expires first, the drawn card is automatically discarded.

## Rules Enforced Server-Side

- Turn order: Clockwise; determined by `players[]` index order, set at game start.
- Hand size invariant: After the discard phase, `len(player.hand)` must equal `sum(variation.wordLengths)`.
- Win check: Immediately after a successful discard, the server checks whether all `WordRow.isComplete` flags are `true` for the active player. Win requires all word slots filled and every word validated by the dictionary simultaneously.
- Draw pile exhaustion: If the draw pile is empty when a player attempts to draw, the discard pile (excluding its top card) is shuffled and becomes the new draw pile.
- Board validation: `WordRow.isComplete` is computed exclusively server-side after each place or unplace action. The client never computes it.
