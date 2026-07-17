import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CSSProperties } from 'react'
import { fn } from 'storybook/test'

import { WordRow } from './WordRow'
import type { WordRowState } from './WordRow'

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

const partialRow: WordRowState = {
    targetLength: 4,
    slots: [
        { slotIndex: 0, card: CARDS[0] },
        { slotIndex: 1, card: CARDS[1] },
        { slotIndex: 2, card: null },
        { slotIndex: 3, card: null },
    ],
    isComplete: false,
}

const completeValidRow: WordRowState = {
    targetLength: 5,
    slots: CARDS.map((card, i) => ({ slotIndex: i, card })),
    isComplete: true,
}

const completeInvalidRow: WordRowState = {
    targetLength: 5,
    slots: CARDS.map((card, i) => ({ slotIndex: i, card })),
    isComplete: false,
}

const meta = {
    title: 'WordIt/Components/WordRow',
    component: WordRow,
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
        rowIndex: { control: 'number' },
        rowState: { control: 'object' },
        presentation: { control: 'radio', options: ['default', 'compact-result'] },
    },
    args: {
        rowIndex: 0,
        rowState: partialRow,
        onPlace: fn(),
        onUnplace: fn(),
        onCardSelected: fn(),
    },
} satisfies Meta<typeof WordRow>

export default meta
type Story = StoryObj<typeof meta>

/** All slots empty — ready to accept drops. */
export const Empty: Story = {
    args: {
        rowState: emptyRow(4),
    },
}

/** Some slots filled, some empty — neutral state, no validation shown yet. */
export const PartiallyFilled: Story = {
    args: {
        rowState: partialRow,
    },
}

/** All slots filled and the word is valid — green success state. */
export const CompleteValid: Story = {
    args: {
        rowState: completeValidRow,
    },
}

/** All slots filled but the word is not recognised — red error state. */
export const CompleteInvalid: Story = {
    args: {
        rowState: completeInvalidRow,
    },
}

/** Keyboard navigation highlights the selected row without replacing validation feedback. */
export const Selected: Story = {
    args: {
        rowState: partialRow,
        isSelected: true,
        selectedSlotIndex: 1,
    },
}

/** Read-only winning row uses the explicit compact result presentation. */
export const CompactResult: Story = {
    args: {
        rowState: completeValidRow,
        presentation: 'compact-result',
    },
    render: (args) => (
        <div
            style={{
                '--word-row-slot-count': args.rowState.slots.length,
                '--word-row-max-width': '22rem',
                width: 'min(90vw, 28rem)',
            } as CSSProperties}
        >
            <WordRow {...args} />
        </div>
    ),
}

/** A 3-letter row. */
export const ShortRow: Story = {
    args: {
        rowState: emptyRow(3),
    },
}
