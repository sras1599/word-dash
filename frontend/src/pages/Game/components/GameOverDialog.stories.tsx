import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import '../Game.css'
import { GameOverDialog } from './GameOverDialog'
import type { GamePlayer, WordBoardState } from '../../../lib/gameTypes'

function completeWord(word: string, rowIndex: number) {
    return {
        targetLength: word.length,
        slots: word.split('').map((letter, slotIndex) => ({
            slotIndex,
            card: { id: `winner-${rowIndex}-${slotIndex}`, letter },
        })),
        isComplete: true,
    }
}

function completeBoard(words: string[]): WordBoardState {
    return {
        rows: words.map((word, index) => completeWord(word, index)),
        allComplete: true,
    }
}

function makeWinner(words: string[], name = 'Raspreet'): GamePlayer {
    return {
        id: 'winner',
        name,
        isReady: true,
        isConnected: true,
        handCount: 0,
        hand: [],
        wordBoard: completeBoard(words),
    }
}

const meta = {
    title: 'WordIt/Game/GameOverDialog',
    component: GameOverDialog,
    parameters: {
        layout: 'fullscreen',
        backgrounds: {
            default: 'game',
            values: [{ name: 'game', value: '#b8b3b2' }],
        },
    },
    tags: ['autodocs'],
    args: {
        winner: makeWinner(['ROGER', 'HOURLY']),
        isHost: false,
        onPlayAgain: fn(),
        onHome: fn(),
    },
    render: (args) => (
        <div className="page-game">
            <GameOverDialog {...args} />
        </div>
    ),
} satisfies Meta<typeof GameOverDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Variation56: Story = {}

export const HardPreset: Story = {
    args: {
        winner: makeWinner(['MATCH', 'PUZZLE', 'LETTERS', 'WORDDASH']),
        isHost: true,
    },
}

export const MobileVariation56: Story = {
    args: {
        winner: makeWinner(['ROGER', 'HOURLY']),
    },
    parameters: {
        viewport: {
            defaultViewport: 'mobile1',
        },
    },
}
