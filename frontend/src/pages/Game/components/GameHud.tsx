import type { CSSProperties } from 'react'
import { Icon } from '../../../components/Icon/Icon'
import type { GameState } from '../../../lib/gameTypes'
import { cx } from '../../../lib/cx'
import { createGameHudModel } from './gameHudModel'
import './GameHud.css'

export type GameHudProps = {
    gameState: GameState
    localPlayerId: string
    timeRemainingMs: number
    turnDurationMs: number
    timerIsUrgent: boolean
}

export function GameHud({
    gameState,
    localPlayerId,
    timeRemainingMs,
    turnDurationMs,
    timerIsUrgent,
}: GameHudProps) {
    const model = createGameHudModel({
        gameState,
        localPlayerId,
        timeRemainingMs,
        turnDurationMs,
        timerIsUrgent,
    })

    if (!model.isVisible) return null

    return (
        <aside
            className={cx(
                'game-hud',
                model.isUrgent && 'game-hud--urgent',
            )}
            aria-label="Turn guidance"
        >
            <div className="game-hud__content">
                <div className="game-hud__copy" aria-hidden="true">
                    <strong className="game-hud__title">{model.primaryLabel}</strong>
                    <span className="game-hud__detail">{model.detail}</span>
                </div>

                <span className="game-hud__announcement" role="status" aria-live="polite" aria-atomic="true">
                    {model.announcement}
                </span>

                <div
                    className="game-hud__timer"
                    role="timer"
                    aria-label={model.timerAriaLabel}
                    data-active={model.isActive}
                >
                    <Icon name="timer" className="game-hud__timer-icon" />
                    <span>{model.timerLabel}</span>
                </div>
            </div>

            <span className="game-hud__progress" aria-hidden="true">
                <span style={{ '--game-hud-progress': model.progress } as CSSProperties} />
            </span>
        </aside>
    )
}
