import { describe, expect, it } from 'vitest'
import {
    parseTurnDurationFields,
    isTurnTimerUrgent,
    remainingFromAnchor,
    reconcileTurnTimerAnchor,
    stepTurnDurationMs,
    turnDurationFieldsToMs,
    turnDurationMsToFields,
} from './turnTimer'

describe('turn timer helpers', () => {
    it('clamps field parsing to supported turn duration bounds', () => {
        expect(parseTurnDurationFields('', '')).toBe(60)
        expect(parseTurnDurationFields('0', '10')).toBe(70)
        expect(parseTurnDurationFields('5', '45')).toBe(300)
    })

    it('converts between fields and milliseconds', () => {
        expect(turnDurationFieldsToMs('1', '30')).toBe(90_000)
        expect(turnDurationMsToFields(90_000)).toEqual({ minutes: '1', seconds: '30' })
    })

    it('steps duration while honoring min and max bounds', () => {
        expect(stepTurnDurationMs(60_000, -15)).toBe(60_000)
        expect(stepTurnDurationMs(90_000, 15)).toBe(105_000)
        expect(stepTurnDurationMs(300_000, 15)).toBe(300_000)
    })

    it('derives remaining time from the receipt anchor even after delayed repaints', () => {
        const anchor = { sequence: 3, serverNowMs: 10_000, remainingAtReceiptMs: 50_000, durationMs: 60_000, receivedAtMs: 1_000 }
        expect(remainingFromAnchor(anchor, 31_000)).toBe(20_000)
        expect(remainingFromAnchor(anchor, 61_000)).toBe(0)
    })

    it('ignores metadata from older turns and older messages in the same turn', () => {
        const current = { sequence: 3, serverNowMs: 20_000, remainingAtReceiptMs: 40_000, durationMs: 60_000, receivedAtMs: 1_000 }
        expect(reconcileTurnTimerAnchor(current, {
            serverNowMs: 30_000,
            turn: { sequence: 2, endsAtMs: 60_000, durationMs: 60_000 },
        }, 2_000)).toBe(current)
        expect(reconcileTurnTimerAnchor(current, {
            serverNowMs: 19_000,
            turn: { sequence: 3, endsAtMs: 60_000, durationMs: 60_000 },
        }, 2_000)).toBe(current)
    })

    it('starts urgency after eighty percent of any turn duration has elapsed', () => {
        expect(isTurnTimerUrgent(12_001, 60_000)).toBe(false)
        expect(isTurnTimerUrgent(12_000, 60_000)).toBe(true)
        expect(isTurnTimerUrgent(60_001, 300_000)).toBe(false)
        expect(isTurnTimerUrgent(60_000, 300_000)).toBe(true)
    })
})
