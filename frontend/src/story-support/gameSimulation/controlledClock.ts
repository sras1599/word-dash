export type ControlledClockSnapshot = {
    durationMs: number
    remainingMs: number
    isRunning: boolean
}

type ClockListener = () => void

export class ControlledClock {
    private snapshot: ControlledClockSnapshot
    private readonly listeners = new Set<ClockListener>()
    private readonly onExpire: () => void
    private readonly now: () => number
    private timer: ReturnType<typeof setInterval> | null = null
    private previousTimeMs = 0

    constructor(
        durationMs: number,
        onExpire: () => void,
        now: () => number = Date.now,
    ) {
        this.onExpire = onExpire
        this.now = now
        this.snapshot = { durationMs, remainingMs: durationMs, isRunning: false }
    }

    getSnapshot = (): ControlledClockSnapshot => this.snapshot

    subscribe = (listener: ClockListener): (() => void) => {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    play = () => {
        if (this.snapshot.isRunning || this.snapshot.remainingMs <= 0) return
        this.previousTimeMs = this.now()
        this.update({ ...this.snapshot, isRunning: true })
        this.timer = setInterval(this.tickFromWallClock, 100)
    }

    pause = () => {
        if (!this.snapshot.isRunning) return
        this.stopTimer()
        this.update({ ...this.snapshot, isRunning: false })
    }

    advance = (milliseconds: number) => {
        if (milliseconds <= 0 || this.snapshot.remainingMs <= 0) return
        this.setRemaining(this.snapshot.remainingMs - milliseconds)
    }

    setRemaining = (milliseconds: number) => {
        const remainingMs = Math.max(0, Math.min(this.snapshot.durationMs, milliseconds))
        const expired = remainingMs === 0 && this.snapshot.remainingMs > 0
        if (remainingMs === 0) this.stopTimer()
        this.update({
            ...this.snapshot,
            remainingMs,
            isRunning: remainingMs === 0 ? false : this.snapshot.isRunning,
        })
        if (expired) this.onExpire()
    }

    reset = (durationMs = this.snapshot.durationMs) => {
        this.stopTimer()
        this.update({ durationMs, remainingMs: durationMs, isRunning: false })
    }

    expire = () => this.setRemaining(0)

    dispose = () => {
        this.stopTimer()
        this.listeners.clear()
    }

    private tickFromWallClock = () => {
        const currentTimeMs = this.now()
        const elapsedMs = Math.max(0, currentTimeMs - this.previousTimeMs)
        this.previousTimeMs = currentTimeMs
        this.advance(elapsedMs)
    }

    private stopTimer() {
        if (this.timer !== null) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    private update(snapshot: ControlledClockSnapshot) {
        this.snapshot = snapshot
        this.listeners.forEach((listener) => listener())
    }
}
