# Frontend State: Reducers and State Machines

This document explains how Word Dash manages frontend state, with comparisons to
backend concepts. It describes the current implementation in:

- `frontend/src/pages/Game/state/gameReducer.ts`
- `frontend/src/pages/Game/state/gameMachine.ts`
- `frontend/src/pages/Game/hooks/useGameRoom.ts`
- `frontend/src/pages/Lobby/state/lobbyReducer.ts`
- `frontend/src/pages/Lobby/state/lobbyMachine.ts`
- `frontend/src/pages/Lobby/hooks/useLobbyRoom.ts`

The most important idea is:

> A reducer calculates the next data value. A state machine decides which
> situations are possible and which events are accepted in each situation.

Word Dash combines both. XState machines manage the lobby/game lifecycle, and
reducers update the detailed lobby/game data stored inside those machines.

## A backend mental model

The frontend words map fairly closely to familiar backend ideas:

| Frontend concept | Backend analogy |
| --- | --- |
| State | A row, aggregate, or in-memory domain object at a point in time |
| Event/action | A command or domain event with a typed payload |
| Reducer | A pure `Apply(state, event) -> nextState` domain function |
| State machine | An enum of phases plus the allowed transition table |
| Guard | A transition precondition |
| Machine action | Code run as part of an accepted transition |
| Machine context | Data carried alongside the machine's current phase |
| `send(event)` | Put a command/event into an actor's mailbox |
| Snapshot | The actor's current phase and context |
| React render | A projection/read model recalculated from the snapshot |

If you have written Go code like this, you already understand the core of a
reducer:

```go
func Apply(state GameState, event Event) GameState {
    next := state.Clone()

    switch event.Type {
    case CardDrawn:
        next.Turn.Phase = Arrange
        next.DrawPileCount--
    case PlayerWon:
        next.Phase = Finished
    }

    return next
}
```

The frontend version has TypeScript types and uses Immer for convenient
immutable updates, but the idea is the same.

## First separate three kinds of state

The word "state" is overloaded in this codebase. It helps to distinguish these:

### 1. Server domain state

The backend owns the actual room and game rules: players, cards, boards, turn
ownership, turn phase, winner, and timer deadline. It is authoritative.

The frontend receives a visibility-filtered representation of that state as
`GameState` or `LobbyState`. For example, a client knows an opponent's
`handCount` but not the opponent's `hand`.

### 2. Machine state

This is the small, finite answer to "what situation is this screen in?"

The lobby machine can be in:

```text
idle
  -> validating
  -> connecting
  -> ready

validation/connection failures
  -> roomNotFound | connectionError
```

The game machine can be in:

```text
connecting
  -> waiting
  -> playing.draw
  -> playing.arrange
  -> playing.idle
  -> finished

invalid session
  -> invalidSession
```

`playing.draw` is a nested state: `playing` is the parent state and `draw` is
one of its children.

### 3. Machine context

A finite state machine should not create one state for every possible card,
player, or board arrangement. That would be unmanageable. XState therefore
separates:

- **finite control state:** `playing.arrange`
- **extended data/context:** the complete `GameState`

In Word Dash, the game context is:

```ts
type GameMachineContext = {
    gameState: GameState | null
}
```

So a snapshot conceptually looks like:

```ts
{
    value: { playing: 'arrange' },
    context: {
        gameState: {
            roomCode: 'ABCD',
            players: [/* ... */],
            turn: { currentPlayerId: 'p1', phase: 'arrange', drawnCard: /* ... */ },
            // ...
        }
    }
}
```

The phase answers "where are we?" The context answers "with what data?"

## Reducers

### The reducer contract

A reducer has this conceptual signature:

```ts
nextState = reducer(currentState, action)
```

For the game:

```ts
gameReducer(
    currentGameState,
    {
        type: 'game/turnEnded',
        nextPlayerId: 'p2',
        discardPileTop: discardedCard,
    },
)
```

The result is a new `GameState` where:

- the discard pile has the supplied top card;
- `currentPlayerId` is `p2`;
- the turn phase is `draw`; and
- `drawnCard` is cleared.

The reducer does not open a WebSocket, navigate, set a timer, or render
anything. Given the same state and action, it should calculate the same result.
Keeping side effects outside makes it easy to test. There is one current purity
caveat, described under "Current design caveats."

### Why return a new object?

React detects changes largely through object identity. If code mutates the old
object in place, React and other consumers can miss the change, and historical
snapshots become unreliable.

Conceptually, reducers should do this:

```ts
return {
    ...state,
    turn: {
        ...state.turn,
        phase: 'arrange',
    },
}
```

That becomes noisy for nested players, rows, slots, and cards. Word Dash uses
Immer's `produce`:

```ts
return produce(state, (draft) => {
    draft.turn.phase = 'arrange'
})
```

The code appears to mutate `draft`, but Immer records those edits and returns a
new immutable result. The original `state` is not modified.

This is similar to making a working copy of a Go aggregate, applying mutations
to the copy, and returning the copy.

### Actions are discriminated unions

`GameAction` is a TypeScript union whose `type` field determines the rest of
the payload:

```ts
type GameAction =
    | { type: 'game/state'; state: GameState }
    | { type: 'game/playerWon'; winnerId: string }
    | {
          type: 'local/cardPlacedOptimistically'
          localPlayerId: string
          cardId: string
          rowIndex: number
          slotIndex: number
      }
```

This gives the `switch` statement type-safe payloads. Inside
`case 'game/playerWon'`, TypeScript knows that `action.winnerId` exists. This is
roughly an enum plus a different request struct for each enum member.

### Full snapshots versus incremental updates

The reducers accept two broad categories:

1. A full snapshot such as `game/state` or `lobby/state` replaces local data.
2. An incremental event changes only the affected fields.

The full snapshot path is intentionally simple:

```ts
if (action.type === 'game/state') return action.state
```

This makes initial connection and reconnection reliable: the server can replace
whatever the client currently believes.

Incremental events avoid broadcasting the full game after every small change.
For example, `game/boardUpdated` replaces one player's board and hand metadata,
while `game/playerConnectionChanged` changes one flag.

### Optimistic actions

Some actions start with `local/` and end with `Optimistically`. These update the
screen before the server replies:

```text
user moves card
    -> reducer immediately updates local board
    -> WebSocket command is sent
    -> authoritative server event later reconciles the board
```

The UI therefore feels immediate despite network latency.

Word Dash only does this where the client has enough public information:

- placing/unplacing a known card;
- clearing a row or board;
- discarding a known card;
- drawing the visible top discard card.

It does **not** optimistically invent the identity of a draw-pile card. That
identity is private server data, so the client waits for `game:card_drawn`.

Optimistic state is a prediction, not authority. A later
`game:board_updated`, `game:turn_ended`, or full `game:state` can overwrite it.
This is similar to updating a local cache before a database transaction commits,
then replacing the cache entry with the committed representation.

### Permission helpers

`canDrawCard`, `canDiscardCard`, and `canPlaceCard` are client-side policy
helpers. The hook checks them before both the optimistic update and the
WebSocket command, and the reducer checks again before sensitive optimistic
updates.

These checks improve UI behavior, but they are not security boundaries. The
backend must still validate every request because a client can bypass the
frontend.

## State machines

### Why not use only a reducer?

A reducer can calculate data, but a large reducer alone does not clearly show
which events are legal in which lifecycle phase.

For example:

- `LOBBY_STATE` should move a connecting lobby to ready.
- `PLAYER_JOINED` should update data while ready.
- `PLAYER_JOINED` before the first lobby snapshot should not manufacture a
  lobby from `null`.
- `CARD_DRAWN` should move a playing game from draw to arrange.
- `PLAYER_WON` should move a playing game to finished.

A state machine makes those rules explicit as a transition table:

```text
(current machine state, event) -> (next machine state, actions)
```

If an event has no transition in the current state, XState ignores it. This is
useful protection against out-of-order or nonsensical lifecycle events.

### Anatomy of the XState definition

Word Dash uses XState's `setup(...).createMachine(...)`.

`setup` registers typed building blocks:

```ts
setup({
    types: {
        context: {} as GameMachineContext,
        events: {} as GameMachineEvent,
    },
    guards: {
        isFinished,
        isWaiting,
        isArrange,
        isIdle,
    },
    actions: {
        clearGame: assign({ gameState: null }),
        reduceGame: assign({
            gameState: ({ context, event }) =>
                reduceGameEvent(context, event),
        }),
    },
})
```

- `events` defines everything callers are allowed to send.
- a **guard** is a predicate deciding whether a transition applies;
- an **action** runs when a transition is taken;
- `assign` updates machine context.

`createMachine` declares the transition graph:

```ts
playing: {
    initial: 'draw',
    states: {
        draw: {},
        arrange: {},
        idle: {},
    },
    on: {
        CARD_DRAWN: {
            target: '.arrange',
            actions: 'reduceGame',
        },
        TURN_ENDED: {
            target: '.draw',
            actions: 'reduceGame',
        },
        BOARD_UPDATED: {
            actions: 'reduceGame',
        },
        PLAYER_WON: {
            target: 'finished',
            actions: 'reduceGame',
        },
    },
}
```

A transition without a `target`, such as `BOARD_UPDATED`, stays in the current
machine state but can still update context.

### Guards and ordered choices

A full `GAME_STATE` can describe waiting, finished, draw, arrange, or idle.
The machine uses an ordered array of guarded transitions:

```ts
GAME_STATE: [
    { guard: 'isFinished', target: 'finished', actions: 'reduceGame' },
    { guard: 'isWaiting', target: 'waiting', actions: 'reduceGame' },
    { guard: 'isArrange', target: '.arrange', actions: 'reduceGame' },
    { guard: 'isIdle', target: '.idle', actions: 'reduceGame' },
    { target: '.draw', actions: 'reduceGame' },
]
```

XState selects the first matching guard. The last unguarded entry is the
default. This resembles a Go `switch` with a fallback case.

### Machines are actors at runtime

`useMachine(gameMachine)` starts an actor tied to the React component:

```ts
const [snapshot, send] = useMachine(gameMachine)
```

- `send(event)` puts an event into the machine.
- `snapshot.value` is the finite machine state.
- `snapshot.context` is the attached data.

Sending an event synchronously runs the relevant transition, guards, and
actions. XState publishes a new snapshot, which causes React to render again.

For the lobby, the UI reads both parts:

```ts
lobby: snapshot.context.lobby
pageStatus: getLobbyPageStatus(snapshot.value)
```

For the game, the hook currently exposes `snapshot.context.gameState`; the page
mostly derives its visual state from fields inside that object.

## How the reducer and machine fit together

The machine owns the reducer. React does not call `gameReducer` directly, and
the current code does not use React's `useReducer`.

The game path is:

```text
WebSocket or user interaction
        |
        v
useGameRoom translates it to a typed machine event
        |
        v
gameMachine checks whether the event is accepted in its current state
        |
        +---- transition target changes machine state
        |
        `---- reduceGame action calls gameReducer
                         |
                         v
                  context.gameState changes
                         |
                         v
                 React receives a new snapshot
                         |
                         v
                     UI re-renders
```

`reduceGameEvent` is an adapter between the machine's event vocabulary and the
reducer's action vocabulary:

```text
machine event                              reducer action
CARD_DRAWN                          ->     game/cardDrawn
BOARD_UPDATED                       ->     game/boardUpdated
LOCAL_CARD_PLACED_OPTIMISTICALLY    ->     local/cardPlacedOptimistically
```

Why keep them separate? The machine event describes something the actor
received. The reducer action describes the exact data transformation. They are
similar today, but this adapter prevents the reducer from depending on XState
and keeps reducer tests simple.

## Follow one event end to end

### Example: placing a card

Suppose the local player drags card `c1` from hand to row 0, slot 2.

1. A component calls `place('c1', 0, 2)`.
2. `useGameRoom.place` checks `canPlaceCard(gameState)`.
3. It sends `LOCAL_CARD_PLACED_OPTIMISTICALLY` to the local XState actor.
4. The game machine is in a `playing.*` state, where that event is accepted.
5. The `reduceGame` machine action invokes `gameReducer`.
6. The reducer finds the card, removes it from its old location, and puts it in
   the target slot using an Immer draft.
7. React immediately renders the predicted board.
8. The hook also sends `game:place_card` over the WebSocket.
9. The backend validates the phase, player, card, slot, and word.
10. The server broadcasts `game:board_updated`.
11. The hook translates it to the machine event `BOARD_UPDATED`.
12. The reducer replaces that player's board with the authoritative server
    board and, for the local player, replaces the hand if supplied.

There are three deliberately different event names in that flow:

| Boundary | Example | Purpose |
| --- | --- | --- |
| Client to server protocol | `game:place_card` | Network contract |
| Local machine | `LOCAL_CARD_PLACED_OPTIMISTICALLY` | UI/actor event |
| Reducer | `local/cardPlacedOptimistically` | Data transformation |

Do not assume they are interchangeable merely because their payloads overlap.

### Example: drawing from the hidden draw pile

This path is different:

1. `draw('draw')` checks that this is the local player's draw phase.
2. No optimistic card action is sent because the client does not know the card.
3. The hook sends `game:draw_card { source: 'draw' }`.
4. The server selects the card and replies with `game:card_drawn`.
5. The hook sends the machine event `CARD_DRAWN`.
6. The machine transitions to `playing.arrange`.
7. The reducer adds the revealed card to the local hand and updates pile and
   turn data.

The server remains the only component that can reveal the card.

## The lobby uses the same pattern

The lobby is smaller but architecturally similar:

```text
REST room validation
        -> VALIDATING / ROOM_NOT_FOUND / CONNECTION_ERROR
        -> lobby machine lifecycle state

WebSocket lobby event
        -> PLAYER_JOINED / PLAYER_READY / SETTINGS_CHANGED
        -> lobby reducer
        -> snapshot.context.lobby
```

The machine is especially valuable here because lifecycle data and lobby data
are different:

- `snapshot.value === 'connectionError'` tells the page what failure screen to
  show.
- `snapshot.context.lobby` contains the players and settings once connected.

`updateSettings` is optimistic: it sends the WebSocket command and a local
`SETTINGS_CHANGED` event. The later server broadcast applies the same values
again.

## Two sources of phase information

The current game frontend intentionally carries related phase information in
two places:

```text
machine state                       context data
playing.arrange          <->        gameState.phase === 'playing'
                                    gameState.turn.phase === 'arrange'
```

The machine value controls allowed transitions. The context values are the
server-shaped data used throughout the UI.

This duplication is practical, but it creates an invariant: both sides should
agree. Every event that changes a phase must therefore:

1. target the correct machine state; and
2. run a reducer action that makes the context reflect the same phase.

For example, `CARD_DRAWN` targets `.arrange`, and `game/cardDrawn` sets
`draft.turn.phase = 'arrange'`.

When changing the flow, check both. A missing target can leave the machine in
`draw` while context says `arrange`; a missing reducer update can produce the
reverse. Machine tests should assert `snapshot.matches(...)`, while reducer or
integration tests should assert the context fields.

## Where side effects live

A useful ownership rule for this frontend is:

| Concern | Owner |
| --- | --- |
| Calculate next lobby/game data | Reducer |
| Decide accepted lifecycle transitions | XState machine |
| Open/close WebSocket and register listeners | `useLobbyRoom` / `useGameRoom` |
| Send protocol messages | Room hook |
| Maintain repaint cadence and timer anchor | `useGameRoom` plus timer helpers |
| Derive labels, flags, and component props | Page/components/model helpers |
| Enforce real game rules and authority | Backend |

Reducers stay deterministic because network and browser effects live in hooks.
Machines remain readable because detailed card manipulation lives in reducers.

## How to reason about a new behavior

When adding or debugging a feature, walk through these questions in order.

### 1. Who owns the truth?

Ask whether the value is:

- authoritative server domain state;
- temporary client prediction;
- screen lifecycle state; or
- purely derived presentation.

Do not create persistent frontend state for a value that can be cheaply derived
from existing state.

### 2. What is the event?

Name the fact or command precisely and define its payload. Decide which
boundaries need a name:

- WebSocket protocol event;
- machine event;
- reducer action.

They do not always need a one-to-one mapping.

### 3. Is this a phase change or only a data change?

Examples:

- player connection flag changes: data-only reducer update;
- board changes: data-only reducer update;
- card drawn: data update **and** `draw -> arrange` transition;
- winner declared: data update **and** `playing -> finished` transition;
- connection failure: primarily a machine lifecycle transition.

### 4. In which machine states is it accepted?

Put the transition under those states. Remember that an unhandled XState event
is ignored. This is often the first thing to inspect when "the event arrived
but nothing happened."

### 5. Should it be optimistic?

Only predict an update when:

- the client knows all affected public data;
- the update is reversible/reconcilable;
- the UX benefit justifies temporary disagreement; and
- the backend will still validate it.

Then identify the authoritative event that will reconcile the prediction.

### 6. What invariant must remain true?

Examples from the current reducer:

- `handCount` matches the visible local hand length;
- a card occupies at most one hand/board location;
- removing a board card clears completion flags;
- after a turn ends, phase is `draw` and `drawnCard` is `null`;
- machine phase and context phase agree.

Write these invariants into tests, not only comments.

## Testing strategy

The separation supports focused tests.

### Reducer tests

Call the reducer directly:

```ts
const next = gameReducer(initial, {
    type: 'local/cardPlacedOptimistically',
    localPlayerId: 'p1',
    cardId: 'c1',
    rowIndex: 0,
    slotIndex: 0,
})

expect(next?.players[0].hand).toEqual([])
expect(next?.players[0].wordBoard.rows[0].slots[0].card?.id).toBe('c1')
```

These tests are fast and should cover data transformations, invalid locations,
permissions, card uniqueness, counts, and completion flags.

### Machine tests

Create an actor, send events, and inspect its snapshot:

```ts
const actor = createActor(gameMachine).start()

actor.send({ type: 'GAME_STATE', state: playingDrawState })
expect(actor.getSnapshot().matches({ playing: 'draw' })).toBe(true)

actor.send({ type: 'CARD_DRAWN', /* payload */ })
expect(actor.getSnapshot().matches({ playing: 'arrange' })).toBe(true)
```

These tests should cover valid transitions, rejected/ignored events, guards,
and agreement between machine state and context.

### Hook or browser tests

Use these for the boundaries reducers cannot test:

- a user interaction sends the correct local and WebSocket events;
- a WebSocket response reaches the machine;
- reconnect sends a full snapshot;
- optimistic UI is later reconciled;
- navigation occurs on `lobby:game_starting`.

### Backend tests

Frontend tests do not replace server tests for authorization, hidden card
information, timer expiry, word validation, or phase enforcement.

## Current design caveats

These are useful examples of the kinds of details to look for when reasoning
about state code.

### The reducer has one nondeterministic fallback

When `game/cardDrawn` represents the local player but does not contain a card,
the reducer creates an `unknown-${Date.now()}` placeholder. Reading the clock
means this branch is not a perfectly pure function: the same inputs at different
times can yield different IDs. Its test has to mock `Date.now`.

If the placeholder remains necessary, generating its ID before dispatching the
action would restore the reducer's deterministic contract.

### Rejected optimistic actions need a reconciliation path

The normal success path is reconciled by events such as
`game:board_updated` and `game:turn_ended`. The current `useGameRoom` hook does
not register a `game:error` handler that rolls an optimistic prediction back.
Therefore, if the server rejects an optimistic command and sends no subsequent
state event, the predicted UI can remain until another authoritative update or
reconnection replaces it.

This does not weaken backend authority, but it can make the UI temporarily
wrong. When adding optimistic behavior, test both the success response and the
rejection/re-sync path.

## Common misconceptions

### "A reducer is a state machine"

A reducer can implement machine-like logic, but its main abstraction is a
state-folding function. A state machine additionally makes the finite states
and legal transitions explicit.

### "XState stores all the state in the state name"

The finite state name is only the control state. Rich data belongs in context.

### "Dispatching/sending an event sends it to the backend"

`send(...)` from `useMachine` sends to the local XState actor only.
`wsRef.current?.send(...)` sends a WebSocket message to the backend.

### "Optimistic means trusted"

It means predicted for responsiveness. The server still validates and
reconciles it.

### "The frontend currently uses React `useReducer`"

It does not. The reducer functions are ordinary pure functions called from
XState `assign` actions. Some older internal frontend documentation still uses
`GameContext`/`useReducer` terminology, but the files listed at the top of this
document describe the current implementation.

### "Immer mutates the existing React state"

It mutates a draft proxy and produces a new result. The prior state remains
unchanged.

## A compact reading order

To revisit this implementation without reading the whole frontend:

1. Read `frontend/src/lib/gameTypes.ts` to learn the data model.
2. Read `frontend/src/pages/Game/state/gameReducer.ts` to learn the possible
   data transformations and permission helpers.
3. Read `frontend/src/pages/Game/state/gameMachine.ts` to learn when those
   transformations are accepted and which phases they enter.
4. Read `frontend/src/pages/Game/hooks/useGameRoom.ts` to see browser and
   WebSocket events translated into machine events.
5. Read `frontend/src/pages/Game/Game.tsx` to see state projected into UI.
6. Read the adjacent `*.test.ts` files to see executable examples.

When debugging, trace one event through those layers instead of trying to hold
the whole frontend in your head.

## Summary

For Word Dash, think of the frontend state layer as a small event-driven
service running inside the browser:

```text
hook = transport/controller
machine = lifecycle and transition policy
reducer = mostly-pure domain-state projection
machine context = in-memory read model
React = view of the latest snapshot
backend = final authority
```

That framing is close enough to backend architecture that you can reason about
the game using familiar questions: What event occurred? Is it legal in this
phase? What data changes? Who is authoritative? What invariant should still
hold afterward?
