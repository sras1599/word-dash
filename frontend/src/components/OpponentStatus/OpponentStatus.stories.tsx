import type { Meta, StoryObj } from '@storybook/react-vite'

import { OpponentStatus } from './OpponentStatus'

const VARIATION = { wordLengths: [3, 4, 5] }

function makePlayer(overrides?: {
    name?: string
    isConnected?: boolean
    handCount?: number
    completeCount?: number
}) {
    const {
        name = 'Bob',
        isConnected = true,
        handCount = 12,
        completeCount = 1,
    } = overrides ?? {}

    return {
        id: 'player-2',
        name,
        isConnected,
        handCount,
        wordBoard: {
            rows: VARIATION.wordLengths.map((_, i) => ({ isComplete: i < completeCount })),
        },
    }
}

const meta = {
    title: 'WordIt/Components/OpponentStatus',
    component: OpponentStatus,
    parameters: {
        layout: 'centered',
        backgrounds: {
            default: 'dark',
            values: [
                { name: 'dark', value: '#1a1a1a' },
                { name: 'red', value: '#E8231A' },
                { name: 'teal', value: '#2DB89C' },
                { name: 'light', value: '#f5f5f5' },
            ],
        },
    },
    tags: ['autodocs'],
    argTypes: {
        isActiveTurn: { control: 'boolean' },
        isArranging: { control: 'boolean' },
    },
    args: {
        player: makePlayer(),
        variation: VARIATION,
        isActiveTurn: false,
        isArranging: false,
    },
} satisfies Meta<typeof OpponentStatus>

export default meta
type Story = StoryObj<typeof meta>

/** Idle state — connected opponent, not their turn. */
export const Idle: Story = {
    args: {
        player: makePlayer(),
        isActiveTurn: false,
    },
}

/** Active turn — teal border indicates it is this opponent's turn. */
export const ActiveTurn: Story = {
    args: {
        player: makePlayer(),
        isActiveTurn: true,
    },
}

/** Active turn, arrange phase — teal border plus "(+1 drawn)" annotation. */
export const ActiveTurnArranging: Story = {
    args: {
        player: makePlayer({ handCount: 13 }),
        isActiveTurn: true,
        isArranging: true,
    },
}

/** Disconnected player — muted style and "disconnected" badge. */
export const Disconnected: Story = {
    args: {
        player: makePlayer({ isConnected: false }),
        isActiveTurn: false,
    },
}

/** All words complete — progress bar at 100%. */
export const AllComplete: Story = {
    args: {
        player: makePlayer({ completeCount: 3 }),
        isActiveTurn: false,
    },
}

/** No words complete yet — fresh into the game. */
export const NoneComplete: Story = {
    args: {
        player: makePlayer({ completeCount: 0, handCount: 7 }),
        isActiveTurn: false,
    },
}
