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
            const hud = canvas.getByRole('complementary', { name: 'Turn guidance' })
            await expect(
                canvas.getByRole('timer', { name: 'Time remaining 1:00' }),
            ).toBeInTheDocument()
            await expect(hud).not.toHaveClass('game-hud--urgent')

            await userEvent.click(canvas.getByRole('button', { name: /draw pile/i }))
            await expect(canvas.getByRole('button', { name: 'Arrange phase' }))
                .toHaveAttribute('aria-pressed', 'true')

            await userEvent.keyboard('{Shift>}H{/Shift}')
            await userEvent.keyboard('{Shift>}D{/Shift}')
            await expect(canvas.getByText('Drawing...')).toBeInTheDocument()

            await userEvent.click(canvas.getByRole('button', { name: 'Advance turn' }))
            await expect(canvas.getAllByText('Draw a card').length).toBeGreaterThan(0)

            await userEvent.click(canvas.getByRole('button', { name: 'Waiting' }))
            await userEvent.click(canvas.getByRole('button', { name: 'Playing' }))
            await userEvent.click(canvas.getByRole('button', { name: 'Enter urgency' }))
            await expect(
                await canvas.findByRole('timer', { name: 'Time remaining 0:09' }),
            ).toBeInTheDocument()
            await expect(hud).toHaveClass('game-hud--urgent')
            await userEvent.click(canvas.getByRole('button', { name: 'Leave urgency' }))
            await expect(
                await canvas.findByRole('timer', { name: 'Time remaining 1:00' }),
            ).toBeInTheDocument()
            await expect(hud).not.toHaveClass('game-hud--urgent')
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

            await userEvent.click(canvas.getByRole('button', { name: /draw pile/i }))
            await userEvent.click(canvas.getByRole('button', { name: 'Expire timer' }))
            await expect(
                await canvas.findByRole('timer', { name: 'Time remaining 0:00' }),
            ).toBeInTheDocument()
            await expect(
                canvas.getByRole('complementary', { name: 'Turn guidance' }),
            ).toHaveClass('game-hud--urgent')
            await expect(
                await canvas.findByText('expireTurn(): automatic discard'),
            ).toBeInTheDocument()
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

export const MobileHudLayout: Story = {
    parameters: {
        viewport: {
            defaultViewport: 'mobile1',
        },
    },
    args: {
        playerCount: 2,
        showEventLog: false,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        const hud = canvas.getByRole('complementary', { name: 'Turn guidance' })
        const shortcuts = canvas.getByRole('button', { name: 'Open keyboard shortcuts' })
        const hudRect = hud.getBoundingClientRect()
        const shortcutsRect = shortcuts.getBoundingClientRect()
        const overlaps = !(
            hudRect.right <= shortcutsRect.left
            || hudRect.left >= shortcutsRect.right
            || hudRect.bottom <= shortcutsRect.top
            || hudRect.top >= shortcutsRect.bottom
        )

        await expect(overlaps).toBe(false)
        await expect(canvas.getByText('Draw', { selector: '.game-hud__compact-title' }))
            .toBeVisible()
        await expect(canvas.getByRole('timer')).toBeVisible()
    },
}
