import { describe, expect, it } from 'vitest'
import { getGameBoardDropAction } from './dnd'

describe('GameBoard dnd routing', () => {
    it('routes hand or board cards to word slots', () => {
        expect(getGameBoardDropAction('c1', 'word-slot:2:4', null)).toEqual({
            type: 'place',
            cardId: 'c1',
            rowIndex: 2,
            slotIndex: 4,
        })
    })

    it('routes board cards back to hand only when the source matches', () => {
        expect(getGameBoardDropAction('c1', 'player-hand', { cardId: 'c1', rowIndex: 0, slotIndex: 1 })).toEqual({
            type: 'unplace',
            rowIndex: 0,
            slotIndex: 1,
        })
        expect(getGameBoardDropAction('c2', 'player-hand', { cardId: 'c1', rowIndex: 0, slotIndex: 1 })).toBeNull()
    })

    it('routes cards to discard only when discard is allowed', () => {
        expect(getGameBoardDropAction('c1', 'discard-pile', null)).toBeNull()
        expect(getGameBoardDropAction('c1', 'discard-pile', null, { canDiscard: true })).toEqual({
            type: 'discard',
            cardId: 'c1',
        })
    })
})
