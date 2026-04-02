import './TurnTimer.css'

const URGENCY_THRESHOLD_MS = 15_000

function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export interface TurnTimerProps {
    /** Milliseconds remaining in the current turn. */
    timeRemainingMs: number
    /** Total turn duration in ms. Used to calculate the progress bar width. Default: 60000. */
    totalDurationMs?: number
    /** Whether the timer is actively ticking. When false the component renders in an idle/hidden state. */
    isActive: boolean
}

export function TurnTimer({
    timeRemainingMs,
    totalDurationMs = 60_000,
    isActive,
}: TurnTimerProps) {
    if (!isActive) {
        return <div className="turn-timer turn-timer--idle" aria-hidden="true" />
    }

    const isExpired = timeRemainingMs <= 0
    const isUrgent = !isExpired && timeRemainingMs <= URGENCY_THRESHOLD_MS
    const progressPct = Math.max(0, Math.min(1, timeRemainingMs / totalDurationMs)) * 100

    const timerClass = [
        'turn-timer',
        isUrgent ? 'turn-timer--urgent' : '',
        isExpired ? 'turn-timer--expired' : '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div
            className={timerClass}
            role="timer"
            aria-label={`Time remaining: ${formatTime(timeRemainingMs)}`}
            aria-live="off"
        >
            <span className="turn-timer__display">{formatTime(timeRemainingMs)}</span>
            <div className="turn-timer__bar-track" aria-hidden="true">
                <div
                    className="turn-timer__bar-fill"
                    style={{ width: `${progressPct}%` }}
                />
            </div>
        </div>
    )
}
