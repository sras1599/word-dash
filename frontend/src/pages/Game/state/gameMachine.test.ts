import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import type { GameState } from '../../../lib/gameTypes'
import { gameMachine } from './gameMachine'

function createGameState(phase: GameState['phase'] = 'playing', turnPhase: GameState['turn']['phase'] = 'draw'): GameState {
    return {
        roomCode: 'ABCD',
        variation: { wordLengths: [3] },
        players: [
            {
                id: 'p1',
                name: 'Host',
                isReady: true,
                isConnected: true,
                handCount: 1,
                hand: [{ id: 'c1', letter: 'A' }],
                wordBoard: { allComplete: false, rows: [] },
            },
        ],
        drawPileCount: 10,
        discardPileTop: null,
        turn: {
            currentPlayerId: 'p1',
            phase: turnPhase,
            timeRemainingMs: 90_000,
            drawnCard: null,
        },
        phase,
        winnerId: phase === 'finished' ? 'p1' : null,
        hostPlayerId: 'p1',
    }
}

describe('gameMachine', () => {
    it('enters draw and arrange substates from server state', () => {
        const actor = createActor(gameMachine).start()
        actor.send({ type: 'GAME_STATE', state: createGameState('playing', 'draw') })
        expect(actor.getSnapshot().matches({ playing: 'draw' })).toBe(true)

        actor.send({ type: 'GAME_STATE', state: createGameState('playing', 'arrange') })
        expect(actor.getSnapshot().matches({ playing: 'arrange' })).toBe(true)
    })

    it('enters finished when a winner event arrives', () => {
        const actor = createActor(gameMachine).start()
        actor.send({ type: 'GAME_STATE', state: createGameState('playing', 'draw') })
        actor.send({ type: 'PLAYER_WON', winnerId: 'p1' })

        expect(actor.getSnapshot().matches('finished')).toBe(true)
        expect(actor.getSnapshot().context.gameState?.winnerId).toBe('p1')
    })
})
