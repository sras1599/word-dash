import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { WordSlot } from './WordSlot'

const SAMPLE_CARD = { id: 'card-e', letter: 'E' }

const meta = {
    title: 'WordIt/Components/WordSlot',
    component: WordSlot,
    parameters: {
        layout: 'centered',
        backgrounds: {
            default: 'light',
            values: [
                { name: 'light', value: '#f5f5f5' },
                { name: 'red', value: '#E8231A' },
                { name: 'teal', value: '#2DB89C' },
            ],
        },
    },
    tags: ['autodocs'],
    argTypes: {
        card: { control: 'object' },
        slotIndex: { control: 'number' },
        rowIndex: { control: 'number' },
    },
    args: {
        slotIndex: 0,
        rowIndex: 0,
        card: SAMPLE_CARD,
        onPlace: fn(),
        onUnplace: fn(),
        onCardSelected: fn(),
    },
} satisfies Meta<typeof WordSlot>

export default meta
type Story = StoryObj<typeof meta>

/** Slot with a card placed — player can drag or click the card. */
export const Filled: Story = {
    args: {
        card: SAMPLE_CARD,
    },
}

/** Empty slot — ready to accept a drop. */
export const Empty: Story = {
    args: {
        card: null,
    },
}

