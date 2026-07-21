import { describe, expect, it } from 'vitest'
import {
    advanceTurn,
    createScenarioState,
    createSimulationState,
    discardCard,
    drawCard,
    expireTurn,
    fillWord,
    LOCAL_PLAYER_ID,
    placeCard,
    setPlayerConnected,
} from './simulation'

describe('game simulation', () => {
    it('runs a deterministic local draw, arrange, discard, and opponent turn loop', () => {
        const initial = createSimulationState()
        const drawn = drawCard(initial, 'draw')
        const drawnCard = drawn.gameState.turn.drawnCard

        expect(drawnCard).not.toBeNull()
        expect(drawn.gameState.turn.phase).toBe('arrange')
        expect(drawn.gameState.drawPileCount).toBe(39)

        const placed = placeCard(drawn, drawnCard!.id, 0, 0)
        expect(placed.gameState.players[0].wordBoard.rows[0].slots[0].card)
            .toEqual(drawnCard)

        const discarded = discardCard(placed, placed.gameState.players[0].hand![0].id)
        expect(discarded.gameState.turn.currentPlayerId).not.toBe(LOCAL_PLAYER_ID)
        expect(discarded.gameState.turn.phase).toBe('draw')

        const returned = advanceTurn(discarded)
        expect(returned.gameState.turn.currentPlayerId).toBe(LOCAL_PLAYER_ID)
        expect(returned.eventLog.map(({ label }) => label)).toEqual([
            `draw(draw): ${drawnCard!.letter}`,
            `place(${drawnCard!.id}, 0, 0)`,
            expect.stringMatching(/^discard/),
            expect.stringMatching(/^advanceTurn/),
        ])
    })

    it('automatically discards the drawn card on local arrange expiry', () => {
        const arranging = drawCard(createSimulationState(), 'draw')
        const drawnCard = arranging.gameState.turn.drawnCard
        const expired = expireTurn(arranging)

        expect(expired.gameState.discardPileTop).toEqual(drawnCard)
        expect(expired.gameState.turn.currentPlayerId).not.toBe(LOCAL_PLAYER_ID)
        expect(expired.eventLog.some(({ label }) => label.includes('automatic discard')))
            .toBe(true)
    })

    it('replays rapid placements over a delayed intermediate acknowledgement', () => {
        const state = createScenarioState('slow-network')
        const localPlayer = state.gameState.players.find(({ id }) => id === LOCAL_PLAYER_ID)!

        expect(localPlayer.wordBoard.rows[0].slots.map(({ card }) => card?.id ?? null)).toEqual([
            'hand-1',
            'hand-2',
            'hand-3',
        ])
        expect(state.reconciliation.pendingBoardOperations.map(({ clientActionId }) => clientActionId)).toEqual([
            'simulation-2',
            'simulation-3',
        ])
    })

    it('creates isolated deterministic resets and scenario fixtures', () => {
        const first = createSimulationState()
        const changed = drawCard(first, 'draw')
        const reset = createSimulationState()

        expect(reset).toEqual(first)
        expect(reset).not.toBe(first)
        expect(reset.gameState.players[0].hand).not.toBe(changed.gameState.players[0].hand)
        expect(createScenarioState('arrange-discard').gameState.discardPileTop).toBeNull()
        expect(createScenarioState('opponent').gameState.turn.currentPlayerId)
            .not.toBe(LOCAL_PLAYER_ID)
    })

    it('supports validation and connection controls without network clients', () => {
        const initial = createSimulationState()
        const opponentId = initial.gameState.players[1].id
        const invalid = fillWord(initial, false)
        const valid = fillWord(invalid, true)
        const disconnected = setPlayerConnected(valid, opponentId, false)

        expect(invalid.gameState.players[0].wordBoard.rows[0].isComplete).toBe(false)
        expect(valid.gameState.players[0].wordBoard.rows[0].isComplete).toBe(true)
        expect(disconnected.gameState.players[1].isConnected).toBe(false)
    })

    it('builds the deterministic redesign pressure fixture', () => {
        const stress = createScenarioState('stress', {
            playerCount: 4,
            wordLengths: [8, 9, 10],
            longContent: true,
            discardPileEmpty: true,
            drawPileCount: 2,
            nearlyComplete: true,
            overflowingHand: true,
        })
        const localPlayer = stress.gameState.players[0]

        expect(stress.gameState.players).toHaveLength(4)
        expect(stress.gameState.players[1].isConnected).toBe(false)
        expect(stress.gameState.players[1].name).toContain('Extraordinarily Long')
        expect(stress.gameState.discardPileTop).toBeNull()
        expect(stress.gameState.drawPileCount).toBe(1)
        expect(stress.gameState.turn.phase).toBe('arrange')
        expect(localPlayer.handCount).toBeGreaterThan(27)
        expect(localPlayer.wordBoard.rows.every((row) =>
            row.slots.slice(0, -1).every(({ card }) => card !== null)
            && row.slots.at(-1)?.card === null,
        )).toBe(true)
    })
})
