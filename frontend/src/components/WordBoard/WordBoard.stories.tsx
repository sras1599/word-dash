import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { WordBoard } from './WordBoard'
import type { WordBoardState } from './WordBoard'
import type { WordRowState } from '../WordRow/WordRow'

const CARDS = [
    { id: 'card-w', letter: 'W' },
    { id: 'card-o', letter: 'O' },
    { id: 'card-r', letter: 'R' },
    { id: 'card-d', letter: 'D' },
    { id: 'card-s', letter: 'S' },
]

const emptyRow = (length: number): WordRowState => ({
    targetLength: length,
    slots: Array.from({ length }, (_, i) => ({ slotIndex: i, card: null })),
    isComplete: false,
})

const emptyBoard345: WordBoardState = {
    rows: [emptyRow(3), emptyRow(4), emptyRow(5)],
    allComplete: false,
}

const partialBoard: WordBoardState = {
    rows: [
        {
            targetLength: 3,
            slots: [
                { slotIndex: 0, card: CARDS[0] },
                { slotIndex: 1, card: CARDS[1] },
                { slotIndex: 2, card: CARDS[2] },
            ],
            isComplete: true,
        },
        {
            targetLength: 4,
            slots: [
                { slotIndex: 0, card: CARDS[3] },
                { slotIndex: 1, card: null },
                { slotIndex: 2, card: null },
                { slotIndex: 3, card: null },
            ],
            isComplete: false,
        },
        emptyRow(5),
    ],
    allComplete: false,
}

const completeBoard: WordBoardState = {
    rows: [
        {
            targetLength: 3,
            slots: CARDS.slice(0, 3).map((card, i) => ({ slotIndex: i, card })),
            isComplete: true,
        },
        {
            targetLength: 4,
            slots: [CARDS[1], CARDS[2], CARDS[3], CARDS[4]].map((card, i) => ({ slotIndex: i, card })),
            isComplete: true,
        },
        {
            targetLength: 5,
            slots: CARDS.map((card, i) => ({ slotIndex: i, card })),
            isComplete: true,
        },
    ],
    allComplete: true,
}

const meta = {
    title: 'WordIt/Components/WordBoard',
    component: WordBoard,
    parameters: {
        layout: 'centered',
        backgrounds: {
            default: 'light',
            values: [
                { name: 'light', value: '#f5f5f5' },
                { name: 'dark', value: '#2a2a2a' },
            ],
        },
    },
    tags: ['autodocs'],
    argTypes: {
        wordBoard: { control: 'object' },
    },
    args: {
        wordBoard: partialBoard,
        onPlace: fn(),
        onUnplace: fn(),
        onClearWord: fn(),
        onCardSelected: fn(),
    },
} satisfies Meta<typeof WordBoard>

export default meta
type Story = StoryObj<typeof meta>

/** All rows empty — ready to receive cards (3-4-5 variation). */
export const Empty: Story = {
    args: {
        wordBoard: emptyBoard345,
    },
}

/** First row complete, second partially filled, third empty. */
export const PartiallyFilled: Story = {
    args: {
        wordBoard: partialBoard,
    },
}

/** All rows complete — celebration animation plays. */
export const AllComplete: Story = {
    args: {
        wordBoard: completeBoard,
    },
}

/** Single row — simple 4-letter variation. */
export const SingleRow: Story = {
    args: {
        wordBoard: {
            rows: [emptyRow(4)],
            allComplete: false,
        },
    },
}
