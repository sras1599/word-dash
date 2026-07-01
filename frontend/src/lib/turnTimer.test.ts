import { describe, expect, it } from 'vitest'
import {
    parseTurnDurationFields,
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
})
