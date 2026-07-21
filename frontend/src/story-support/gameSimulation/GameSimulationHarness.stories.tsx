import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { GameSimulationHarness } from './GameSimulationHarness'

const meta = {
    title: 'WordDash/Game/Interactive Simulation',
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

export const ProductionDrawLayout: Story = {
    args: {
        playerCount: 4,
        showControls: false,
        showEventLog: false,
    },
    play: async ({ canvasElement }) => {
        const hud = canvasElement.querySelector<HTMLElement>('.game-hud')
        const workspace = canvasElement.querySelector<HTMLElement>('.game-board__board-section')
        if (!hud || !workspace) throw new Error('Expected command HUD and word workspace')

        const hudRect = hud.getBoundingClientRect()
        const workspaceRect = workspace.getBoundingClientRect()
        const hudCenter = hudRect.left + hudRect.width / 2
        const workspaceCenter = workspaceRect.left + workspaceRect.width / 2
        await expect(Math.abs(hudCenter - workspaceCenter)).toBeLessThan(2)
    },
}

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
            const initialHudRect = hud.getBoundingClientRect()
            const announcement = canvasElement.querySelector<HTMLElement>('.game-hud__announcement')
            if (!announcement) throw new Error('Expected HUD announcement region')
            const announcementText = announcement.textContent
            await expect(
                canvas.getByRole('timer', { name: 'Time remaining 1:00' }),
            ).toBeInTheDocument()
            await expect(hud).not.toHaveClass('game-hud--urgent')

            await userEvent.click(canvas.getByRole('button', { name: 'Advance 5s' }))
            await expect(announcement).toHaveTextContent(announcementText ?? '')
            await expect(hud.getBoundingClientRect().width).toBe(initialHudRect.width)
            await expect(hud.getBoundingClientRect().height).toBe(initialHudRect.height)

            await userEvent.click(canvas.getByRole('button', { name: /draw pile/i }))
            await expect(canvas.getByRole('button', { name: 'Arrange phase' }))
                .toHaveAttribute('aria-pressed', 'true')

            await userEvent.keyboard('{Shift>}H{/Shift}')
            await userEvent.keyboard('{Shift>}D{/Shift}')
            await expect(canvas.getByText('Drawing…')).toBeInTheDocument()

            await userEvent.click(canvas.getByRole('button', { name: 'Advance turn' }))
            await expect(canvas.getByText('Your turn · Draw a card', { selector: '.game-hud__title' })).toBeVisible()

            await userEvent.click(canvas.getByRole('button', { name: 'Waiting' }))
            await userEvent.click(canvas.getByRole('button', { name: 'Playing' }))
            await userEvent.click(canvas.getByRole('button', { name: 'Enter urgency' }))
            await expect(
                await canvas.findByRole('timer', { name: 'Time remaining 0:09' }),
            ).toBeInTheDocument()
            await expect(hud).toHaveClass('game-hud--urgent')
            await expect(hud.getBoundingClientRect().width).toBe(initialHudRect.width)
            await expect(hud.getBoundingClientRect().height).toBe(initialHudRect.height)
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

export const SlowNetworkReconciliation: Story = {
    args: {
        scenario: 'slow-network',
        showControls: false,
        showEventLog: true,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await expect(canvas.getByLabelText('Slot 1, contains letter A')).toBeVisible()
        await expect(canvas.getByLabelText('Slot 2, contains letter O')).toBeVisible()
        await expect(canvas.getByLabelText('Slot 3, contains letter I')).toBeVisible()
        await expect(
            canvas.getByText('delayed board_updated(revision 1, ack simulation-1)'),
        ).toBeVisible()
    },
}

export const PointerOnlyTurn: Story = {
    args: {
        playerCount: 2,
        showControls: false,
        showEventLog: false,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)

        await userEvent.click(canvas.getByRole('button', { name: /draw pile, 40 cards/i }))

        const firstHandCard = canvasElement.querySelector<HTMLElement>('.player-hand .card[role="button"]')
        if (!firstHandCard) throw new Error('Expected a selectable hand card')

        await userEvent.click(firstHandCard)
        await userEvent.click(canvas.getByRole('button', { name: /discard pile.*discard selected card/i }))
        await expect(canvas.getByText("Bob's turn", { selector: '.game-hud__title' })).toBeVisible()
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
        showControls: false,
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
        await expect(canvas.getByText('Your turn · Draw a card', { selector: '.game-hud__title' }))
            .toBeVisible()
        await expect(canvas.getByRole('timer')).toBeVisible()
        await expect(canvasElement.ownerDocument.documentElement.scrollWidth)
            .toBe(canvasElement.ownerDocument.documentElement.clientWidth)
    },
}

export const ResponsiveStress: Story = {
    args: {
        scenario: 'stress',
        playerCount: 4,
        wordLengths: [8, 9, 10],
        longContent: true,
        discardPileEmpty: true,
        drawPileCount: 2,
        nearlyComplete: true,
        overflowingHand: true,
        showControls: false,
        showEventLog: false,
    },
    parameters: {
        viewport: { defaultViewport: 'tablet' },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        const board = canvasElement.querySelector<HTMLElement>('.game-board')
        const hand = canvasElement.querySelector<HTMLElement>('.player-hand__cards')

        if (!board || !hand) throw new Error('Expected production game layout')

        await expect(canvas.getByRole('region', { name: 'Player status' }).children).toHaveLength(4)
        await expect(canvas.getByRole('region', { name: 'Card piles' })).toBeVisible()
        await expect(canvas.getByLabelText('Discard pile, empty')).toBeVisible()
        await expect(canvas.getByLabelText('Draw pile, 1 card')).toBeVisible()
        await expect(board.querySelector('[data-emphasis]')).toBeNull()
        await expect(getComputedStyle(hand).overflowX).toBe('visible')
        await expect(getComputedStyle(hand).flexWrap).toBe('wrap')
        await expect(canvasElement.ownerDocument.documentElement.scrollWidth)
            .toBe(canvasElement.ownerDocument.documentElement.clientWidth)
    },
}
