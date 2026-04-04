# Domain Models

The Go structs map directly to the TypeScript types defined in [frontend/state/game-state.md](../../frontend/state/game-state.md).

```go
type Card struct {
    ID     string // e.g. "card_042"
    Letter string // single uppercase letter, e.g. "A"
}

type WordSlot struct {
    SlotIndex int
    Card      *Card // nil if empty
}

type WordRow struct {
    TargetLength int
    Slots        []WordSlot // len == TargetLength
    IsComplete   bool       // all slots filled AND word is valid (set server-side only)
}

type WordBoard struct {
    Rows        []WordRow
    AllComplete bool // every row.IsComplete == true -> triggers win check
}

type Variation struct {
    WordLengths []int // e.g. [3, 4, 5]
}

// TurnPhase represents the current phase of an active turn.
type TurnPhase string

const (
    TurnPhaseIdle    TurnPhase = "idle"
    TurnPhaseDraw    TurnPhase = "draw"
    TurnPhaseArrange TurnPhase = "arrange"
)

type Turn struct {
    CurrentPlayerID string
    Phase           TurnPhase
    TimeRemainingMs int
    DrawnCard       *Card // nil until card is drawn; excluded from hand
}

type Player struct {
    ID          string
    Name        string
    Hand        []Card // normal hand only - does not include DrawnCard
    WordBoard   WordBoard
    IsReady     bool
    IsConnected bool
}

// GamePhase represents the high-level state of a room.
type GamePhase string

const (
    GamePhaseWaiting  GamePhase = "waiting"
    GamePhasePlaying  GamePhase = "playing"
    GamePhaseFinished GamePhase = "finished"
)

type GameState struct {
    RoomCode       string
    Variation      Variation
    Players        []Player   // index order = turn order (clockwise from dealer)
    DrawPileCount  int        // card identities never revealed to clients
    DiscardPileTop *Card      // nil if discard pile is empty
    Turn           Turn
    Phase          GamePhase
    WinnerID       *string    // non-nil when Phase == GamePhaseFinished
}
```

Note: `Turn.DrawnCard` is kept separate from `Player.Hand` so the server can always identify the extra card to auto-discard on timeout without ambiguity.
