import type { CSSProperties } from 'react'

import { WordRow } from '../../../components/WordRow/WordRow'
import type { GamePlayer } from '../../../lib/gameTypes'

type GameOverDialogProps = {
    winner: GamePlayer
    isHost: boolean
    onPlayAgain: () => void
    onHome: () => void
}

function getWinningRowStyle(slotCount: number): CSSProperties {
    const safeSlotCount = Math.max(slotCount, 1)
    const cardWidthRem = 3.8
    const gapRem = 0.55
    const rowPaddingRem = 0.4
    const maxWidthRem = safeSlotCount * cardWidthRem + (safeSlotCount - 1) * gapRem + rowPaddingRem

    return {
        '--word-row-slot-count': safeSlotCount,
        '--word-row-max-width': `${maxWidthRem}rem`,
    } as CSSProperties
}

export function GameOverDialog({ winner, isHost, onPlayAgain, onHome }: GameOverDialogProps) {
    return (
        <div className="page-game__overlay" role="dialog" aria-modal="true" aria-label="Game over">
            <div className="page-game__overlay-card">
                <p className="page-game__overlay-eyebrow">Match Complete</p>
                <h2 className="page-game__overlay-heading">{winner.name} wins!</h2>
                <section className="page-game__overlay-words" aria-label="Winning words">
                    {winner.wordBoard.rows.map((row, index) => (
                        <div
                            className="page-game__overlay-word-row"
                            key={index}
                            style={getWinningRowStyle(row.slots.length)}
                        >
                            <WordRow rowState={row} rowIndex={index} presentation="compact-result" />
                        </div>
                    ))}
                </section>
                <div className="page-game__overlay-actions">
                    {isHost && (
                        <button className="page-game__overlay-btn page-game__overlay-btn--primary" onClick={onPlayAgain}>
                            Play Again
                        </button>
                    )}
                    <button className="page-game__overlay-btn page-game__overlay-btn--secondary" onClick={onHome}>
                        Home
                    </button>
                </div>
            </div>
        </div>
    )
}
