import { describe, expect, it } from 'vitest'
import { getGameBoardEmphasis } from './emphasis'

describe('getGameBoardEmphasis', () => {
    it.each([
        ['local draw', { phase: 'playing', turnPhase: 'draw', isLocalTurn: true, timerIsUrgent: false }, 'piles'],
        ['local arrange', { phase: 'playing', turnPhase: 'arrange', isLocalTurn: true, timerIsUrgent: false }, 'workspace'],
        ['urgent arrange', { phase: 'playing', turnPhase: 'arrange', isLocalTurn: true, timerIsUrgent: true }, 'piles'],
        ['opponent turn', { phase: 'playing', turnPhase: 'draw', isLocalTurn: false, timerIsUrgent: false }, 'players'],
    ] as const)('maps %s to one primary board region', (_name, options, primaryRegion) => {
        const emphasis = getGameBoardEmphasis(options)
        expect(Object.entries(emphasis).filter(([, level]) => level === 'primary').map(([region]) => region))
            .toEqual([primaryRegion])
    })

    it('keeps local arrangement available during an opponent turn', () => {
        expect(getGameBoardEmphasis({
            phase: 'playing',
            turnPhase: 'arrange',
            isLocalTurn: false,
            timerIsUrgent: false,
        })).toMatchObject({ workspace: 'available', hand: 'available', piles: 'unavailable' })
    })

    it('quietens action regions while waiting and after finish', () => {
        expect(getGameBoardEmphasis({
            phase: 'waiting',
            turnPhase: 'idle',
            isLocalTurn: false,
            timerIsUrgent: false,
        })).toMatchObject({ workspace: 'unavailable', piles: 'unavailable', hand: 'unavailable' })

        expect(getGameBoardEmphasis({
            phase: 'finished',
            turnPhase: 'idle',
            isLocalTurn: false,
            timerIsUrgent: false,
        })).toMatchObject({ workspace: 'informational', piles: 'unavailable', hand: 'informational' })
    })
})
