import { BrandLogo } from '../../../components/BrandLogo/BrandLogo'
import { Icon } from '../../../components/Icon/Icon'
import { cx } from '../../../lib/cx'
import { formatTime } from '../../../lib/turnTimer'

type GameTopBarProps = {
    timeRemainingMs: number
    timerIsUrgent: boolean
    onHome: () => void
}

export function GameTopBar({ timeRemainingMs, timerIsUrgent, onHome }: GameTopBarProps) {
    const timerLabel = formatTime(timeRemainingMs)

    return (
        <nav className="page-game__nav" aria-label="Game navigation">
            <div className="page-game__nav-start">
                <button className="page-game__nav-brand" type="button" onClick={onHome} aria-label="Return home">
                    <BrandLogo className="page-game__nav-logo" />
                </button>

                <div className="page-game__nav-divider" aria-hidden="true" />

                <div
                    className={cx('page-game__nav-timer', timerIsUrgent && 'page-game__nav-timer--urgent')}
                    role="timer"
                    aria-label={`Time remaining ${timerLabel}`}
                >
                    <Icon name="timer" className="page-game__nav-timer-icon" />
                    <span className="page-game__nav-timer-text">{timerLabel}</span>
                </div>
            </div>

            <div className="page-game__nav-end">
                <div className="page-game__nav-links" aria-hidden="true">
                    <span className="page-game__nav-link page-game__nav-link--active">Play</span>
                    <span className="page-game__nav-link">Leaderboard</span>
                    <span className="page-game__nav-link">Achievements</span>
                </div>

                <div className="page-game__nav-actions" aria-hidden="true">
                    <span className="page-game__nav-icon-btn">
                        <Icon name="help" className="page-game__nav-icon" />
                    </span>
                    <span className="page-game__nav-icon-btn">
                        <Icon name="settings" className="page-game__nav-icon" />
                    </span>
                </div>
            </div>
        </nav>
    )
}
