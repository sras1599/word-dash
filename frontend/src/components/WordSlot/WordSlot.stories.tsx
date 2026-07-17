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

/** Filled slot and nested card both expose keyboard selection feedback. */
export const Selected: Story = {
    args: {
        isSelected: true,
    },
}

/** A newly drawn card keeps its own visual state inside the slot. */
export const Drawn: Story = {
    args: {
        drawnCardId: SAMPLE_CARD.id,
    },
}

/** Without interaction callbacks the nested card is read-only. */
export const ReadOnly: Story = {
    args: {
        onPlace: undefined,
        onCardSelected: undefined,
    },
}
