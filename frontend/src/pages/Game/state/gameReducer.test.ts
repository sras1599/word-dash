import { describe, expect, it, vi } from 'vitest'
import type { Card, GameState } from '../../../lib/gameTypes'
import {
    gameReconciliationReducer,
    gameReducer,
    initialGameReconciliationState,
    type GameReconciliationState,
} from './gameReducer'

function createGameState({
    hand = [{ id: 'c1', letter: 'A' }],
    turnPhase = 'draw',
    discardPileTop = null,
}: {
    hand?: Card[]
    turnPhase?: GameState['turn']['phase']
    discardPileTop?: Card | null
} = {}): GameState {
    return {
        roomCode: 'ABCD',
        variation: { wordLengths: [3] },
        players: [
            {
                id: 'p1',
                name: 'Host',
                isReady: true,
                isConnected: true,
                handCount: hand.length,
                hand,
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
        discardPileTop,
        turn: {
            currentPlayerId: 'p1',
            phase: turnPhase,
            drawnCard: null,
        },
        phase: 'playing',
        winnerId: null,
        hostPlayerId: 'p1',
    }
}

function createRapidPlacementState(): GameState {
    const state = createGameState({
        hand: [
            { id: 'card-a', letter: 'A' },
            { id: 'card-b', letter: 'B' },
            { id: 'card-c', letter: 'C' },
        ],
    })
    state.players[0].boardRevision = 0
    state.players[0].wordBoard.rows[0].slots = [
        { slotIndex: 0, card: null },
        { slotIndex: 1, card: null },
        { slotIndex: 2, card: null },
    ]
    return state
}

function reconcile(
    state: GameReconciliationState,
    action: Parameters<typeof gameReconciliationReducer>[1],
) {
    return gameReconciliationReducer(state, action)
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
            boardRevision: 1,
        })

        expect(state?.players[0].wordBoard).toBe(wordBoard)
        expect(state?.players[0].handCount).toBe(0)
        expect(state?.players[0].hand).toEqual([])
    })

    it('moves turn state on turn end', () => {
        const ended = gameReducer(createGameState(), {
            type: 'game/turnEnded',
            nextPlayerId: 'p2',
            discardPileTop: { id: 'c1', letter: 'A' },
        })

        expect(ended?.turn.currentPlayerId).toBe('p2')
        expect(ended?.turn.phase).toBe('draw')
        expect(ended?.discardPileTop).toEqual({ id: 'c1', letter: 'A' })
    })

    it('optimistically places a hand card into an empty slot', () => {
        const placedIntoEmpty = gameReducer(createGameState(), {
            type: 'local/cardPlacedOptimistically',
            localPlayerId: 'p1',
            cardId: 'c1',
            rowIndex: 0,
            slotIndex: 0,
        })

        expect(placedIntoEmpty?.players[0].wordBoard.rows[0].slots[0].card).toEqual({ id: 'c1', letter: 'A' })
        expect(placedIntoEmpty?.players[0].hand).toEqual([])
        expect(placedIntoEmpty?.players[0].handCount).toBe(0)
    })

    it('optimistically places a hand card into an occupied slot and appends the displaced card', () => {
        const swapped = gameReducer(createGameState({ hand: [{ id: 'c1', letter: 'A' }, { id: 'c4', letter: 'D' }] }), {
            type: 'local/cardPlacedOptimistically',
            localPlayerId: 'p1',
            cardId: 'c1',
            rowIndex: 0,
            slotIndex: 1,
        })

        expect(swapped?.players[0].wordBoard.rows[0].slots[1].card).toEqual({ id: 'c1', letter: 'A' })
        expect(swapped?.players[0].hand).toEqual([{ id: 'c4', letter: 'D' }, { id: 'c2', letter: 'B' }])
        expect(swapped?.players[0].handCount).toBe(2)
    })

    it('optimistically moves a board card into an empty slot', () => {
        const moved = gameReducer(createGameState({ hand: [] }), {
            type: 'local/cardPlacedOptimistically',
            localPlayerId: 'p1',
            cardId: 'c2',
            rowIndex: 0,
            slotIndex: 0,
        })

        expect(moved?.players[0].wordBoard.rows[0].slots[0].card).toEqual({ id: 'c2', letter: 'B' })
        expect(moved?.players[0].wordBoard.rows[0].slots[1].card).toBeNull()
        expect(moved?.players[0].hand).toEqual([])
        expect(moved?.players[0].handCount).toBe(0)
    })

    it('optimistically swaps a board card with an occupied slot', () => {
        const moved = gameReducer(
            {
                ...createGameState({ hand: [] }),
                players: [
                    {
                        ...createGameState({ hand: [] }).players[0],
                        wordBoard: {
                            allComplete: false,
                            rows: [
                                {
                                    targetLength: 3,
                                    isComplete: false,
                                    slots: [
                                        { slotIndex: 0, card: { id: 'c3', letter: 'C' } },
                                        { slotIndex: 1, card: { id: 'c2', letter: 'B' } },
                                    ],
                                },
                            ],
                        },
                    },
                    createGameState().players[1],
                ],
            },
            {
                type: 'local/cardPlacedOptimistically',
                localPlayerId: 'p1',
                cardId: 'c2',
                rowIndex: 0,
                slotIndex: 0,
            },
        )

        expect(moved?.players[0].wordBoard.rows[0].slots[0].card).toEqual({ id: 'c2', letter: 'B' })
        expect(moved?.players[0].wordBoard.rows[0].slots[1].card).toEqual({ id: 'c3', letter: 'C' })
        expect(moved?.players[0].hand).toEqual([])
        expect(moved?.players[0].handCount).toBe(0)
    })

    it('optimistically swaps board cards across rows', () => {
        const moved = gameReducer(
            {
                ...createGameState({ hand: [] }),
                variation: { wordLengths: [2, 2] },
                players: [
                    {
                        ...createGameState({ hand: [] }).players[0],
                        wordBoard: {
                            allComplete: false,
                            rows: [
                                {
                                    targetLength: 2,
                                    isComplete: false,
                                    slots: [
                                        { slotIndex: 0, card: { id: 'c3', letter: 'C' } },
                                        { slotIndex: 1, card: { id: 'c2', letter: 'B' } },
                                    ],
                                },
                                {
                                    targetLength: 2,
                                    isComplete: false,
                                    slots: [
                                        { slotIndex: 0, card: { id: 'c4', letter: 'D' } },
                                        { slotIndex: 1, card: null },
                                    ],
                                },
                            ],
                        },
                    },
                    createGameState().players[1],
                ],
            },
            {
                type: 'local/cardPlacedOptimistically',
                localPlayerId: 'p1',
                cardId: 'c4',
                rowIndex: 0,
                slotIndex: 1,
            },
        )

        expect(moved?.players[0].wordBoard.rows[0].slots[1].card).toEqual({ id: 'c4', letter: 'D' })
        expect(moved?.players[0].wordBoard.rows[1].slots[0].card).toEqual({ id: 'c2', letter: 'B' })
        expect(moved?.players[0].hand).toEqual([])
        expect(moved?.players[0].handCount).toBe(0)
    })

    it('keeps a same-slot board move as a no-op', () => {
        const state = createGameState({ hand: [] })
        const moved = gameReducer(state, {
            type: 'local/cardPlacedOptimistically',
            localPlayerId: 'p1',
            cardId: 'c2',
            rowIndex: 0,
            slotIndex: 1,
        })

        expect(moved).toEqual(state)
    })

    it('optimistically unplaces a board card into hand and marks completion incomplete', () => {
        const state = createGameState({ hand: [] })
        state.players[0].wordBoard.allComplete = true
        state.players[0].wordBoard.rows[0].isComplete = true

        const unplaced = gameReducer(state, {
            type: 'local/cardUnplacedOptimistically',
            localPlayerId: 'p1',
            rowIndex: 0,
            slotIndex: 1,
        })

        expect(unplaced?.players[0].wordBoard.rows[0].slots[1].card).toBeNull()
        expect(unplaced?.players[0].wordBoard.rows[0].isComplete).toBe(false)
        expect(unplaced?.players[0].wordBoard.allComplete).toBe(false)
        expect(unplaced?.players[0].hand).toEqual([{ id: 'c2', letter: 'B' }])
        expect(unplaced?.players[0].handCount).toBe(1)
    })

    it('optimistically clears a word row into hand and marks completion incomplete', () => {
        const state = createGameState({ hand: [{ id: 'c1', letter: 'A' }] })
        state.players[0].wordBoard.allComplete = true
        state.players[0].wordBoard.rows[0].isComplete = true
        state.players[0].wordBoard.rows[0].slots[0].card = { id: 'c3', letter: 'C' }

        const cleared = gameReducer(state, {
            type: 'local/wordClearedOptimistically',
            localPlayerId: 'p1',
            rowIndex: 0,
        })

        expect(cleared?.players[0].wordBoard.rows[0].slots[0].card).toBeNull()
        expect(cleared?.players[0].wordBoard.rows[0].slots[1].card).toBeNull()
        expect(cleared?.players[0].wordBoard.rows[0].isComplete).toBe(false)
        expect(cleared?.players[0].wordBoard.allComplete).toBe(false)
        expect(cleared?.players[0].hand).toEqual([
            { id: 'c1', letter: 'A' },
            { id: 'c3', letter: 'C' },
            { id: 'c2', letter: 'B' },
        ])
        expect(cleared?.players[0].handCount).toBe(3)
    })

    it('optimistically clears the whole board into hand in row-major order', () => {
        const state = createGameState({ hand: [] })
        state.players[0].wordBoard = {
            allComplete: true,
            rows: [
                {
                    targetLength: 2,
                    isComplete: true,
                    slots: [
                        { slotIndex: 0, card: { id: 'c1', letter: 'A' } },
                        { slotIndex: 1, card: null },
                    ],
                },
                {
                    targetLength: 2,
                    isComplete: true,
                    slots: [
                        { slotIndex: 0, card: { id: 'c2', letter: 'B' } },
                        { slotIndex: 1, card: { id: 'c3', letter: 'C' } },
                    ],
                },
            ],
        }

        const cleared = gameReducer(state, {
            type: 'local/boardClearedOptimistically',
            localPlayerId: 'p1',
        })

        expect(cleared?.players[0].hand).toEqual([
            { id: 'c1', letter: 'A' },
            { id: 'c2', letter: 'B' },
            { id: 'c3', letter: 'C' },
        ])
        expect(cleared?.players[0].handCount).toBe(3)
        expect(cleared?.players[0].wordBoard.allComplete).toBe(false)
        expect(cleared?.players[0].wordBoard.rows.every((row) => !row.isComplete)).toBe(true)
        expect(cleared?.players[0].wordBoard.rows.flatMap((row) => row.slots).every((slot) => slot.card === null)).toBe(true)
    })

    it('keeps invalid optimistic clear actions as no-ops', () => {
        const state = createGameState({ hand: [] })

        const invalidRow = gameReducer(state, {
            type: 'local/wordClearedOptimistically',
            localPlayerId: 'p1',
            rowIndex: 9,
        })
        expect(invalidRow).toEqual(state)

        const nonPlaying = gameReducer({ ...state, phase: 'finished' }, {
            type: 'local/boardClearedOptimistically',
            localPlayerId: 'p1',
        })
        expect(nonPlaying).toEqual({ ...state, phase: 'finished' })
    })

    it('optimistically discards from hand and advances to the next local player', () => {
        const discarded = gameReducer(createGameState({ turnPhase: 'arrange' }), {
            type: 'local/cardDiscardedOptimistically',
            localPlayerId: 'p1',
            cardId: 'c1',
        })

        expect(discarded?.players[0].hand).toEqual([])
        expect(discarded?.players[0].handCount).toBe(0)
        expect(discarded?.discardPileTop).toEqual({ id: 'c1', letter: 'A' })
        expect(discarded?.turn.currentPlayerId).toBe('p2')
        expect(discarded?.turn.phase).toBe('draw')
        expect(discarded?.turn.drawnCard).toBeNull()
    })

    it('optimistically discards from board and marks completion incomplete', () => {
        const state = createGameState({ hand: [], turnPhase: 'arrange' })
        state.players[0].wordBoard.allComplete = true
        state.players[0].wordBoard.rows[0].isComplete = true

        const discarded = gameReducer(state, {
            type: 'local/cardDiscardedOptimistically',
            localPlayerId: 'p1',
            cardId: 'c2',
        })

        expect(discarded?.players[0].wordBoard.rows[0].slots[1].card).toBeNull()
        expect(discarded?.players[0].wordBoard.rows[0].isComplete).toBe(false)
        expect(discarded?.players[0].wordBoard.allComplete).toBe(false)
        expect(discarded?.discardPileTop).toEqual({ id: 'c2', letter: 'B' })
        expect(discarded?.turn.currentPlayerId).toBe('p2')
        expect(discarded?.turn.phase).toBe('draw')
    })

    it('optimistically draws from discard only when the public top card exists', () => {
        const discardedTop = { id: 'd1', letter: 'D' }
        const drawn = gameReducer(createGameState({ discardPileTop: discardedTop }), {
            type: 'local/discardPileDrawnOptimistically',
            localPlayerId: 'p1',
        })

        expect(drawn?.players[0].hand).toEqual([
            { id: 'c1', letter: 'A' },
            discardedTop,
        ])
        expect(drawn?.players[0].handCount).toBe(2)
        expect(drawn?.discardPileTop).toBeNull()
        expect(drawn?.turn.phase).toBe('arrange')
        expect(drawn?.turn.drawnCard).toEqual(discardedTop)

        const drawPileState = createGameState()
        const withoutPublicCard = gameReducer(drawPileState, {
            type: 'local/discardPileDrawnOptimistically',
            localPlayerId: 'p1',
        })
        expect(withoutPublicCard).toEqual(drawPileState)
    })

    it('does not duplicate a discard-pile card when the server draw event reconciles an optimistic draw', () => {
        const discardedTop = { id: 'd1', letter: 'D' }
        const optimistic = gameReducer(createGameState({ discardPileTop: discardedTop }), {
            type: 'local/discardPileDrawnOptimistically',
            localPlayerId: 'p1',
        })

        const reconciled = gameReducer(optimistic, {
            type: 'game/cardDrawn',
            localPlayerId: 'p1',
            playerId: 'p1',
            card: discardedTop,
            drawPileCount: 10,
            discardPileTop: null,
        })

        expect(reconciled?.players[0].hand).toEqual([
            { id: 'c1', letter: 'A' },
            discardedTop,
        ])
        expect(reconciled?.players[0].handCount).toBe(2)
    })
})

describe('optimistic board reconciliation', () => {
    it('keeps rapid placements projected over an intermediate authoritative update', () => {
        const authoritative = createRapidPlacementState()
        let state = reconcile(initialGameReconciliationState, {
            type: 'game/state',
            state: authoritative,
            localPlayerId: 'p1',
        })
        state = reconcile(state, {
            type: 'local/cardPlacedOptimistically',
            localPlayerId: 'p1',
            clientActionId: 'action-a',
            cardId: 'card-a',
            rowIndex: 0,
            slotIndex: 0,
        })
        state = reconcile(state, {
            type: 'local/cardPlacedOptimistically',
            localPlayerId: 'p1',
            clientActionId: 'action-b',
            cardId: 'card-b',
            rowIndex: 0,
            slotIndex: 1,
        })

        const afterA = createRapidPlacementState()
        afterA.players[0].wordBoard.rows[0].slots[0].card = { id: 'card-a', letter: 'A' }
        afterA.players[0].hand = [
            { id: 'card-b', letter: 'B' },
            { id: 'card-c', letter: 'C' },
        ]
        afterA.players[0].handCount = 2
        state = reconcile(state, {
            type: 'game/boardUpdated',
            localPlayerId: 'p1',
            playerId: 'p1',
            wordBoard: afterA.players[0].wordBoard,
            hand: afterA.players[0].hand,
            handCount: 2,
            boardRevision: 1,
            clientActionId: 'action-a',
        })

        expect(state.pendingBoardOperations.map(({ clientActionId }) => clientActionId)).toEqual(['action-b'])
        expect(state.gameState?.players[0].wordBoard.rows[0].slots.map(({ card }) => card?.id ?? null)).toEqual([
            'card-a',
            'card-b',
            null,
        ])
        expect(state.gameState?.players[0].hand?.map(({ id }) => id)).toEqual(['card-c'])
    })

    it('uses exact ids without allowing stale acknowledgements to rewind newer intent', () => {
        let state = reconcile(initialGameReconciliationState, {
            type: 'game/state',
            state: createRapidPlacementState(),
            localPlayerId: 'p1',
        })
        for (const [suffix, cardId, slotIndex] of [
            ['a', 'card-a', 0],
            ['b', 'card-b', 1],
            ['c', 'card-c', 2],
        ] as const) {
            state = reconcile(state, {
                type: 'local/cardPlacedOptimistically',
                localPlayerId: 'p1',
                clientActionId: `action-${suffix}`,
                cardId,
                rowIndex: 0,
                slotIndex,
            })
        }

        const afterAB = createRapidPlacementState()
        afterAB.players[0].wordBoard.rows[0].slots[0].card = { id: 'card-a', letter: 'A' }
        afterAB.players[0].wordBoard.rows[0].slots[1].card = { id: 'card-b', letter: 'B' }
        afterAB.players[0].hand = [{ id: 'card-c', letter: 'C' }]
        afterAB.players[0].handCount = 1
        state = reconcile(state, {
            type: 'game/boardUpdated',
            localPlayerId: 'p1',
            playerId: 'p1',
            wordBoard: afterAB.players[0].wordBoard,
            hand: afterAB.players[0].hand,
            handCount: 1,
            boardRevision: 2,
            clientActionId: 'action-b',
        })

        const afterA = createRapidPlacementState()
        afterA.players[0].wordBoard.rows[0].slots[0].card = { id: 'card-a', letter: 'A' }
        afterA.players[0].hand = [
            { id: 'card-b', letter: 'B' },
            { id: 'card-c', letter: 'C' },
        ]
        afterA.players[0].handCount = 2
        state = reconcile(state, {
            type: 'game/boardUpdated',
            localPlayerId: 'p1',
            playerId: 'p1',
            wordBoard: afterA.players[0].wordBoard,
            hand: afterA.players[0].hand,
            handCount: 2,
            boardRevision: 1,
            clientActionId: 'action-a',
        })

        expect(state.authoritativeGameState?.players[0].boardRevision).toBe(2)
        expect(state.pendingBoardOperations.map(({ clientActionId }) => clientActionId)).toEqual(['action-c'])
        expect(state.gameState?.players[0].wordBoard.rows[0].slots.map(({ card }) => card?.id ?? null)).toEqual([
            'card-a',
            'card-b',
            'card-c',
        ])
    })

    it('preserves unknown acknowledgements across turn events and removes only a correlated rejection', () => {
        let state = reconcile(initialGameReconciliationState, {
            type: 'game/state',
            state: createRapidPlacementState(),
            localPlayerId: 'p1',
        })
        for (const [clientActionId, cardId, slotIndex] of [
            ['action-a', 'card-a', 0],
            ['action-b', 'card-b', 1],
        ] as const) {
            state = reconcile(state, {
                type: 'local/cardPlacedOptimistically',
                localPlayerId: 'p1',
                clientActionId,
                cardId,
                rowIndex: 0,
                slotIndex,
            })
        }
        state = reconcile(state, {
            type: 'game/boardUpdated',
            localPlayerId: 'p1',
            playerId: 'p1',
            wordBoard: createRapidPlacementState().players[0].wordBoard,
            hand: createRapidPlacementState().players[0].hand,
            handCount: 3,
            boardRevision: 1,
            clientActionId: 'unknown-action',
        })
        state = reconcile(state, {
            type: 'game/turnSkipped',
            playerId: 'p2',
            nextPlayerId: 'p1',
        })
        state = reconcile(state, {
            type: 'game/actionRejected',
            clientActionId: 'action-a',
            message: 'That move was rejected.',
        })

        expect(state.pendingBoardOperations.map(({ clientActionId }) => clientActionId)).toEqual(['action-b'])
        expect(state.gameState?.players[0].wordBoard.rows[0].slots[0].card).toBeNull()
        expect(state.gameState?.players[0].wordBoard.rows[0].slots[1].card?.id).toBe('card-b')
        expect(state.rejection?.message).toBe('That move was rejected.')
    })

    it('keeps terminal projection until a personalized full snapshot clears it', () => {
        let state = reconcile(initialGameReconciliationState, {
            type: 'game/state',
            state: createRapidPlacementState(),
            localPlayerId: 'p1',
        })
        state = reconcile(state, {
            type: 'local/cardPlacedOptimistically',
            localPlayerId: 'p1',
            clientActionId: 'action-a',
            cardId: 'card-a',
            rowIndex: 0,
            slotIndex: 0,
        })
        state = reconcile(state, { type: 'game/playerWon', winnerId: 'p2' })
        expect(state.pendingBoardOperations).toHaveLength(1)
        expect(state.gameState?.players[0].wordBoard.rows[0].slots[0].card?.id).toBe('card-a')

        const terminal = createRapidPlacementState()
        terminal.phase = 'finished'
        terminal.winnerId = 'p2'
        state = reconcile(state, { type: 'game/state', state: terminal, localPlayerId: 'p1' })
        expect(state.pendingBoardOperations).toEqual([])
        expect(state.gameState).toBe(terminal)
    })
})
