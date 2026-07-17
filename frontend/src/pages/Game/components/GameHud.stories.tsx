import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import {
    createScenarioState,
    DEFAULT_TURN_DURATION_MS,
    LOCAL_PLAYER_ID,
    setGamePhase,
} from '../../../story-support/gameSimulation/simulation'
import { GameHud } from './GameHud'
import '../Game.css'
import './GameHud.stories.css'

const drawState = createScenarioState('draw').gameState

const meta = {
    title: 'WordIt/Components/GameHud',
    component: GameHud,
    parameters: {
        layout: 'fullscreen',
    },
    args: {
        gameState: drawState,
        localPlayerId: LOCAL_PLAYER_ID,
        timeRemainingMs: DEFAULT_TURN_DURATION_MS,
        turnDurationMs: DEFAULT_TURN_DURATION_MS,
        timerIsUrgent: false,
    },
    render: (args) => (
        <main className="page-game game-hud-story">
            <div className="game-hud-story__board-placeholder" aria-hidden="true" />
            <GameHud {...args} />
        </main>
    ),
} satisfies Meta<typeof GameHud>

export default meta
type Story = StoryObj<typeof meta>

export const Draw: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await expect(canvas.getAllByRole('timer')).toHaveLength(1)
        await expect(canvas.getAllByRole('status')).toHaveLength(1)
        await expect(canvas.getByText('Draw a card')).toBeInTheDocument()

        window.scrollTo({ top: document.documentElement.scrollHeight })
        await waitFor(() => {
            const rect = canvas.getByRole('timer').getBoundingClientRect()
            expect(rect.bottom).toBeGreaterThan(0)
            expect(rect.top).toBeLessThan(window.innerHeight)
        })
        window.scrollTo({ top: 0 })
    },
}

export const Arrange: Story = {
    args: {
        gameState: createScenarioState('arrange-draw').gameState,
    },
}

export const Urgent: Story = {
    args: {
        gameState: createScenarioState('urgent').gameState,
        timeRemainingMs: 7_000,
        timerIsUrgent: true,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await expect(canvas.getByText('Discard now', { selector: '.game-hud__title' }))
            .toBeInTheDocument()
        await expect(canvas.getByRole('timer', { name: 'Time remaining 0:07' }))
            .toBeInTheDocument()
        await expect(canvas.getByRole('complementary', { name: 'Turn guidance' }))
            .toHaveClass('game-hud--urgent')
    },
}

export const OpponentWithLongName: Story = {
    args: {
        gameState: createScenarioState('opponent', { longContent: true }).gameState,
    },
}

export const Waiting: Story = {
    args: {
        gameState: setGamePhase(createScenarioState('draw'), 'waiting').gameState,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await expect(canvas.getByText('Preparing the board')).toBeInTheDocument()
        await expect(canvas.getByRole('timer', { name: 'Turn timer inactive' }))
            .toHaveTextContent('—')
    },
}

export const MobileCollapsed: Story = {
    parameters: {
        viewport: {
            defaultViewport: 'mobile1',
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await expect(canvas.getByText('Draw', { selector: '.game-hud__compact-title' }))
            .toBeVisible()
        await expect(canvas.getByRole('timer')).toBeVisible()
        await expect(canvas.getByRole('button', { name: 'Expand turn guidance' }))
            .toHaveAttribute('aria-expanded', 'false')
    },
}

export const MobileExpanded: Story = {
    parameters: {
        viewport: {
            defaultViewport: 'mobile1',
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        const toggle = canvas.getByRole('button', { name: 'Expand turn guidance' })

        toggle.focus()
        await expect(toggle).toHaveFocus()
        await userEvent.keyboard('{Enter}')

        await expect(canvas.getByRole('button', { name: 'Collapse turn guidance' }))
            .toHaveAttribute('aria-expanded', 'true')
        await expect(canvas.getByText('Choose the deck or discard pile.')).toBeVisible()
    },
}

export const Finished: Story = {
    args: {
        gameState: createScenarioState('finished').gameState,
    },
    play: async ({ canvasElement }) => {
        await expect(
            within(canvasElement).queryByRole('complementary', { name: 'Turn guidance' }),
        ).not.toBeInTheDocument()
    },
}
