import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CSSProperties } from 'react'
import { expect, fn } from 'storybook/test'

import { CardPile } from './CardPile'

const SAMPLE_CARD = { id: 'card-t', letter: 'T' }

const meta = {
    title: 'WordDash/Game/CardPile',
    component: CardPile,
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
    decorators: [
        (Story) => (
            <div style={{ '--pile-width': '6.25rem' } as CSSProperties}>
                <Story />
            </div>
        ),
    ],
    argTypes: {
        type: { control: 'radio', options: ['draw', 'discard'] },
        topCard: { control: 'object' },
        cardCount: { control: 'number' },
        isActive: { control: 'boolean' },
        isDropTarget: { control: 'boolean' },
    },
    args: {
        type: 'draw',
        topCard: SAMPLE_CARD,
        cardCount: 42,
        isActive: false,
        isDropTarget: false,
        onDraw: fn(),
        onDiscard: fn(),
    },
} satisfies Meta<typeof CardPile>

export default meta
type Story = StoryObj<typeof meta>

/** Standard draw pile with a face-down stack and a card count badge. */
export const DrawPile: Story = {
    args: {
        type: 'draw',
        cardCount: 42,
    },
}

/** Draw pile during the local player's draw phase — elevation and pointer feedback invite interaction. */
export const DrawPileActive: Story = {
    args: {
        type: 'draw',
        cardCount: 42,
        isActive: true,
    },
    play: async ({ canvasElement, userEvent }) => {
        const pile = canvasElement.querySelector<HTMLElement>('.card-pile--interactive')
        if (!pile) throw new Error('Expected an interactive pile')
        await userEvent.tab()
        await expect(pile).toHaveFocus()
    },
}

/** Draw pile with a single card remaining — badge reads "1 card". */
export const DrawPileSingleCard: Story = {
    args: {
        type: 'draw',
        cardCount: 1,
    },
}

/** Draw pile exhausted — shows the empty placeholder slot. */
export const DrawPileEmpty: Story = {
    args: {
        type: 'draw',
        cardCount: 0,
        topCard: null,
    },
}

/** Discard pile showing the top card face-up. */
export const DiscardPile: Story = {
    args: {
        type: 'discard',
        topCard: SAMPLE_CARD,
        cardCount: 7,
    },
}

/** Discard pile during the local player's draw phase — clickable to draw from discard. */
export const DiscardPileActive: Story = {
    args: {
        type: 'discard',
        topCard: SAMPLE_CARD,
        cardCount: 7,
        isActive: true,
    },
}

/** Discard pile at game start — no cards have been discarded yet, shows empty placeholder. */
export const DiscardPileEmpty: Story = {
    args: {
        type: 'discard',
        topCard: null,
        cardCount: 0,
    },
}

/** Discard pile as a valid drop target during the arrange phase — a warm surface tint signals eligibility. */
export const DiscardPileDropTarget: Story = {
    args: {
        type: 'discard',
        topCard: SAMPLE_CARD,
        cardCount: 7,
        isDropTarget: true,
    },
}

/** Drag-over feedback uses primary tint and elevation without a green border. */
export const DiscardPileDragOver: Story = {
    args: {
        type: 'discard',
        topCard: SAMPLE_CARD,
        cardCount: 7,
        isDropTarget: true,
    },
    play: async ({ canvasElement }) => {
        const pile = canvasElement.querySelector<HTMLElement>('.card-pile--drop-target')
        if (!pile) throw new Error('Expected a discard drop target')
        pile.classList.add('card-pile--drag-over')
        await expect(pile).toHaveClass('card-pile--drag-over')
    },
}

/** Both piles stacked vertically as they appear beside the desktop workspace. */
export const DesktopVerticalPiles: Story = {
    args: {
        type: 'draw',
        cardCount: 42,
    },
    render: (args) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <CardPile {...args} type="draw" cardCount={42} topCard={null} />
            <CardPile {...args} type="discard" cardCount={7} topCard={SAMPLE_CARD} />
        </div>
    ),
}

/** Both piles side by side as they appear below the narrow workspace. */
export const NarrowHorizontalPiles: Story = {
    args: {
        type: 'draw',
        cardCount: 42,
        isActive: true,
    },
    render: (args) => (
        <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-end' }}>
            <CardPile {...args} type="draw" cardCount={42} topCard={null} />
            <CardPile {...args} type="discard" cardCount={7} topCard={SAMPLE_CARD} />
        </div>
    ),
}
