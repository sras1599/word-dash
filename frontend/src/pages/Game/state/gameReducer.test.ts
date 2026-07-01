import { describe, expect, it, vi } from 'vitest'
import type { GameState } from '../../../lib/gameTypes'
import { gameReducer } from './gameReducer'

function createGameState(): GameState {
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
                wordBoard: {
                    allComplete: false,
                    rows: [
                        {
                            targetLength: 3,
                            isComplete: false,
                            slots: [
                                { slotIndex: 0, card: null },
                                { slotIndex: 1, card: { id: 'c2', letter: 'B' } },
                            ],
                        },
                    ],
                },
            },
            {
                id: 'p2',
                name: 'Guest',
                isReady: true,
                isConnected: true,
                handCount: 2,
                wordBoard: { allComplete: false, rows: [] },
            },
        ],
        drawPileCount: 10,
        discardPileTop: null,
        turn: {
            currentPlayerId: 'p1',
            phase: 'draw',
            timeRemainingMs: 90_000,
            drawnCard: null,
        },
        phase: 'playing',
        winnerId: null,
        hostPlayerId: 'p1',
    }
}

describe('gameReducer', () => {
    it('applies card draw events for the local player', () => {
        vi.spyOn(Date, 'now').mockReturnValue(123)
        const state = gameReducer(createGameState(), {
            type: 'game/cardDrawn',
            localPlayerId: 'p1',
            playerId: 'p1',
            card: { id: 'c3', letter: 'C' },
            drawPileCount: 9,
            discardPileTop: { id: 'd1', letter: 'D' },
            timeRemainingMs: 80_000,
        })

        expect(state?.players[0].hand).toEqual([
            { id: 'c1', letter: 'A' },
            { id: 'c3', letter: 'C' },
        ])
        expect(state?.turn.phase).toBe('arrange')
        expect(state?.turn.drawnCard).toEqual({ id: 'c3', letter: 'C' })
        expect(state?.drawPileCount).toBe(9)

        vi.restoreAllMocks()
    })

    it('updates board state from server-authoritative events', () => {
        const wordBoard = { allComplete: true, rows: [] }
        const state = gameReducer(createGameState(), {
            type: 'game/boardUpdated',
            localPlayerId: 'p1',
            playerId: 'p1',
            wordBoard,
            handCount: 0,
            hand: [],
        })

        expect(state?.players[0].wordBoard).toBe(wordBoard)
        expect(state?.players[0].handCount).toBe(0)
        expect(state?.players[0].hand).toEqual([])
    })

    it('moves turn state on turn end and countdown tick', () => {
        const ended = gameReducer(createGameState(), {
            type: 'game/turnEnded',
            nextPlayerId: 'p2',
            discardPileTop: { id: 'c1', letter: 'A' },
            timeRemainingMs: 60_000,
        })

        expect(ended?.turn.currentPlayerId).toBe('p2')
        expect(ended?.turn.phase).toBe('draw')
        expect(ended?.discardPileTop).toEqual({ id: 'c1', letter: 'A' })

        const ticked = gameReducer(ended, { type: 'local/timerTick' })
        expect(ticked?.turn.timeRemainingMs).toBe(59_000)
    })

    it('optimistically removes or swaps a placed local card', () => {
        const placedIntoEmpty = gameReducer(createGameState(), {
            type: 'local/cardPlacedOptimistically',
            localPlayerId: 'p1',
            cardId: 'c1',
            rowIndex: 0,
            slotIndex: 0,
        })
        expect(placedIntoEmpty?.players[0].hand).toEqual([])
        expect(placedIntoEmpty?.players[0].handCount).toBe(0)

        const swapped = gameReducer(createGameState(), {
            type: 'local/cardPlacedOptimistically',
            localPlayerId: 'p1',
            cardId: 'c1',
            rowIndex: 0,
            slotIndex: 1,
        })
        expect(swapped?.players[0].hand).toEqual([{ id: 'c2', letter: 'B' }])
        expect(swapped?.players[0].handCount).toBe(1)
    })
})
