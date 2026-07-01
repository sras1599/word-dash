import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { GameBoard } from './GameBoard'
import type { GameBoardLocalPlayer, GameBoardOpponentPlayer, GameBoardTurn, GameBoardVariation } from './GameBoard'
import type { CardData } from '../Card/Card'

// ─── Shared fixtures ────────────────────────────────────────────────────────

const VARIATION_345: GameBoardVariation = { wordLengths: [3, 4, 5] }
const VARIATION_56: GameBoardVariation = { wordLengths: [5, 6] }
const VARIATION_8: GameBoardVariation = { wordLengths: [8] }
const VARIATION_444: GameBoardVariation = { wordLengths: [4, 4, 4] }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Generate `n` distinct face-up cards, one per letter. */
function makeHand(n: number): CardData[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `c${i + 1}`,
        letter: LETTERS[i % LETTERS.length],
    }))
}

/** Build an empty word board for the given variation. */
function emptyWordBoard(variation: GameBoardVariation) {
    return {
        rows: variation.wordLengths.map((len) => ({
            targetLength: len,
            slots: Array.from({ length: len }, (_, i) => ({ slotIndex: i, card: null })),
            isComplete: false,
        })),
        allComplete: false,
    }
}

const DISCARD_TOP: CardData = { id: 'cx', letter: 'X' }
const DRAWN_CARD: CardData = { id: 'drawn-n', letter: 'N' }

function makeLocalPlayer(variation: GameBoardVariation, id = 'local'): GameBoardLocalPlayer {
    const handSize = variation.wordLengths.reduce((sum, n) => sum + n, 0)
    return {
        id,
        name: 'Alice',
        isConnected: true,
        hand: makeHand(handSize),
        wordBoard: emptyWordBoard(variation),
    }
}

function makeOpponent(
    variation: GameBoardVariation,
    id: string,
    name: string,
    overrides?: Partial<GameBoardOpponentPlayer>,
): GameBoardOpponentPlayer {
    const handSize = variation.wordLengths.reduce((sum, n) => sum + n, 0)
    return {
        id,
        name,
        isConnected: true,
        handCount: handSize,
        wordBoard: emptyWordBoard(variation),
        ...overrides,
    }
}

// ─── Meta ────────────────────────────────────────────────────────────────────

const meta = {
    title: 'WordIt/Components/GameBoard',
    component: GameBoard,
    parameters: {
        layout: 'fullscreen',
        backgrounds: {
            default: 'dark',
            values: [{ name: 'dark', value: '#1a1a1a' }],
        },
    },
    tags: ['autodocs'],
    args: {
        phase: 'playing',
        localPlayerId: 'local',
        winnerId: null,
        localPlayer: makeLocalPlayer(VARIATION_345, 'local'),
        opponents: [
            makeOpponent(VARIATION_345, 'opp-1', 'Bob'),
            makeOpponent(VARIATION_345, 'opp-2', 'Carol'),
        ],
        variation: VARIATION_345,
        // No discard pile at the very start of the first round
        discardTopCard: null,
        drawPileCount: 42,
        boardSubtitle: 'Draw a card, then build or discard.',
        handCount: 12,
        drawnCardId: null,
        willAutoDiscardCardId: null,
        turn: {
            currentPlayerId: 'local',
            phase: 'draw',
            timeRemainingMs: 45_000,
            totalDurationMs: 60_000,
        } satisfies GameBoardTurn,
        onDraw: fn(),
        onPlace: fn(),
        onUnplace: fn(),
        onDiscard: fn(),
    },
} satisfies Meta<typeof GameBoard>

export default meta
type Story = StoryObj<typeof meta>

// ─── Stories ─────────────────────────────────────────────────────────────────

/** Local player's draw phase — only the card piles are interactive. */
export const LocalDrawPhase: Story = {}

/** Local player's arrange phase — hand and word board are interactive; discard pile accepts drops. */
export const LocalArrangePhase: Story = {
    args: {
        // By the arrange phase the draw pile has already been used, so a discard card exists
        discardTopCard: DISCARD_TOP,
        boardSubtitle: 'Arrange your cards before the timer expires.',
        turn: {
            currentPlayerId: 'local',
            phase: 'arrange',
            timeRemainingMs: 30_000,
            totalDurationMs: 60_000,
        },
    },
}

/** Opponent's turn — local player cannot interact with anything. */
export const OpponentTurn: Story = {
    args: {
        boardSubtitle: 'Waiting for Bob.',
        turn: {
            currentPlayerId: 'opp-1',
            phase: 'draw',
            timeRemainingMs: 20_000,
            totalDurationMs: 60_000,
        },
    },
}

/** Timer in urgent state (≤ 15 s remaining). */
export const TimerUrgent: Story = {
    args: {
        discardTopCard: DISCARD_TOP,
        localPlayer: {
            ...makeLocalPlayer(VARIATION_345, 'local'),
            hand: [...makeLocalPlayer(VARIATION_345, 'local').hand, DRAWN_CARD],
        },
        handCount: 13,
        boardSubtitle: 'Arrange your cards before the timer expires.',
        drawnCardId: DRAWN_CARD.id,
        willAutoDiscardCardId: DRAWN_CARD.id,
        turn: {
            currentPlayerId: 'local',
            phase: 'arrange',
            timeRemainingMs: 8_000,
            totalDurationMs: 60_000,
        },
    },
}

/** No opponents — single player or solo debug view. */
export const NoOpponents: Story = {
    args: {
        localPlayer: makeLocalPlayer(VARIATION_345, 'local'),
        opponents: [],
    },
}

/** Empty draw pile — draw pile shows an empty-state style. */
export const EmptyDrawPile: Story = {
    args: {
        drawPileCount: 0,
    },
}

/** Disconnected opponent — muted style and disconnected badge. */
export const DisconnectedOpponent: Story = {
    args: {
        localPlayer: makeLocalPlayer(VARIATION_345, 'local'),
        opponents: [
            makeOpponent(VARIATION_345, 'opp-1', 'Bob', { isConnected: false }),
            makeOpponent(VARIATION_345, 'opp-2', 'Carol'),
        ],
    },
}

// ─── Variation stories ────────────────────────────────────────────────────────

/** {5,6} variation — 11 cards dealt; two longer word rows. */
export const Variation56: Story = {
    args: {
        variation: VARIATION_56,
        localPlayer: makeLocalPlayer(VARIATION_56, 'local'),
        handCount: 11,
        opponents: [
            makeOpponent(VARIATION_56, 'opp-1', 'Bob'),
            makeOpponent(VARIATION_56, 'opp-2', 'Carol'),
        ],
    },
}

/** {8} variation — 8 cards dealt; single long word row. */
export const Variation8: Story = {
    args: {
        variation: VARIATION_8,
        localPlayer: makeLocalPlayer(VARIATION_8, 'local'),
        handCount: 8,
        opponents: [
            makeOpponent(VARIATION_8, 'opp-1', 'Bob'),
            makeOpponent(VARIATION_8, 'opp-2', 'Carol'),
        ],
    },
}

/** {4,4,4} variation — 12 cards dealt; three equal-length word rows. */
export const Variation444: Story = {
    args: {
        variation: VARIATION_444,
        localPlayer: makeLocalPlayer(VARIATION_444, 'local'),
        opponents: [
            makeOpponent(VARIATION_444, 'opp-1', 'Bob'),
            makeOpponent(VARIATION_444, 'opp-2', 'Carol'),
        ],
    },
}
