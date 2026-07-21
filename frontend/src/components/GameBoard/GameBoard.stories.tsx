import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'

import { GameBoard } from './GameBoard'
import type { GameBoardLocalPlayer, GameBoardOpponentPlayer, GameBoardTurn, GameBoardVariation } from './GameBoard'
import type { CardData } from '../Card/Card'
import type { WordBoardState } from '../WordBoard/WordBoard'
import '../../pages/Game/Game.css'

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
function emptyWordBoard(variation: GameBoardVariation): WordBoardState {
    return {
        rows: variation.wordLengths.map((len) => ({
            targetLength: len,
            slots: Array.from({ length: len }, (_, i) => ({ slotIndex: i, card: null })),
            isComplete: false,
        })),
        allComplete: false,
    }
}

function wordBoardWithPlacedCard(variation: GameBoardVariation, card: CardData, rowIndex = 0, slotIndex = 0) {
    const board = emptyWordBoard(variation)
    board.rows[rowIndex].slots[slotIndex].card = card
    return board
}

function wordBoardWithCompletedRow(variation: GameBoardVariation, rowIndex = 0) {
    const board = emptyWordBoard(variation)
    board.rows[rowIndex].slots = board.rows[rowIndex].slots.map((slot, slotIndex) => ({
        ...slot,
        card: { id: `complete-${rowIndex}-${slotIndex}`, letter: LETTERS[slotIndex] },
    }))
    board.rows[rowIndex].isComplete = true
    board.allComplete = board.rows.every((row) => row.isComplete)
    return board
}

function keyboardShortcutBoard() {
    const board = emptyWordBoard(VARIATION_345)
    board.rows[0].slots[0].card = { id: 'placed-c', letter: 'C' }
    board.rows[0].slots[2].card = { id: 'placed-a', letter: 'A' }
    return board
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
    title: 'WordDash/Game/GameBoard',
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
        handCount: 12,
        drawnCardId: null,
        willAutoDiscardCardId: null,
        turn: {
            currentPlayerId: 'local',
            phase: 'draw',
        } satisfies GameBoardTurn,
        onDraw: fn(),
        onPlace: fn(),
        onUnplace: fn(),
        onClearWord: fn(),
        onClearBoard: fn(),
        onDiscard: fn(),
    },
} satisfies Meta<typeof GameBoard>

export default meta
type Story = StoryObj<typeof meta>

const productionRender: Story['render'] = (args) => (
    <div className="page-game">
        <main className="page-game__main">
            <GameBoard {...args} />
        </main>
    </div>
)

// ─── Stories ─────────────────────────────────────────────────────────────────

/** Local player's draw phase — only the card piles are interactive. */
export const LocalDrawPhase: Story = {}

/** Frozen production import path used for cascade and screenshot parity checks. */
export const ProductionDrawParity: Story = {
    render: productionRender,
    play: async ({ canvasElement }) => {
        const label = canvasElement.querySelector<HTMLElement>('.word-board__row-label')
        const row = canvasElement.querySelector<HTMLElement>('.word-row')
        const slot = canvasElement.querySelector<HTMLElement>('.word-slot--empty')
        const hand = canvasElement.querySelector<HTMLElement>('.player-hand__cards')
        const shortcutsButton = canvasElement.querySelector<HTMLElement>('.game-board__shortcuts-btn')

        if (!label || !row || !slot || !hand || !shortcutsButton) {
            throw new Error('Expected production GameBoard elements')
        }

        await expect(getComputedStyle(label).display).toBe('none')
        const rootFontSize = Number.parseFloat(getComputedStyle(canvasElement.ownerDocument.documentElement).fontSize)
        await expect(Number.parseFloat(getComputedStyle(row).padding)).toBeCloseTo(rootFontSize * 0.2, 4)
        await expect(getComputedStyle(slot).borderStyle).toBe('dashed')
        await expect(getComputedStyle(slot).borderWidth).toBe('2px')
        await expect(getComputedStyle(hand).overflowX).toBe('visible')
        await expect(getComputedStyle(hand).flexWrap).toBe('wrap')
        await expect(getComputedStyle(hand).justifyContent).toBe('center')
        await expect(getComputedStyle(shortcutsButton).position).toBe('fixed')
        await expect(shortcutsButton.querySelector('kbd')).toBeNull()
        await expect(shortcutsButton.querySelector('svg')).not.toBeNull()
    },
}

export const KeyboardShortcuts: Story = {
    args: {
        discardTopCard: DISCARD_TOP,
        localPlayer: {
            ...makeLocalPlayer(VARIATION_345, 'local'),
            hand: [
                { id: 'hand-b', letter: 'B' },
                { id: 'hand-e', letter: 'E' },
            ],
            wordBoard: keyboardShortcutBoard(),
        },
        handCount: 2,
        turn: {
            currentPlayerId: 'local',
            phase: 'draw',
        },
    },
    play: async ({ args, canvasElement, userEvent }) => {
        const documentBody = canvasElement.ownerDocument.body

        await userEvent.keyboard('{Shift>}?{/Shift}')
        await waitFor(() => expect(documentBody.querySelector('[role="dialog"]')).not.toBeNull())
        await userEvent.keyboard('{Escape}')
        await waitFor(() => expect(documentBody.querySelector('[role="dialog"]')).toBeNull())

        await userEvent.keyboard('{Shift>}{Alt>}D{/Alt}{/Shift}')
        await expect(args.onDraw).toHaveBeenCalledWith('discard')

        await userEvent.keyboard('{Shift>}D{/Shift}')
        await expect(args.onDraw).toHaveBeenCalledWith('draw')

        await userEvent.keyboard('{Shift>}H{/Shift}')
        await waitFor(() => expect(getSelectedHandCard(canvasElement)).toHaveAttribute('aria-label', 'Letter B'))

        await userEvent.keyboard('{ArrowRight}')
        await waitFor(() => expect(getSelectedHandCard(canvasElement)).toHaveAttribute('aria-label', 'Letter E'))

        await userEvent.keyboard('{ArrowLeft}')
        await waitFor(() => expect(getSelectedHandCard(canvasElement)).toHaveAttribute('aria-label', 'Letter B'))

        await userEvent.keyboard('{Shift>}B{/Shift}')
        await waitFor(() => expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-row-index', '0'))

        await userEvent.keyboard('2')
        await waitFor(() => expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-row-index', '1'))
        await expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-slot-index', '0')

        await userEvent.keyboard('{ArrowRight}')
        await waitFor(() => expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-slot-index', '1'))

        await userEvent.keyboard('3')
        await waitFor(() => expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-row-index', '2'))
        await expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-slot-index', '0')

        await userEvent.keyboard('{ArrowDown}')
        await waitFor(() => expect(getSelectedHandCard(canvasElement)).toHaveAttribute('aria-label', 'Letter B'))

        await userEvent.keyboard('{ArrowUp}')
        await waitFor(() => expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-row-index', '2'))

        await userEvent.keyboard('{Shift>}B{/Shift}')
        await waitFor(() => expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-row-index', '2'))

        await userEvent.keyboard('1')
        await waitFor(() => expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-row-index', '0'))
        await expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-slot-index', '1')

        await userEvent.keyboard('b')
        await expect(args.onPlace).toHaveBeenCalledWith('hand-b', 0, 1)

        await userEvent.keyboard('{ArrowRight}')
        await waitFor(() => expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-slot-index', '2'))
        const placeCallsBeforeSameLetter = getMockCallCount(args.onPlace)
        await userEvent.keyboard('a')
        await expect(args.onPlace).toHaveBeenCalledTimes(placeCallsBeforeSameLetter)

        await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
        await waitFor(() => expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-slot-index', '0'))
        await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
        await expect(args.onPlace).toHaveBeenCalledWith('placed-c', 0, 1)

        await userEvent.keyboard('{ArrowRight}')
        await waitFor(() => expect(getSelectedSlot(canvasElement)).toHaveAttribute('data-slot-index', '2'))
        await userEvent.keyboard('{Backspace}')
        await expect(args.onUnplace).toHaveBeenCalledWith(0, 2)

        await userEvent.keyboard('{Shift>}{Backspace}{/Shift}')
        await expect(args.onClearWord).toHaveBeenCalledWith(0)

        await userEvent.keyboard('{Shift>}{Alt>}{Delete}{/Alt}{/Shift}')
        await expect(args.onClearBoard).toHaveBeenCalled()
    },
}

/** Local player's arrange phase — hand and word board are interactive; discard pile accepts drops. */
export const LocalArrangePhase: Story = {
    args: {
        // By the arrange phase the draw pile has already been used, so a discard card exists
        discardTopCard: DISCARD_TOP,
        turn: {
            currentPlayerId: 'local',
            phase: 'arrange',
        },
    },
    play: async ({ args, canvasElement, userEvent }) => {
        await userEvent.keyboard('{Shift>}H{/Shift}')
        await waitFor(() => expect(getSelectedHandCard(canvasElement)).toHaveAttribute('aria-label', 'Letter A'))

        await userEvent.keyboard('{Shift>}D{/Shift}')
        await expect(args.onDiscard).toHaveBeenCalledWith('c1')

        const firstHandCard = canvasElement.querySelector<HTMLElement>('.player-hand .card[role="button"]')
        if (!firstHandCard) throw new Error('Expected an interactive hand card')
        await userEvent.click(firstHandCard)
        await userEvent.click(canvasElement.querySelector<HTMLElement>('.card-pile--discard')!)
        await expect(args.onDiscard).toHaveBeenCalledWith('c1')
    },
}

export const ProductionArrangeParity: Story = {
    ...LocalArrangePhase,
    render: productionRender,
}

/** Arrange phase after all cards have been placed; hand remains a drop target. */
export const EmptyHandArrangePhase: Story = {
    args: {
        discardTopCard: DISCARD_TOP,
        localPlayer: {
            ...makeLocalPlayer(VARIATION_345, 'local'),
            hand: [],
            wordBoard: wordBoardWithPlacedCard(VARIATION_345, { id: 'placed-a', letter: 'A' }),
        },
        handCount: 0,
        turn: {
            currentPlayerId: 'local',
            phase: 'arrange',
        },
    },
}

/** Opponent's turn — local player cannot interact with anything. */
export const OpponentTurn: Story = {
    args: {
        turn: {
            currentPlayerId: 'opp-1',
            phase: 'draw',
        },
    },
}

export const ServerPlayerOrder: Story = {
    args: {
        playerOrder: ['opp-1', 'local', 'opp-2'],
    },
    play: async ({ canvasElement }) => {
        const playerCards = Array.from(canvasElement.querySelectorAll<HTMLElement>('.player-status-strip__card'))
        await expect(playerCards.map((card) => card.getAttribute('aria-label')?.split(',')[0]))
            .toEqual(['Bob', 'Alice', 'Carol'])
    },
}

/** Four server-ordered players expose different authoritative word progress. */
export const FourPlayersWithProgress: Story = {
    args: {
        playerOrder: ['opp-2', 'local', 'opp-1', 'opp-3'],
        localPlayer: {
            ...makeLocalPlayer(VARIATION_345, 'local'),
            wordBoard: wordBoardWithCompletedRow(VARIATION_345),
        },
        opponents: [
            makeOpponent(VARIATION_345, 'opp-1', 'Bob'),
            makeOpponent(VARIATION_345, 'opp-2', 'Carol', {
                wordBoard: wordBoardWithCompletedRow(VARIATION_345),
            }),
            makeOpponent(VARIATION_345, 'opp-3', 'Dominique Verylongplayername'),
        ],
    },
    play: async ({ canvasElement }) => {
        const playerCards = Array.from(canvasElement.querySelectorAll<HTMLElement>('.player-status-strip__card'))
        await expect(playerCards.map((card) => card.getAttribute('aria-label')?.split(',')[0]))
            .toEqual(['Carol', 'Alice', 'Bob', 'Dominique Verylongplayername'])
        await expect(playerCards[0]).toHaveAccessibleName(/1 of 3 valid words/)
        await expect(playerCards[1]).toHaveAccessibleName(/1 of 3 valid words/)
    },
}

/** Medium production composition moves players above the workspace. */
export const MediumProductionLayout: Story = {
    ...FourPlayersWithProgress,
    render: productionRender,
    parameters: { viewport: { defaultViewport: 'tablet' } },
}

/** Narrow production composition keeps players scrollable and piles horizontal. */
export const MobileProductionLayout: Story = {
    ...FourPlayersWithProgress,
    render: productionRender,
    parameters: { viewport: { defaultViewport: 'mobile1' } },
}

/** Finished state retains all player statistics while identifying the winner. */
export const FinishedWithWinner: Story = {
    args: {
        phase: 'finished',
        winnerId: 'opp-1',
        turn: { currentPlayerId: 'opp-1', phase: 'idle' },
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
        drawnCardId: DRAWN_CARD.id,
        willAutoDiscardCardId: DRAWN_CARD.id,
        turn: {
            currentPlayerId: 'local',
            phase: 'arrange',
        },
    },
}

/** Urgent timer with the drawn card already placed on the word board. */
export const TimerUrgentBoardCard: Story = {
    args: {
        discardTopCard: DISCARD_TOP,
        localPlayer: {
            ...makeLocalPlayer(VARIATION_345, 'local'),
            hand: makeHand(11),
            wordBoard: wordBoardWithPlacedCard(VARIATION_345, DRAWN_CARD),
        },
        handCount: 11,
        drawnCardId: DRAWN_CARD.id,
        willAutoDiscardCardId: DRAWN_CARD.id,
        turn: {
            currentPlayerId: 'local',
            phase: 'arrange',
        },
    },
}

export const ProductionUrgentParity: Story = {
    ...TimerUrgentBoardCard,
    render: productionRender,
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

function getSelectedSlot(canvasElement: HTMLElement): HTMLElement {
    const selectedSlot = canvasElement.querySelector<HTMLElement>('.word-slot--selected')
    if (!selectedSlot) {
        throw new Error('Expected a selected word slot')
    }

    return selectedSlot
}

function getSelectedHandCard(canvasElement: HTMLElement): HTMLElement {
    const selectedCard = canvasElement.querySelector<HTMLElement>('.player-hand .card--selected')
    if (!selectedCard) {
        throw new Error('Expected a selected hand card')
    }

    return selectedCard
}

function getMockCallCount(mockFn: unknown): number {
    return (mockFn as { mock?: { calls: unknown[] } }).mock?.calls.length ?? 0
}
