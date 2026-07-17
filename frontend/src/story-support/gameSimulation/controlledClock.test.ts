import { afterEach, describe, expect, it, vi } from 'vitest'
import { ControlledClock } from './controlledClock'

describe('ControlledClock', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('only follows wall-clock time after play and stops while paused', () => {
        vi.useFakeTimers()
        const onExpire = vi.fn()
        const clock = new ControlledClock(10_000, onExpire)

        vi.advanceTimersByTime(2_000)
        expect(clock.getSnapshot().remainingMs).toBe(10_000)

        clock.play()
        vi.advanceTimersByTime(2_000)
        expect(clock.getSnapshot().remainingMs).toBe(8_000)

        clock.pause()
        vi.advanceTimersByTime(2_000)
        expect(clock.getSnapshot().remainingMs).toBe(8_000)
        expect(onExpire).not.toHaveBeenCalled()
        clock.dispose()
    })

    it('supports urgency, manual advance, expiry, and deterministic reset', () => {
        const onExpire = vi.fn()
        const clock = new ControlledClock(60_000, onExpire)

        clock.setRemaining(9_000)
        expect(clock.getSnapshot().remainingMs).toBe(9_000)

        clock.advance(4_000)
        expect(clock.getSnapshot().remainingMs).toBe(5_000)

        clock.expire()
        expect(clock.getSnapshot()).toEqual({
            durationMs: 60_000,
            remainingMs: 0,
            isRunning: false,
        })
        expect(onExpire).toHaveBeenCalledOnce()

        clock.reset()
        expect(clock.getSnapshot()).toEqual({
            durationMs: 60_000,
            remainingMs: 60_000,
            isRunning: false,
        })
    })

    it('expires once when a playing clock reaches zero', () => {
        vi.useFakeTimers()
        const onExpire = vi.fn()
        const clock = new ControlledClock(1_000, onExpire)

        clock.play()
        vi.advanceTimersByTime(2_000)

        expect(clock.getSnapshot().remainingMs).toBe(0)
        expect(clock.getSnapshot().isRunning).toBe(false)
        expect(onExpire).toHaveBeenCalledOnce()
        clock.dispose()
    })
})
