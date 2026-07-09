import { describe, expect, it } from 'vitest'
import type { CardData } from '../Card/Card'
import type { WordBoardState } from '../WordBoard/WordBoard'
import { getShortcutAction, type BoardSelection, type ShortcutKey, type ShortcutOptions } from './shortcuts'

const HAND: CardData[] = [
    { id: 'hand-a-1', letter: 'A' },
    { id: 'hand-b', letter: 'B' },
    { id: 'hand-a-2', letter: 'A' },
]

function makeBoard(): WordBoardState {
    return {
        allComplete: false,
        rows: [
            {
                targetLength: 3,
                isComplete: false,
                slots: [
                    { slotIndex: 0, card: { id: 'board-c', letter: 'C' } },
                    { slotIndex: 1, card: null },
                    { slotIndex: 2, card: { id: 'board-d', letter: 'D' } },
                ],
            },
            {
                targetLength: 2,
                isComplete: false,
                slots: [
                    { slotIndex: 0, card: null },
                    { slotIndex: 1, card: { id: 'board-e', letter: 'E' } },
                ],
            },
        ],
    }
}

function makeOptions(overrides: Partial<ShortcutOptions> = {}): ShortcutOptions {
    return {
        canDraw: true,
        canDiscard: true,
        canEditBoard: true,
        drawPileCount: 12,
        hand: HAND,
        selectedHandCardId: null,
        selection: { rowIndex: 0, slotIndex: 1 },
        wordBoard: makeBoard(),
        ...overrides,
    }
}

function action(
    keyInfo: string | ShortcutKey,
    selection: BoardSelection | null = { rowIndex: 0, slotIndex: 1 },
    overrides: Partial<ShortcutOptions> = {},
) {
    return getShortcutAction(
        typeof keyInfo === 'string' ? { key: keyInfo } : keyInfo,
        makeOptions({ selection, ...overrides }),
    )
}

describe('GameBoard shortcuts', () => {
    it('selects rows by number, choosing the first empty slot', () => {
        expect(action('1')).toEqual({ type: 'select-board', selection: { rowIndex: 0, slotIndex: 1 } })
        expect(action('2')).toEqual({ type: 'select-board', selection: { rowIndex: 1, slotIndex: 0 } })
        expect(action('9')).toEqual({ type: 'none' })
    })

    it('moves board selection with arrows and clamps at row boundaries', () => {
        expect(action('ArrowLeft', { rowIndex: 0, slotIndex: 1 })).toEqual({
            type: 'select-board',
            selection: { rowIndex: 0, slotIndex: 0 },
        })
        expect(action('ArrowLeft', { rowIndex: 0, slotIndex: 0 })).toEqual({
            type: 'select-board',
            selection: { rowIndex: 0, slotIndex: 0 },
        })
        expect(action('ArrowDown', { rowIndex: 0, slotIndex: 2 })).toEqual({
            type: 'select-board',
            selection: { rowIndex: 1, slotIndex: 1 },
        })
    })

    it('places the first matching hand card for typed letters and advances to the next empty slot', () => {
        const board = makeBoard()
        board.rows[0].slots[2].card = null

        expect(action('a', { rowIndex: 0, slotIndex: 1 })).toEqual({
            type: 'place',
            cardId: 'hand-a-1',
            rowIndex: 0,
            slotIndex: 1,
            selection: { rowIndex: 0, slotIndex: 1 },
        })
        expect(action('a', { rowIndex: 0, slotIndex: 1 }, { wordBoard: board })).toEqual({
            type: 'place',
            cardId: 'hand-a-1',
            rowIndex: 0,
            slotIndex: 1,
            selection: { rowIndex: 0, slotIndex: 2 },
        })
    })

    it('replaces a different occupied slot card for typed letters', () => {
        expect(action('b', { rowIndex: 0, slotIndex: 0 })).toEqual({
            type: 'place',
            cardId: 'hand-b',
            rowIndex: 0,
            slotIndex: 0,
            selection: { rowIndex: 0, slotIndex: 1 },
        })
    })

    it('ignores typed letters with no hand match or matching occupied slot letter', () => {
        expect(action('z', { rowIndex: 0, slotIndex: 1 })).toEqual({ type: 'none' })
        expect(action('c', { rowIndex: 0, slotIndex: 0 })).toEqual({ type: 'none' })
    })

    it('moves or swaps selected board cards within the same row with shift arrows', () => {
        expect(getShortcutAction(
            { key: 'ArrowRight', shiftKey: true },
            makeOptions({ selection: { rowIndex: 0, slotIndex: 0 } }),
        )).toEqual({
            type: 'place',
            cardId: 'board-c',
            rowIndex: 0,
            slotIndex: 1,
            selection: { rowIndex: 0, slotIndex: 1 },
        })

        expect(getShortcutAction(
            { key: 'ArrowLeft', shiftKey: true },
            makeOptions({ selection: { rowIndex: 0, slotIndex: 2 } }),
        )).toEqual({
            type: 'place',
            cardId: 'board-d',
            rowIndex: 0,
            slotIndex: 1,
            selection: { rowIndex: 0, slotIndex: 1 },
        })
    })

    it('ignores shift arrows at word boundaries or from empty selected slots', () => {
        expect(getShortcutAction(
            { key: 'ArrowLeft', shiftKey: true },
            makeOptions({ selection: { rowIndex: 0, slotIndex: 0 } }),
        )).toEqual({ type: 'none' })

        expect(getShortcutAction(
            { key: 'ArrowRight', shiftKey: true },
            makeOptions({ selection: { rowIndex: 0, slotIndex: 1 } }),
        )).toEqual({ type: 'none' })
    })

    it('routes clear and discard shortcuts', () => {
        expect(action('Backspace', { rowIndex: 0, slotIndex: 0 })).toEqual({
            type: 'unplace',
            rowIndex: 0,
            slotIndex: 0,
        })
        expect(getShortcutAction(
            { key: 'Backspace', shiftKey: true },
            makeOptions({ selection: { rowIndex: 0, slotIndex: 1 } }),
        )).toEqual({ type: 'clear-word', rowIndex: 0 })
        expect(getShortcutAction(
            { key: 'Delete', shiftKey: true, altKey: true },
            makeOptions({ selection: { rowIndex: 0, slotIndex: 1 } }),
        )).toEqual({ type: 'clear-board' })
        expect(action('Delete')).toEqual({ type: 'none' })
        expect(action({ key: 'Delete', shiftKey: true }, { rowIndex: 0, slotIndex: 0 })).toEqual({
            type: 'discard',
            cardId: 'board-c',
            source: 'board',
        })
        expect(action({ key: 'Delete', shiftKey: true }, { rowIndex: 0, slotIndex: 0 }, {
            selectedHandCardId: 'hand-b',
        })).toEqual({
            type: 'discard',
            cardId: 'hand-b',
            source: 'hand',
        })
        expect(action({ key: 'Delete', shiftKey: true }, { rowIndex: 0, slotIndex: 0 }, {
            canDiscard: false,
            selectedHandCardId: 'hand-b',
        })).toEqual({ type: 'none' })
    })

    it('routes hand and board selection shortcuts', () => {
        expect(action({ key: 'H', shiftKey: true })).toEqual({ type: 'select-hand', cardId: 'hand-a-1' })
        expect(action({ key: 'H', shiftKey: true }, null, { hand: [] })).toEqual({ type: 'none' })
        expect(action({ key: 'B', shiftKey: true }, { rowIndex: 1, slotIndex: 1 })).toEqual({
            type: 'select-board',
            selection: { rowIndex: 1, slotIndex: 1 },
        })
        expect(action({ key: 'B', shiftKey: true }, null)).toEqual({
            type: 'select-board',
            selection: { rowIndex: 0, slotIndex: 1 },
        })
    })

    it('draws only for shift d and leaves enter and space alone', () => {
        expect(getShortcutAction(
            { key: 'D', shiftKey: true },
            makeOptions({
                canDraw: true,
                canEditBoard: false,
                drawPileCount: 12,
                selection: null,
                wordBoard: null,
            }),
        )).toEqual({ type: 'draw' })

        expect(action('Enter')).toEqual({ type: 'none' })
        expect(action(' ')).toEqual({ type: 'none' })
    })

    it('ignores board shortcuts when editing is disabled', () => {
        expect(getShortcutAction(
            { key: '1' },
            makeOptions({
                canEditBoard: false,
                selection: null,
            }),
        )).toEqual({ type: 'none' })
    })
})
