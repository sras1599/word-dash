import type { GamePhase, TurnPhase } from '../../lib/gameTypes'

export type GameEmphasisLevel = 'primary' | 'available' | 'informational' | 'unavailable'

export type GameBoardEmphasis = {
    players: GameEmphasisLevel
    workspace: GameEmphasisLevel
    piles: GameEmphasisLevel
    hand: GameEmphasisLevel
}

export type GetGameBoardEmphasisOptions = {
    phase: GamePhase
    turnPhase: TurnPhase
    isLocalTurn: boolean
    timerIsUrgent: boolean
}

export function getGameBoardEmphasis({
    phase,
    turnPhase,
    isLocalTurn,
    timerIsUrgent,
}: GetGameBoardEmphasisOptions): GameBoardEmphasis {
    if (phase === 'finished') {
        return {
            players: 'informational',
            workspace: 'informational',
            piles: 'unavailable',
            hand: 'informational',
        }
    }

    if (phase === 'waiting' || turnPhase === 'idle') {
        return {
            players: 'informational',
            workspace: 'unavailable',
            piles: 'unavailable',
            hand: 'unavailable',
        }
    }

    if (!isLocalTurn) {
        return {
            players: 'primary',
            workspace: 'available',
            piles: 'unavailable',
            hand: 'available',
        }
    }

    if (turnPhase === 'draw') {
        return {
            players: 'informational',
            workspace: 'available',
            piles: 'primary',
            hand: 'available',
        }
    }

    return {
        players: 'informational',
        workspace: timerIsUrgent ? 'available' : 'primary',
        piles: timerIsUrgent ? 'primary' : 'available',
        hand: 'available',
    }
}
