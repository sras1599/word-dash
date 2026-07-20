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

    it('applies local optimistic events without leaving the current playing substate', () => {
        const actor = createActor(gameMachine).start()
        const state = createGameState('playing', 'draw')
        state.discardPileTop = { id: 'd1', letter: 'D' }

        actor.send({ type: 'GAME_STATE', state })
        actor.send({ type: 'LOCAL_DISCARD_PILE_DRAWN_OPTIMISTICALLY', localPlayerId: 'p1' })

        expect(actor.getSnapshot().matches({ playing: 'arrange' })).toBe(true)
        expect(actor.getSnapshot().context.gameState?.turn.phase).toBe('arrange')
        expect(actor.getSnapshot().context.gameState?.players[0].hand).toEqual([
            { id: 'c1', letter: 'A' },
            { id: 'd1', letter: 'D' },
        ])
    })

    it('keeps authoritative, pending, and projected board state separate until acknowledgement', () => {
        const actor = createActor(gameMachine).start()
        const authoritative = createGameState('playing', 'draw')
        authoritative.players[0].boardRevision = 0
        authoritative.players[0].wordBoard = {
            allComplete: false,
            rows: [{
                targetLength: 1,
                isComplete: false,
                slots: [{ slotIndex: 0, card: null }],
            }],
        }
        actor.send({ type: 'GAME_STATE', state: authoritative, localPlayerId: 'p1' })
        actor.send({
            type: 'LOCAL_CARD_PLACED_OPTIMISTICALLY',
            localPlayerId: 'p1',
            clientActionId: 'action-1',
            cardId: 'c1',
            rowIndex: 0,
            slotIndex: 0,
        })

        let context = actor.getSnapshot().context
        expect(context.authoritativeGameState?.players[0].hand).toEqual([{ id: 'c1', letter: 'A' }])
        expect(context.gameState?.players[0].wordBoard.rows[0].slots[0].card?.id).toBe('c1')
        expect(context.pendingBoardOperations).toHaveLength(1)

        actor.send({
            type: 'BOARD_UPDATED',
            localPlayerId: 'p1',
            playerId: 'p1',
            wordBoard: context.gameState!.players[0].wordBoard,
            hand: [],
            handCount: 0,
            boardRevision: 1,
            clientActionId: 'action-1',
        })
        context = actor.getSnapshot().context
        expect(context.pendingBoardOperations).toEqual([])
        expect(context.authoritativeGameState?.players[0].boardRevision).toBe(1)
    })
})
