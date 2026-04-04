import './TurnIndicator.css'

export type TurnPhase = 'draw' | 'arrange' | 'idle'

export interface TurnIndicatorPlayer {
    id: string
    name: string
}

export interface TurnIndicatorProps {
    /** The player whose turn it currently is. */
    currentPlayer: TurnIndicatorPlayer
    /** Current phase of the turn. */
    phase: TurnPhase
    /** Whether currentPlayer is the local player. Drives distinct styling. */
    isLocalPlayer: boolean
}

const PHASE_LABELS: Record<TurnPhase, string> = {
    draw: 'Draw a card',
    arrange: 'Arranging…',
    idle: '',
}

export function TurnIndicator({ currentPlayer, phase, isLocalPlayer }: TurnIndicatorProps) {
    const phaseLabel = PHASE_LABELS[phase]
    const heading = isLocalPlayer ? 'Your turn!' : `${currentPlayer.name}'s turn`

    const className = [
        'turn-indicator',
        isLocalPlayer ? 'turn-indicator--local' : 'turn-indicator--opponent',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div
            className={className}
            role="status"
            aria-label={phaseLabel ? `${heading}: ${phaseLabel}` : heading}
            aria-live="polite"
        >
            <span className="turn-indicator__name">{heading}</span>
            {phaseLabel && (
                <span className="turn-indicator__phase">{phaseLabel}</span>
            )}
        </div>
    )
}
