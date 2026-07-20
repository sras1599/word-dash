import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Card } from './Card'

const SAMPLE_CARD = { id: 'card-d', letter: 'D' }

const meta = {
    title: 'WordDash/Game/Card',
    component: Card,
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
        card: { control: 'object' },
        faceDown: { control: 'boolean' },
        draggable: { control: 'boolean' },
        selected: { control: 'boolean' },
        isDrawn: { control: 'boolean' },
        willAutoDiscard: { control: 'boolean' },
        readOnly: { control: 'boolean' },
    },
    args: {
        card: SAMPLE_CARD,
        faceDown: false,
        draggable: false,
        selected: false,
        isDrawn: false,
        willAutoDiscard: false,
        readOnly: false,
        onClick: fn(),
        onDragStart: fn(),
        onDragEnd: fn(),
    },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

/** Standard face-up card showing a letter. */
export const FaceUp: Story = {
    args: {
        card: SAMPLE_CARD,
    },
}

/** Card back shown in the draw pile. */
export const FaceDown: Story = {
    args: {
        card: SAMPLE_CARD,
        faceDown: true,
    },
}

/** Card drawn this turn — teal border highlights it for the player. */
export const Drawn: Story = {
    args: {
        card: SAMPLE_CARD,
        isDrawn: true,
    },
}

/** Drawn card during the urgent timer window. */
export const WillAutoDiscard: Story = {
    args: {
        card: SAMPLE_CARD,
        isDrawn: true,
        willAutoDiscard: true,
    },
}

/** Selected card (e.g. chosen for discard) — lifts and shows a ring. */
export const Selected: Story = {
    args: {
        card: SAMPLE_CARD,
        selected: true,
    },
}

/** Drawn AND selected at the same time. */
export const DrawnAndSelected: Story = {
    args: {
        card: SAMPLE_CARD,
        isDrawn: true,
        selected: true,
    },
}

/** Draggable card — shows grab cursor on hover. */
export const Draggable: Story = {
    args: {
        card: SAMPLE_CARD,
        draggable: true,
    },
}

/** Read-only card used in the results screen — no interactions. */
export const ReadOnly: Story = {
    args: {
        card: SAMPLE_CARD,
        readOnly: true,
        onClick: undefined,
    },
}

/** Empty placeholder slot — null card, face-up context. */
export const EmptySlot: Story = {
    args: {
        card: null,
    },
}

/** A row of varied letters to check sizing and spacing. */
export const LetterSampler: Story = {
    args: {
        card: SAMPLE_CARD,
    },
    render: () => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {['A', 'E', 'I', 'M', 'Q', 'W', 'Z'].map((letter) => (
                <Card key={letter} card={{ id: `card-${letter}`, letter }} />
            ))}
        </div>
    ),
}

/** Side-by-side face-up and face-down to compare both states. */
export const FaceUpVsFaceDown: Story = {
    args: {
        card: SAMPLE_CARD,
    },
    render: () => (
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Card card={SAMPLE_CARD} />
            <Card card={SAMPLE_CARD} faceDown />
        </div>
    ),
}

/** Larger card — demonstrates `--card-width` CSS custom property scaling. */
export const Large: Story = {
    args: {
        card: { id: 'card-n', letter: 'N' },
    },
    render: (args) => (
        <div style={{ '--card-width': '140px' } as React.CSSProperties}>
            <Card {...args} />
        </div>
    ),
}

/** Small card — as it might appear in the opponent's hand. */
export const Small: Story = {
    args: {
        card: { id: 'card-n', letter: 'N' },
        faceDown: true,
    },
    render: (args) => (
        <div style={{ '--card-width': '48px' } as React.CSSProperties}>
            <Card {...args} />
        </div>
    ),
}
