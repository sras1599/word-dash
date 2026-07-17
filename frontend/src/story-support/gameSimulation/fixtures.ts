import type { Card, GamePlayer, GameState, Variation, WordBoardState } from '../../lib/gameTypes'

export const LOCAL_PLAYER_ID = 'player-alice'
export const DEFAULT_TURN_DURATION_MS = 60_000

const PLAYER_NAMES = ['Alice', 'Bob', 'Carol', 'Dev']
const LETTERS = 'ETAOINSHRDLUCMFPGWYBVKXJQZ'

export type SimulationFixtureOptions = {
    playerCount?: 2 | 4
    wordLengths?: number[]
    longContent?: boolean
}

export type SimulationFixture = {
    gameState: GameState
    drawDeck: Card[]
}

function createCards(prefix: string, count: number, offset = 0): Card[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `${prefix}-${index + 1}`,
        letter: LETTERS[(index + offset) % LETTERS.length],
    }))
}

function createEmptyBoard(variation: Variation): WordBoardState {
    return {
        rows: variation.wordLengths.map((targetLength) => ({
            targetLength,
            slots: Array.from({ length: targetLength }, (_, slotIndex) => ({
                slotIndex,
                card: null,
            })),
            isComplete: false,
        })),
        allComplete: false,
    }
}

function createPlayer(
    index: number,
    variation: Variation,
    handSize: number,
    longContent: boolean,
): GamePlayer {
    const hand = index === 0 ? createCards('hand', handSize, 2) : undefined

    return {
        id: index === 0 ? LOCAL_PLAYER_ID : `player-${index + 1}`,
        name: longContent && index === 1
            ? 'Bob With An Extraordinarily Long Display Name'
            : PLAYER_NAMES[index],
        isReady: true,
        isConnected: true,
        handCount: handSize,
        hand,
        wordBoard: createEmptyBoard(variation),
    }
}

export function createSimulationFixture({
    playerCount = 2,
    wordLengths = [3, 4, 5],
    longContent = false,
}: SimulationFixtureOptions = {}): SimulationFixture {
    const variation = { wordLengths }
    const boardCardCount = wordLengths.reduce((total, length) => total + length, 0)
    const handSize = longContent ? boardCardCount + 12 : boardCardCount
    const players = Array.from({ length: playerCount }, (_, index) =>
        createPlayer(index, variation, handSize, longContent))
    const drawDeck = createCards('draw', 40, 8)

    return {
        gameState: {
            roomCode: 'STORY',
            variation,
            players,
            drawPileCount: drawDeck.length,
            discardPileTop: { id: 'discard-start', letter: 'A' },
            turn: {
                currentPlayerId: LOCAL_PLAYER_ID,
                phase: 'draw',
                drawnCard: null,
            },
            phase: 'playing',
            winnerId: null,
            hostPlayerId: LOCAL_PLAYER_ID,
        },
        drawDeck,
    }
}

export function createFourPlayerFixture(): SimulationFixture {
    return createSimulationFixture({ playerCount: 4 })
}

export function createLongContentFixture(): SimulationFixture {
    return createSimulationFixture({
        playerCount: 4,
        wordLengths: [8, 9, 10],
        longContent: true,
    })
}
