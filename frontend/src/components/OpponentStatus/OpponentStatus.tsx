import './OpponentStatus.css'

export interface OpponentStatusPlayer {
    id: string
    name: string
    isConnected: boolean
    handCount: number
    wordBoard: {
        rows: { isComplete: boolean }[]
    }
}

export interface OpponentStatusVariation {
    wordLengths: number[]
}

export interface OpponentStatusProps {
    /** The opponent player to display. */
    player: OpponentStatusPlayer
    /** Used to compute total words required (denominator of progress). */
    variation: OpponentStatusVariation
    /** Whether it is currently this player's turn. */
    isActiveTurn: boolean
    /** Whether this player is in the arrange phase (just drew a card). */
    isArranging?: boolean
}

export function OpponentStatus({
    player,
    variation,
    isActiveTurn,
    isArranging = false,
}: OpponentStatusProps) {
    const totalWords = variation.wordLengths.length
    const wordsComplete = player.wordBoard.rows.filter((r) => r.isComplete).length
    const progressPct = totalWords > 0 ? (wordsComplete / totalWords) * 100 : 0
    const handCount = player.handCount

    const className = [
        'opponent-status',
        isActiveTurn && 'opponent-status--active',
        !player.isConnected && 'opponent-status--disconnected',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div
            className={className}
            aria-label={`${player.name}'s status${!player.isConnected ? ', disconnected' : ''}`}
        >
            <div className="opponent-status__header">
                <span className="opponent-status__avatar" aria-hidden="true">
                    👤
                </span>
                <span className="opponent-status__name">{player.name}</span>
                {isActiveTurn && (
                    <span className="opponent-status__turn-badge" aria-hidden="true">
                        ← Active turn
                    </span>
                )}
                {!player.isConnected && (
                    <span className="opponent-status__disconnected-badge">disconnected</span>
                )}
            </div>

            <div className="opponent-status__hand">
                Cards in hand: {handCount}
                {isArranging && (
                    <span className="opponent-status__drawn-note"> (+1 drawn)</span>
                )}
            </div>

            <div className="opponent-status__words">
                Words complete: {wordsComplete} / {totalWords}
            </div>

            <div
                className="opponent-status__progress-track"
                role="progressbar"
                aria-valuenow={wordsComplete}
                aria-valuemin={0}
                aria-valuemax={totalWords}
                aria-label={`${wordsComplete} of ${totalWords} words complete`}
            >
                <div
                    className="opponent-status__progress-fill"
                    style={{ width: `${progressPct}%` }}
                />
            </div>
        </div>
    )
}
