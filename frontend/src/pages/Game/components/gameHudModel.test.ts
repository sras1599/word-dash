import { describe, expect, it } from 'vitest'
import {
    LOCAL_PLAYER_ID,
    createScenarioState,
    setGamePhase,
} from '../../../story-support/gameSimulation/simulation'
import { createGameHudModel } from './gameHudModel'

function createModel(
    scenario: Parameters<typeof createScenarioState>[0],
    overrides: Partial<Parameters<typeof createGameHudModel>[0]> = {},
) {
    return createGameHudModel({
        gameState: createScenarioState(scenario).gameState,
        localPlayerId: LOCAL_PLAYER_ID,
        timeRemainingMs: 42_000,
        turnDurationMs: 60_000,
        timerIsUrgent: false,
        ...overrides,
    })
}

describe('createGameHudModel', () => {
    it('describes the local draw and arrange phases', () => {
        const draw = createModel('draw')
        expect(draw).toMatchObject({
            ownerLabel: 'Your turn',
            title: 'Draw a card',
            detail: 'Choose the deck or discard pile.',
            compactTitle: 'Draw',
            timerLabel: '0:42',
            progress: 0.7,
        })

        expect(createModel('arrange-draw')).toMatchObject({
            title: 'Build words or discard',
            compactTitle: 'Build / discard',
        })
    })

    it('uses explicit urgent copy in addition to urgent color state', () => {
        const model = createModel('urgent', {
            timeRemainingMs: 7_000,
            timerIsUrgent: true,
        })

        expect(model).toMatchObject({
            title: 'Discard now',
            compactTitle: 'Discard now',
            detail: 'Your drawn card will be discarded when time expires.',
            isUrgent: true,
        })
    })

    it('names the active opponent while keeping compact mobile copy short', () => {
        const gameState = createScenarioState('opponent', { longContent: true }).gameState
        const model = createModel('opponent', { gameState })

        expect(model.ownerLabel).toBe('Opponent turn')
        expect(model.title).toBe("Bob With An Extraordinarily Long Display Name's turn")
        expect(model.compactTitle).toBe('Waiting')
        expect(model.detail).toBe('You can continue arranging your words.')
    })

    it('uses inactive waiting copy', () => {
        const waitingState = setGamePhase(createScenarioState('draw'), 'waiting').gameState
        const model = createModel('draw', { gameState: waitingState })

        expect(model).toMatchObject({
            ownerLabel: 'Getting ready',
            title: 'Preparing the board',
            compactTitle: 'Preparing',
            timerLabel: '—',
            timerAriaLabel: 'Turn timer inactive',
            isActive: false,
        })
    })

    it('clamps progress and formats zero time', () => {
        expect(createModel('draw', { timeRemainingMs: 90_000 }).progress).toBe(1)
        expect(createModel('draw', { timeRemainingMs: -10_000 })).toMatchObject({
            timerLabel: '0:00',
            progress: 0,
        })
        expect(createModel('draw', { turnDurationMs: 0 }).progress).toBe(0)
    })

    it('suppresses the rail after the game finishes', () => {
        expect(createModel('finished').isVisible).toBe(false)
    })
})
