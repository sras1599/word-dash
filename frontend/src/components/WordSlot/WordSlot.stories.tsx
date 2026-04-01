import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { WordSlot } from './WordSlot'

const SAMPLE_CARD = { id: 'card-e', letter: 'E' }

const meta = {
    title: 'WordIt/WordSlot',
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
        isActive: { control: 'boolean' },
        isValid: {
            control: 'select',
            options: [null, true, false],
        },
        slotIndex: { control: 'number' },
        rowIndex: { control: 'number' },
    },
    args: {
        slotIndex: 0,
        rowIndex: 0,
        card: SAMPLE_CARD,
        isActive: true,
        isValid: null,
        onPlace: fn(),
        onUnplace: fn(),
        onCardSelected: fn(),
    },
} satisfies Meta<typeof WordSlot>

export default meta
type Story = StoryObj<typeof meta>

/** Active slot with a card placed — player can drag or click the card. */
export const FilledActive: Story = {
    args: {
        card: SAMPLE_CARD,
        isActive: true,
        isValid: null,
    },
}

/** Empty slot during the player's arrange phase — ready to accept a drop. */
export const EmptyActive: Story = {
    args: {
        card: null,
        isActive: true,
        isValid: null,
    },
}

/** Filled slot when it's not the player's turn — locked and muted. */
export const FilledLocked: Story = {
    args: {
        card: SAMPLE_CARD,
        isActive: false,
        isValid: null,
    },
}

/** Empty slot when it's not the player's turn — locked and muted. */
export const EmptyLocked: Story = {
    args: {
        card: null,
        isActive: false,
        isValid: null,
    },
}

/** Part of a validated word — green tint on the slot. */
export const Valid: Story = {
    args: {
        card: SAMPLE_CARD,
        isActive: false,
        isValid: true,
    },
}

/** Part of an unrecognised word — red tint on the slot. */
export const Invalid: Story = {
    args: {
        card: SAMPLE_CARD,
        isActive: true,
        isValid: false,
    },
}

