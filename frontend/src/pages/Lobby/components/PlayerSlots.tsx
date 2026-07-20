import { Icon } from '../../../components/Icon/Icon'
import { Button, Panel } from '../../../components/ui'
import { cx } from '../../../lib/cx'
import type { LobbyPlayer } from '../../../lib/gameTypes'

const PLAYER_TONE_CLASSES = [
    'page-lobby__player-avatar--1',
    'page-lobby__player-avatar--2',
    'page-lobby__player-avatar--3',
    'page-lobby__player-avatar--4',
]

type PlayerSlotsProps = {
    players: LobbyPlayer[]
    hostPlayerId: string
    localPlayerId: string
    maxPlayers: number
    isLocalReady: boolean
    onReadyToggle: () => void
}

export function PlayerSlots({
    players,
    hostPlayerId,
    localPlayerId,
    maxPlayers,
    isLocalReady,
    onReadyToggle,
}: PlayerSlotsProps) {
    const playerSlots = Array.from({ length: maxPlayers }, (_, i) => players[i] ?? null)

    return (
        <section className="page-lobby__players-column" aria-labelledby="page-lobby-players-title">
            <Panel className="page-lobby__players-card">
                <div className="page-lobby__players-header">
                    <h2 className="page-lobby__players-title" id="page-lobby-players-title">
                        Players
                        <span className="page-lobby__players-count">
                            {players.length}/{maxPlayers}
                        </span>
                    </h2>
                </div>

                <div className="page-lobby__players-list">
                    {playerSlots.map((player, index) => (
                        <PlayerSlot
                            key={player?.id ?? `empty-${index}`}
                            player={player}
                            toneClass={PLAYER_TONE_CLASSES[index % PLAYER_TONE_CLASSES.length]}
                            isCurrentPlayer={player?.id === localPlayerId}
                            isHost={player?.id === hostPlayerId}
                            isLocalReady={isLocalReady}
                            onReadyToggle={onReadyToggle}
                        />
                    ))}
                </div>
            </Panel>
        </section>
    )
}

type PlayerSlotProps = {
    player: LobbyPlayer | null
    toneClass: string
    isCurrentPlayer: boolean
    isHost: boolean
    isLocalReady: boolean
    onReadyToggle: () => void
}

function PlayerSlot({ player, toneClass, isCurrentPlayer, isHost, isLocalReady, onReadyToggle }: PlayerSlotProps) {
    const isReadyPlayer = player?.isReady ?? false
    const statusText = player ? (!player.isConnected ? 'Disconnected' : player.isReady ? 'Ready' : 'Not Ready') : ''

    return (
        <article
            className={cx(
                'page-lobby__player-card',
                player === null && 'page-lobby__player-card--empty',
                player !== null && isReadyPlayer && 'page-lobby__player-card--ready',
                player !== null && isCurrentPlayer && 'page-lobby__player-card--current',
                player !== null && !player.isConnected && 'page-lobby__player-card--disconnected',
            )}
        >
            {player ? (
                <>
                    <div className="page-lobby__player-main">
                        <div className="page-lobby__player-avatar-wrap">
                            <span className={cx('page-lobby__player-avatar', toneClass, isCurrentPlayer && 'page-lobby__player-avatar--current')}>
                                <span className="page-lobby__player-avatar-letter">{player.name.charAt(0).toUpperCase()}</span>
                            </span>

                            <span
                                className={cx(
                                    'page-lobby__player-dot',
                                    !player.isConnected
                                        ? 'page-lobby__player-dot--disconnected'
                                        : player.isReady
                                          ? 'page-lobby__player-dot--ready'
                                          : 'page-lobby__player-dot--not-ready',
                                    isCurrentPlayer && 'page-lobby__player-dot--current',
                                )}
                                aria-hidden="true"
                            />
                        </div>

                        <div className="page-lobby__player-copy">
                            <div className="page-lobby__player-name-row">
                                <span className="page-lobby__player-name">{isCurrentPlayer ? 'You' : player.name}</span>
                                {isHost && <span className="page-lobby__player-badge">Host</span>}
                            </div>

                            <span
                                className={cx(
                                    'page-lobby__player-status',
                                    player.isConnected && player.isReady && 'page-lobby__player-status--ready',
                                    player.isConnected && !player.isReady && 'page-lobby__player-status--not-ready',
                                    !player.isConnected && 'page-lobby__player-status--disconnected',
                                )}
                            >
                                {statusText}
                            </span>
                        </div>
                    </div>

                    <div className="page-lobby__player-actions">
                        {isCurrentPlayer ? (
                            <Button
                                variant={isLocalReady ? 'primary' : 'secondary'}
                                className="page-lobby__ready-btn"
                                type="button"
                                onClick={onReadyToggle}
                            >
                                {isLocalReady ? 'Not Ready' : 'Ready'}
                            </Button>
                        ) : player.isReady ? (
                            <span className="page-lobby__player-check" aria-label="Ready">
                                <Icon name="check" className="page-lobby__player-check-icon" />
                            </span>
                        ) : null}
                    </div>
                </>
            ) : (
                <div className="page-lobby__player-empty">
                    <span className="page-lobby__player-empty-photo" aria-hidden="true">
                        <Icon name="person" className="page-lobby__player-empty-icon-svg" />
                    </span>
                    <span className="wd-sr-only">Open player slot</span>
                </div>
            )}
        </article>
    )
}
