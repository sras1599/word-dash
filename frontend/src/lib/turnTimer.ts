const MIN_TURN_SECONDS = 60
const MAX_TURN_SECONDS = 300
const MAX_SECONDS_FIELD = 59

export type TurnDurationFields = {
    minutes: string
    seconds: string
}

export function clampTurnDurationSeconds(totalSeconds: number): number {
    return Math.min(MAX_TURN_SECONDS, Math.max(MIN_TURN_SECONDS, totalSeconds))
}

export function parseTurnDurationFields(minutes: string, seconds: string): number {
    const parsedMinutes = Math.min(5, Math.max(1, parseInt(minutes, 10) || 1))
    const parsedSeconds =
        parsedMinutes === 5 ? 0 : Math.min(MAX_SECONDS_FIELD, Math.max(0, parseInt(seconds, 10) || 0))

    return clampTurnDurationSeconds(parsedMinutes * 60 + parsedSeconds)
}

export function turnDurationMsToFields(turnDurationMs: number): TurnDurationFields {
    const totalSeconds = clampTurnDurationSeconds(Math.round(turnDurationMs / 1_000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = minutes === 5 ? 0 : totalSeconds % 60

    return {
        minutes: String(minutes),
        seconds: String(seconds),
    }
}

export function turnDurationFieldsToMs(minutes: string, seconds: string): number {
    return parseTurnDurationFields(minutes, seconds) * 1_000
}

export function stepTurnDurationMs(turnDurationMs: number, deltaSeconds: number): number {
    const currentSeconds = clampTurnDurationSeconds(Math.round(turnDurationMs / 1_000))
    return clampTurnDurationSeconds(currentSeconds + deltaSeconds) * 1_000
}

export function sanitizeNumericInput(input: string): string {
    return input.replace(/[^0-9]/g, '')
}

export function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${minutes}:${String(seconds).padStart(2, '0')}`
}
