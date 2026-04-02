import type { Meta, StoryObj } from '@storybook/react-vite'

import { TurnTimer } from './TurnTimer'

const meta = {
    title: 'WordIt/Components/TurnTimer',
    component: TurnTimer,
    parameters: {
        layout: 'centered',
        backgrounds: {
            default: 'light',
            values: [
                { name: 'light', value: '#f5f5f5' },
                { name: 'dark', value: '#1a1a1a' },
            ],
        },
    },
    tags: ['autodocs'],
    argTypes: {
        timeRemainingMs: { control: { type: 'range', min: 0, max: 60000, step: 1000 } },
        totalDurationMs: { control: { type: 'number' } },
        isActive: { control: 'boolean' },
    },
    args: {
        timeRemainingMs: 42_000,
        totalDurationMs: 60_000,
        isActive: true,
    },
} satisfies Meta<typeof TurnTimer>

export default meta
type Story = StoryObj<typeof meta>

/** Normal countdown — plenty of time remaining. */
export const Normal: Story = {
    args: {
        timeRemainingMs: 42_000,
    },
}

/** Urgency state — 9 seconds left, text turns red and pulses. */
export const Urgent: Story = {
    args: {
        timeRemainingMs: 9_000,
    },
}

/** Expired — time has run out; solid red, no pulse. */
export const Expired: Story = {
    args: {
        timeRemainingMs: 0,
    },
}

/** Idle — between turns; component is hidden. */
export const Idle: Story = {
    args: {
        isActive: false,
        timeRemainingMs: 0,
    },
}
