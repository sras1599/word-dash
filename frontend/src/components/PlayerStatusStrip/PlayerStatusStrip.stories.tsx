import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { PlayerStatusStrip, type PlayerStatusStripPlayer } from './PlayerStatusStrip'

const PLAYERS: PlayerStatusStripPlayer[] = [
    {
        id: 'local',
        name: 'Alice',
        isLocal: true,
        isConnected: true,
        cardCount: 12,
        validWordCount: 1,
        totalWordCount: 3,
    },
    {
        id: 'opponent',
        name: 'Bob',
        isLocal: false,
        isConnected: true,
        cardCount: 10,
        validWordCount: 0,
        totalWordCount: 3,
    },
]

const meta = {
    title: 'WordDash/Game/PlayerStatusStrip',
    component: PlayerStatusStrip,
    parameters: {
        layout: 'padded',
        backgrounds: {
            default: 'dark',
            values: [{ name: 'dark', value: '#1a1a1a' }],
        },
    },
    tags: ['autodocs'],
    args: {
        players: PLAYERS,
        phase: 'playing',
        currentPlayerId: 'local',
        turnPhase: 'draw',
        winnerId: null,
    },
} satisfies Meta<typeof PlayerStatusStrip>

export default meta
type Story = StoryObj<typeof meta>

/** The local player is identified as active without duplicating the HUD instruction. */
export const LocalDrawTurn: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        const strip = canvas.getByRole('region', { name: 'Player status' })
        const status = within(strip)

        await expect(status.getByText('Alice', { selector: '.player-status-strip__name-text' })).toBeInTheDocument()
        await expect(status.getByText('You', { selector: '.player-status-strip__local-tag' })).toBeInTheDocument()
        await expect(status.getByText('Drawing…')).toBeInTheDocument()
        await expect(status.queryByText('Draw a card')).not.toBeInTheDocument()
        await expect(status.queryByTitle('Cards in hand')).not.toBeInTheDocument()
        await expect(status.getByLabelText('1 of 3 valid words')).toBeInTheDocument()
        await expect(status.getByRole('article', {
            name: /Alice, you, active player, Drawing…, 1 of 3 valid words/,
        })).toBeInTheDocument()
    },
}

/** The local arrange turn uses the same stable strip geometry. */
export const LocalArrangeTurn: Story = {
    args: { turnPhase: 'arrange' },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('Building…')).toBeInTheDocument()
    },
}

/** An opponent is drawing while the local player remains inactive. */
export const OpponentTurn: Story = {
    args: {
        currentPlayerId: 'opponent',
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)

        await expect(canvas.getByText('Drawing…')).toBeInTheDocument()
        await expect(canvas.queryByText('Your Turn')).not.toBeInTheDocument()
    },
}

/** All connected players report that the game is waiting to begin. */
export const Waiting: Story = {
    args: {
        phase: 'waiting',
        currentPlayerId: '',
        turnPhase: 'idle',
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)

        await expect(canvas.getAllByText('Waiting')).toHaveLength(2)
    },
}

/** Disconnection status takes precedence even when the disconnected player owns the turn. */
export const DisconnectedPlayer: Story = {
    args: {
        players: PLAYERS.map((player) => (
            player.id === 'opponent' ? { ...player, isConnected: false } : player
        )),
        currentPlayerId: 'opponent',
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)

        await expect(canvas.getByText('Disconnected')).toBeInTheDocument()
        await expect(canvas.queryByText('Drawing…')).not.toBeInTheDocument()
    },
}

/** The completed round identifies the winning player. */
export const FinishedWithWinner: Story = {
    args: {
        phase: 'finished',
        currentPlayerId: 'opponent',
        turnPhase: 'idle',
        winnerId: 'opponent',
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)

        await expect(canvas.getByText('Winner')).toBeInTheDocument()
        await expect(canvas.getByText('Bob')).toBeInTheDocument()
    },
}

/** Player cards retain server order in the compact horizontal mobile strip. */
export const MobileStrip: Story = {
    args: {
        players: [
            ...PLAYERS,
            {
                id: 'opponent-2',
                name: 'Carol Jones',
                isLocal: false,
                isConnected: true,
                cardCount: 11,
                validWordCount: 2,
                totalWordCount: 3,
            },
            {
                id: 'opponent-3',
                name: 'Dominique Verylongplayername',
                isLocal: false,
                isConnected: true,
                cardCount: 9,
                validWordCount: 1,
                totalWordCount: 3,
            },
        ],
    },
    parameters: {
        viewport: {
            defaultViewport: 'mobile1',
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)

        await expect(canvas.getAllByRole('article')).toHaveLength(4)
        await expect(canvas.getAllByRole('article').map((card) => card.getAttribute('aria-label')?.split(',')[0]))
            .toEqual(['Alice', 'Bob', 'Carol Jones', 'Dominique Verylongplayername'])
    },
}
