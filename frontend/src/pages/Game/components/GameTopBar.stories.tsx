import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { GameTopBar } from './GameTopBar'
import '../Game.css'

const meta = {
    title: 'WordDash/Game/GameTopBar',
    component: GameTopBar,
    parameters: {
        layout: 'fullscreen',
    },
    args: {
        onHome: fn(),
    },
    render: (args) => (
        <div className="page-game">
            <GameTopBar {...args} />
        </div>
    ),
} satisfies Meta<typeof GameTopBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    play: async ({ args, canvasElement }) => {
        const canvas = within(canvasElement)

        await expect(canvas.queryByRole('timer')).not.toBeInTheDocument()
        await expect(getComputedStyle(canvas.getByRole('navigation')).position).toBe('relative')
        await userEvent.click(canvas.getByRole('button', { name: 'Return home' }))
        await expect(args.onHome).toHaveBeenCalledOnce()
    },
}
