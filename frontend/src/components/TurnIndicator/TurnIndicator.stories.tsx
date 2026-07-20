import type { Meta, StoryObj } from '@storybook/react-vite'

import { TurnIndicator } from './TurnIndicator'

const LOCAL_PLAYER = { id: 'player-1', name: 'You' }
const OPPONENT = { id: 'player-2', name: 'Alice' }

const meta = {
    title: 'WordDash/Game/TurnIndicator',
    component: TurnIndicator,
    parameters: {
        layout: 'centered',
        backgrounds: {
            default: 'red',
            values: [
                { name: 'red', value: '#E8231A' },
                { name: 'teal', value: '#2DB89C' },
                { name: 'light', value: '#f5f5f5' },
            ],
        },
    },
    tags: ['autodocs'],
    argTypes: {
        phase: { control: 'select', options: ['draw', 'arrange', 'idle'] },
        isLocalPlayer: { control: 'boolean' },
    },
    args: {
        currentPlayer: LOCAL_PLAYER,
        phase: 'draw',
        isLocalPlayer: true,
    },
} satisfies Meta<typeof TurnIndicator>

export default meta
type Story = StoryObj<typeof meta>

/** Local player's turn in the draw phase — prominent teal, "Draw a card" label. */
export const LocalPlayerDraw: Story = {
    args: {
        currentPlayer: LOCAL_PLAYER,
        phase: 'draw',
        isLocalPlayer: true,
    },
}

/** Local player's turn in the arrange phase — teal background, "Arranging…" label. */
export const LocalPlayerArrange: Story = {
    args: {
        currentPlayer: LOCAL_PLAYER,
        phase: 'arrange',
        isLocalPlayer: true,
    },
}

/** Opponent's turn in the draw phase — muted style showing the opponent's name. */
export const OpponentDraw: Story = {
    args: {
        currentPlayer: OPPONENT,
        phase: 'draw',
        isLocalPlayer: false,
    },
}

/** Opponent's turn in the arrange phase — muted style, "Arranging…" label. */
export const OpponentArrange: Story = {
    args: {
        currentPlayer: OPPONENT,
        phase: 'arrange',
        isLocalPlayer: false,
    },
}

/** Idle phase — no phase label is rendered (between turns). */
export const IdlePhase: Story = {
    args: {
        currentPlayer: LOCAL_PLAYER,
        phase: 'idle',
        isLocalPlayer: true,
    },
}
