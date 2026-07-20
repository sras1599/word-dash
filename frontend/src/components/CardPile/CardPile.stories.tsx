import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

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

/** Draw pile during the local player's draw phase — pulsing glow invites interaction. */
export const DrawPileActive: Story = {
    args: {
        type: 'draw',
        cardCount: 42,
        isActive: true,
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

/** Discard pile as a valid drop target during the arrange phase — subtle ring signals eligibility. */
export const DiscardPileDropTarget: Story = {
    args: {
        type: 'discard',
        topCard: SAMPLE_CARD,
        cardCount: 7,
        isDropTarget: true,
    },
}

/** Both piles side-by-side as they appear in the centre of the game board. */
export const BothPiles: Story = {
    args: {
        type: 'draw',
        cardCount: 42,
    },
    render: (args) => (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end' }}>
            <CardPile {...args} type="draw" cardCount={42} topCard={null} />
            <CardPile {...args} type="discard" cardCount={7} topCard={SAMPLE_CARD} />
        </div>
    ),
}

/** Both piles active — player can click either pile during their draw phase. */
export const BothPilesActive: Story = {
    args: {
        type: 'draw',
        cardCount: 42,
        isActive: true,
    },
    render: (args) => (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end' }}>
            <CardPile {...args} type="draw" cardCount={42} topCard={null} />
            <CardPile {...args} type="discard" cardCount={7} topCard={SAMPLE_CARD} />
        </div>
    ),
}
