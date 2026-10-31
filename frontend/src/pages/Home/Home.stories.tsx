import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, waitFor } from 'storybook/test'
import { Home } from './Home'

const meta = {
    title: 'WordDash/Pages/Home',
    component: Home,
    parameters: {
        layout: 'fullscreen',
    },
    decorators: [
        (Story) => (
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<Story />} />
                    {/* Catch navigations that Home triggers so stories don't crash */}
                    <Route path="/lobby/:roomCode" element={<div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>→ Lobby</div>} />
                </Routes>
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof Home>

export default meta
type Story = StoryObj<typeof meta>

/** Default landing state — no panel open. */
export const Default: Story = {
    play: async ({ canvas }) => {
        await expect(canvas.getByText(
            'Test your speed and vocabulary at the same time by building words as quickly as possible!',
        )).toBeInTheDocument()
    },
}

export const Mobile: Story = {
    parameters: {
        viewport: { defaultViewport: 'mobile1' },
    },
    play: async ({ canvas, userEvent }) => {
        expect(window.innerWidth).toBeLessThanOrEqual(640)
        const createButton = canvas.getByRole('button', { name: /create game/i })
        const joinButton = canvas.getByRole('button', { name: /join game/i })
        const expectLevel = async (button: HTMLElement) => {
            await waitFor(() => {
                const matrix = new DOMMatrixReadOnly(getComputedStyle(button).transform)
                expect(matrix.b).toBeCloseTo(0, 5)
                expect(matrix.c).toBeCloseTo(0, 5)
            })
        }

        for (const button of [createButton, joinButton]) {
            await expectLevel(button)
            await userEvent.hover(button)
            await expectLevel(button)
            await userEvent.pointer({ target: button, keys: '[MouseLeft>]' })
            await expectLevel(button)
            await userEvent.pointer({ target: button, keys: '[/MouseLeft]' })
            await userEvent.unhover(button)
        }

        const createRect = createButton.getBoundingClientRect()
        const joinRect = joinButton.getBoundingClientRect()
        expect(joinRect.top - createRect.bottom).toBeGreaterThanOrEqual(15)
        expect(createRect.left).toBeCloseTo(joinRect.left, 0)
        expect(createRect.width).toBeCloseTo(joinRect.width, 0)
    },
}

/** "Create Game" panel expanded. */
export const CreatePanelOpen: Story = {
    play: async ({ canvas, userEvent }) => {
        const btn = canvas.getByRole('button', { name: /create game/i })
        await userEvent.click(btn)
    },
}

/** "Join Game" panel expanded. */
export const JoinPanelOpen: Story = {
    play: async ({ canvas, userEvent }) => {
        const btn = canvas.getByRole('button', { name: /join game/i })
        await userEvent.click(btn)
    },
}

/** Create panel — validation fires when submitting with an empty name. */
export const CreateValidationError: Story = {
    play: async ({ canvas, userEvent }) => {
        await userEvent.click(canvas.getByRole('button', { name: /create game/i }))
        await userEvent.click(canvas.getByRole('button', { name: /create →/i }))
    },
}

/** Join panel — validation fires when both fields are empty. */
export const JoinValidationError: Story = {
    play: async ({ canvas, userEvent }) => {
        await userEvent.click(canvas.getByRole('button', { name: /join game/i }))
        await userEvent.click(canvas.getByRole('button', { name: /join →/i }))
    },
}
