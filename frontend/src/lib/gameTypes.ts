import type { CardData } from '../components/Card/Card'
import type { WordRowState } from '../components/WordRow/WordRow'

export type Card = CardData

export type Variation = {
    wordLengths: number[]
}

export type WordBoardState = {
    rows: WordRowState[]
    allComplete: boolean
}

export type TurnPhase = 'draw' | 'arrange' | 'idle'

export type Turn = {
    currentPlayerId: string
    phase: TurnPhase
    drawnCard: Card | null
}

export type BasePlayer = {
    id: string
    name: string
    isConnected: boolean
}

export type LobbyPlayer = BasePlayer

export type LobbyState = {
    roomCode: string
    hostPlayerId: string
    variation: Variation
    turnDurationMs: number
    players: LobbyPlayer[]
}

export type GamePlayer = BasePlayer & {
    handCount: number
    hand?: Card[]
    wordBoard: WordBoardState
    boardRevision?: number
}

export type GamePhase = 'waiting' | 'playing' | 'finished'

export type GameState = {
    roomCode: string
    variation: Variation
    players: GamePlayer[]
    drawPileCount: number
    discardPileTop: Card | null
    turn: Turn
    phase: GamePhase
    winnerId: string | null
    hostPlayerId: string
}
