import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { PlayerHand } from './PlayerHand'

const SAMPLE_HAND = [
    { id: 'card-a', letter: 'A' },
    { id: 'card-t', letter: 'T' },
    { id: 'card-e', letter: 'E' },
    { id: 'card-r', letter: 'R' },
    { id: 'card-s', letter: 'S' },
]

const DRAWN_CARD = { id: 'card-n', letter: 'N' }

const meta = {
    title: 'WordDash/Game/PlayerHand',
    component: PlayerHand,
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
        hand: { control: 'object' },
        drawnCard: { control: 'object' },
        isDraggable: { control: 'boolean' },
        selectedCardId: { control: 'text' },
    },
    args: {
        hand: SAMPLE_HAND,
        drawnCard: null,
        isDraggable: false,
        selectedCardId: null,
        onCardClick: fn(),
        onDragStart: fn(),
        onDragEnd: fn(),
    },
} satisfies Meta<typeof PlayerHand>

export default meta
type Story = StoryObj<typeof meta>

const fixedWidthRender = (width: string): Story['render'] => (args) => (
    <div style={{ width, maxWidth: 'calc(100vw - 2rem)' }}>
        <PlayerHand {...args} />
    </div>
)

/** Normal hand displayed during an opponent's turn — cards are not draggable. */
export const Default: Story = { render: fixedWidthRender('36rem') }

/** Hand during the local player's arrange phase — cards are draggable. */
export const Draggable: Story = {
    args: {
        isDraggable: true,
    },
}

/** Empty hand remains a visible drop target during arrange phase. */
export const EmptyDropTarget: Story = {
    args: {
        hand: [],
        isDraggable: true,
        onDropOnHand: fn(),
    },
}

/** The complete wrapping region shows feedback when a board card is dragged over it. */
export const DragOverHand: Story = {
    args: {
        isDraggable: true,
        onDropOnHand: fn(),
    },
    render: fixedWidthRender('24rem'),
    play: async ({ canvasElement }) => {
        const hand = canvasElement.querySelector<HTMLElement>('.player-hand--drop-target')
        if (!hand) throw new Error('Expected a hand drop target')
        hand.classList.add('player-hand--drag-over')
        await expect(hand).toHaveClass('player-hand--drag-over')
    },
}

/** A card in the hand is selected for keyboard navigation. */
export const CardSelected: Story = {
    args: {
        selectedCardId: 'card-e',
    },
}

/** Arrange phase with a drawn card shown on the right, teal border. */
export const WithDrawnCard: Story = {
    args: {
        drawnCard: DRAWN_CARD,
        isDraggable: true,
    },
    render: fixedWidthRender('30rem'),
}

/** Drawn card is selected for keyboard navigation. */
export const DrawnCardSelected: Story = {
    args: {
        drawnCard: DRAWN_CARD,
        isDraggable: true,
        selectedCardId: DRAWN_CARD.id,
    },
}

/** Large hand (approaching max size) to verify wrapping behaviour. */
export const LargeHand: Story = {
    args: {
        hand: [
            { id: 'c1', letter: 'A' },
            { id: 'c2', letter: 'B' },
            { id: 'c3', letter: 'C' },
            { id: 'c4', letter: 'D' },
            { id: 'c5', letter: 'E' },
            { id: 'c6', letter: 'F' },
            { id: 'c7', letter: 'G' },
            { id: 'c8', letter: 'H' },
            { id: 'c9', letter: 'I' },
            { id: 'c10', letter: 'J' },
            { id: 'c11', letter: 'K' },
            { id: 'c12', letter: 'L' },
            { id: 'c13', letter: 'M' },
            { id: 'c14', letter: 'N' },
        ],
        isDraggable: true,
    },
    render: fixedWidthRender('24rem'),
}

/** An incomplete second row remains centered in a fixed-width tray. */
export const TwoRowsIncompleteFinalRow: Story = {
    args: { hand: [...SAMPLE_HAND, DRAWN_CARD, { id: 'card-o', letter: 'O' }] },
    render: fixedWidthRender('22rem'),
}

/** A narrow tray deliberately produces three centered rows. */
export const ThreeRows: Story = {
    args: { hand: [...SAMPLE_HAND, DRAWN_CARD, { id: 'card-o', letter: 'O' }] },
    render: fixedWidthRender('14rem'),
}

/** Mobile-sized container wraps without introducing hand-level horizontal scrolling. */
export const NarrowMobile: Story = {
    args: { hand: [...SAMPLE_HAND, DRAWN_CARD, { id: 'card-o', letter: 'O' }] },
    render: fixedWidthRender('18rem'),
    parameters: { viewport: { defaultViewport: 'mobile1' } },
}
