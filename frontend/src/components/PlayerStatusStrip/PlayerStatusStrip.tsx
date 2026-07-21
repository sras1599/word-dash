import './PlayerStatusStrip.css'
import type { GamePhase, TurnPhase } from '../../lib/gameTypes'
import { cx } from '../../lib/cx'
import { Icon } from '../Icon/Icon'

export interface PlayerStatusStripPlayer {
    id: string
    name: string
    isLocal: boolean
    isConnected: boolean
    cardCount: number
    validWordCount: number
    totalWordCount: number
}

export interface PlayerStatusStripProps {
    /** Players to display, in presentation order. */
    players: PlayerStatusStripPlayer[]
    /** Current game phase. */
    phase: GamePhase
    /** ID of the player whose turn is active. */
    currentPlayerId: string
    /** Current turn phase. */
    turnPhase: TurnPhase
    /** Winning player ID, if the round is finished. */
    winnerId: string | null
}

interface PlayerStatusCardProps {
    player: PlayerStatusStripPlayer
    phase: GamePhase
    currentPlayerId: string
    turnPhase: TurnPhase
    winnerId: string | null
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)

    if (parts.length === 0) {
        return '?'
    }

    return parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
}

function getPlayerStatus(
    player: PlayerStatusStripPlayer,
    phase: GamePhase,
    currentPlayerId: string,
    turnPhase: TurnPhase,
    winnerId: string | null,
): string {
    if (!player.isConnected) {
        return 'Disconnected'
    }

    if (phase === 'finished') {
        return player.id === winnerId ? 'Winner' : player.isLocal ? 'You' : 'Opponent'
    }

    if (phase === 'waiting') {
        return 'Waiting'
    }

    if (player.id === currentPlayerId) {
        return turnPhase === 'draw' ? 'Drawing…' : 'Building…'
    }

    return player.isLocal ? 'You' : 'Opponent'
}

function PlayerStatusCard({
    player,
    phase,
    currentPlayerId,
    turnPhase,
    winnerId,
}: PlayerStatusCardProps) {
    const isCurrent = player.id === currentPlayerId
    const status = getPlayerStatus(player, phase, currentPlayerId, turnPhase, winnerId)
    const accessibleName = [
        player.isLocal ? `${player.name}, you` : player.name,
        isCurrent ? 'active player' : null,
        status,
        `${player.validWordCount} of ${player.totalWordCount} valid words`,
    ].filter(Boolean).join(', ')

    return (
        <article
            className={cx(
                'player-status-strip__card',
                player.isLocal && 'player-status-strip__card--local',
                isCurrent && 'player-status-strip__card--active',
                !player.isConnected && 'player-status-strip__card--disconnected',
            )}
            aria-label={accessibleName}
            aria-current={isCurrent ? 'true' : undefined}
        >
            <div
                className={cx(
                    'player-status-strip__avatar',
                    player.isLocal && 'player-status-strip__avatar--local',
                )}
                aria-hidden="true"
            >
                {getInitials(player.name)}
            </div>

            <div className="player-status-strip__copy">
                <p className="player-status-strip__name">
                    <span className="player-status-strip__name-text">{player.name}</span>
                    {player.isLocal && <span className="player-status-strip__local-tag">You</span>}
                </p>
                <p
                    className={cx(
                        'player-status-strip__role',
                        isCurrent && 'player-status-strip__role--active',
                        !player.isConnected && 'player-status-strip__role--disconnected',
                    )}
                >
                    {status}
                </p>
            </div>

            <div className="player-status-strip__stats">
                <div
                    className="player-status-strip__stat"
                    aria-label={`${player.validWordCount} of ${player.totalWordCount} valid words`}
                    title="Valid words"
                >
                    <span className="player-status-strip__stat-icon" aria-hidden="true">
                        <Icon name="check" />
                    </span>
                    <span className="player-status-strip__stat-value">
                        {player.validWordCount}<span aria-hidden="true">/</span>{player.totalWordCount}
                    </span>
                </div>
            </div>
        </article>
    )
}

export function PlayerStatusStrip({
    players,
    phase,
    currentPlayerId,
    turnPhase,
    winnerId,
}: PlayerStatusStripProps) {
    return (
        <section className="player-status-strip" aria-label="Player status">
            {players.map((player) => (
                <PlayerStatusCard
                    key={player.id}
                    player={player}
                    phase={phase}
                    currentPlayerId={currentPlayerId}
                    turnPhase={turnPhase}
                    winnerId={winnerId}
                />
            ))}
        </section>
    )
}
