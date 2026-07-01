import { WordRow } from '../../../components/WordRow/WordRow'
import type { GamePlayer } from '../../../lib/gameTypes'

type GameOverDialogProps = {
    winner: GamePlayer
    isHost: boolean
    onPlayAgain: () => void
    onHome: () => void
}

export function GameOverDialog({ winner, isHost, onPlayAgain, onHome }: GameOverDialogProps) {
    return (
        <div className="page-game__overlay" role="dialog" aria-modal="true" aria-label="Game over">
            <div className="page-game__overlay-card">
                <p className="page-game__overlay-eyebrow">Match Complete</p>
                <h2 className="page-game__overlay-heading">{winner.name} wins!</h2>
                <section className="page-game__overlay-words" aria-label="Winning words">
                    {winner.wordBoard.rows.map((row, index) => (
                        <WordRow key={index} rowState={row} rowIndex={index} />
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
