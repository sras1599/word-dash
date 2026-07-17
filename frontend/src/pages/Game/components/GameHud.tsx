import { useId, useState, type CSSProperties } from 'react'
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
    const detailsId = useId()
    const [isExpanded, setIsExpanded] = useState(false)
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
                isExpanded && 'game-hud--expanded',
                model.isUrgent && 'game-hud--urgent',
            )}
            aria-label="Turn guidance"
        >
            <button
                className="game-hud__toggle"
                type="button"
                aria-label={isExpanded ? 'Collapse turn guidance' : 'Expand turn guidance'}
                aria-controls={detailsId}
                aria-expanded={isExpanded}
                onClick={() => setIsExpanded((expanded) => !expanded)}
            >
                <span aria-hidden="true">{isExpanded ? '›' : '‹'}</span>
            </button>

            <div className="game-hud__content" id={detailsId}>
                <strong className="game-hud__compact-title" aria-hidden="true">
                    {model.compactTitle}
                </strong>

                <div
                    className="game-hud__copy"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <span className="game-hud__owner">{model.ownerLabel}</span>
                    <strong className="game-hud__title">{model.title}</strong>
                    <span className="game-hud__detail">{model.detail}</span>
                </div>

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
