import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { GameSimulationHarness } from './GameSimulationHarness'

const meta = {
    title: 'Experiments/Game/Interactive Simulation',
    component: GameSimulationHarness,
    parameters: {
        layout: 'fullscreen',
    },
    args: {
        scenario: 'draw',
        showControls: true,
        showEventLog: true,
    },
} satisfies Meta<typeof GameSimulationHarness>

export default meta
type Story = StoryObj<typeof meta>

export const TwoPlayerSimulation: Story = {
    args: {
        playerCount: 2,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        const originalFetch = window.fetch
        const fetchSpy = fn()
        const OriginalWebSocket = window.WebSocket
        const websocketSpy = fn()

        window.fetch = fetchSpy
        window.WebSocket = class extends OriginalWebSocket {
            constructor(url: string | URL, protocols?: string | string[]) {
                websocketSpy(url, protocols)
                super(url, protocols)
            }
        }

        try {
            await userEvent.click(canvas.getByRole('button', { name: /draw pile/i }))
            await expect(canvas.getByRole('button', { name: 'Arrange phase' }))
                .toHaveAttribute('aria-pressed', 'true')

            await userEvent.keyboard('{Shift>}H{/Shift}')
            await userEvent.keyboard('{Shift>}D{/Shift}')
            await expect(canvas.getByText('Drawing...')).toBeInTheDocument()

            await userEvent.click(canvas.getByRole('button', { name: 'Advance turn' }))
            await expect(canvas.getByText('Draw a card')).toBeInTheDocument()

            await userEvent.click(canvas.getByRole('button', { name: 'Waiting' }))
            await userEvent.click(canvas.getByRole('button', { name: 'Playing' }))
            await userEvent.click(canvas.getByRole('button', { name: 'Enter urgency' }))
            await userEvent.click(canvas.getByRole('button', { name: 'Leave urgency' }))
            await userEvent.click(canvas.getByRole('button', { name: 'Disconnect opponent' }))
            await expect(canvas.getByText('Disconnected')).toBeInTheDocument()
            await userEvent.click(canvas.getByRole('button', { name: 'Reconnect opponent' }))
            await userEvent.click(canvas.getByRole('button', { name: 'Fill invalid word' }))
            await expect(canvasElement.querySelector('.word-row--invalid')).not.toBeNull()
            await userEvent.click(canvas.getByRole('button', { name: 'Fill valid word' }))
            await expect(canvasElement.querySelector('.word-row--valid')).not.toBeNull()
            await userEvent.click(canvas.getByRole('button', { name: 'Finish game' }))
            await expect(canvas.getAllByText('Winner')).toHaveLength(2)

            await expect(fetchSpy).not.toHaveBeenCalled()
            await expect(websocketSpy).not.toHaveBeenCalled()

            await userEvent.click(canvas.getByRole('button', { name: 'Reset simulation' }))
            await expect(canvas.getByText('No actions yet.')).toBeInTheDocument()
            await expect(canvas.getByRole('button', { name: /draw pile, 40 cards/i }))
                .toBeInTheDocument()
        } finally {
            window.fetch = originalFetch
            window.WebSocket = OriginalWebSocket
        }
    },
}

export const FourPlayerSimulation: Story = {
    args: {
        playerCount: 4,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)

        await expect(
            canvas.getByRole('region', { name: 'Player status' }).children,
        ).toHaveLength(4)
        await expect(canvas.getByRole('combobox', { name: 'Active player' }).children)
            .toHaveLength(4)
    },
}
