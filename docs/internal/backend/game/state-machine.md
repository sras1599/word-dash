# Game State Machine

## Room Phases

```
waiting -> playing -> finished
```

- `waiting`: Lobby. Players join and mark ready. Host selects variation. Player word boards are not initialized yet.
- `playing`: Active game. The final variation is locked, player word boards are initialized, and the turn loop is running.
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
- `draw`: Active player must draw exactly one card from the draw pile or discard pile. Hand size = normal + 1. Players may still place or unplace cards on their own boards.
- `arrange`: 60-second timer is running. Players may freely place and unplace cards on their own boards. All `game:board_updated` events are broadcast.
- `discard` / `timeout`: Active player discards exactly one card, returning to normal hand size. If the timer expires first, the drawn card is automatically discarded.

## Rules Enforced Server-Side

- Turn order: Clockwise; determined by `players[]` index order, set at game start.
- Hand size invariant: After the discard phase, `len(player.hand)` must equal `sum(variation.wordLengths)`.
- Win check: Immediately after a successful `game:place_card`, the server checks whether all `WordRow.isComplete` flags are `true` for the active player. If yes, the server declares the winner and transitions to `finished` immediately (no discard required).
- Draw pile exhaustion: If the draw pile is empty when a player attempts to draw, the discard pile (excluding its top card) is shuffled and becomes the new draw pile.
- Board validation: `WordRow.isComplete` is computed exclusively server-side after each place or unplace action. The client never computes it.
- Turn ownership: `draw_card` and `discard_card` are restricted to the current turn holder. `place_card` and `unplace_card` are restricted to the sender's own board but do not require the sender to be the current turn holder.
