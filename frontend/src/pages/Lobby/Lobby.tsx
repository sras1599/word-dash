import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createWsClient, WsClient } from '../../lib/ws'
import { session } from '../../lib/session'
import './Lobby.css'

type Variation = {
    wordLengths: number[]
}

type LobbyPlayer = {
    id: string
    name: string
    isReady: boolean
    isConnected: boolean
}

type LobbyState = {
    roomCode: string
    hostPlayerId: string
    variation: Variation
    players: LobbyPlayer[]
}

const MAX_PLAYERS = 4
const MIN_VARIATION_LENGTHS = 2
const MAX_VARIATION_LENGTHS = 4

export function Lobby() {
    const { roomCode } = useParams<{ roomCode: string }>()
    const navigate = useNavigate()

    const localPlayerId = session.getPlayerId() ?? ''

    const [lobby, setLobby] = useState<LobbyState | null>(null)
    const [isReady, setIsReady] = useState(false)

    const wsRef = useRef<WsClient | null>(null)

    const isHost = lobby !== null && lobby.hostPlayerId === localPlayerId
    const canStart =
        lobby !== null &&
        lobby.players.length >= 2 &&
        lobby.players.every((p) => p.isReady)

    useEffect(() => {
        if (!roomCode || !localPlayerId) return

        const ws = createWsClient(roomCode, localPlayerId)
        wsRef.current = ws

        ws.send('lobby:join')

        ws.on('lobby:state', (payload) => {
            setLobby(payload as LobbyState)
        })
        ws.on('lobby:player_joined', (payload) => {
            const { player } = payload as { player: LobbyPlayer }
            setLobby((prev) =>
                prev ? { ...prev, players: [...prev.players, player] } : prev,
            )
        })
        ws.on('lobby:player_ready', (payload) => {
            const { playerId } = payload as { playerId: string }
            setLobby((prev) =>
                prev
                    ? {
                        ...prev,
                        players: prev.players.map((p) =>
                            p.id === playerId ? { ...p, isReady: true } : p,
                        ),
                    }
                    : prev,
            )
        })
        ws.on('lobby:variation_changed', (payload) => {
            const { variation } = payload as { variation: Variation }
            setLobby((prev) => (prev ? { ...prev, variation } : prev))
        })
        ws.on('lobby:game_starting', (payload) => {
            const { roomCode: rc } = payload as { roomCode: string }
            navigate(`/game/${rc}`)
        })

        return () => {
            ws.close()
        }
    }, [roomCode, localPlayerId, navigate])

    function handleReady() {
        wsRef.current?.send('lobby:player_ready')
        setIsReady(true)
    }

    function handleStart() {
        wsRef.current?.send('lobby:start_game')
    }

    function handleAddLength() {
        if (!lobby || lobby.variation.wordLengths.length >= MAX_VARIATION_LENGTHS) return
        const next = (lobby.variation.wordLengths.at(-1) ?? 3) + 1
        const newVariation: Variation = { wordLengths: [...lobby.variation.wordLengths, next] }
        wsRef.current?.send('lobby:variation_changed', { variation: newVariation })
        setLobby({ ...lobby, variation: newVariation })
    }

    function handleRemoveLength() {
        if (!lobby || lobby.variation.wordLengths.length <= MIN_VARIATION_LENGTHS) return
        const newVariation: Variation = {
            wordLengths: lobby.variation.wordLengths.slice(0, -1),
        }
        wsRef.current?.send('lobby:variation_changed', { variation: newVariation })
        setLobby({ ...lobby, variation: newVariation })
    }

    function handleCopyLink() {
        void navigator.clipboard.writeText(`${window.location.origin}/lobby/${roomCode}`)
    }

    const playerSlots = Array.from(
        { length: MAX_PLAYERS },
        (_, i) => lobby?.players[i] ?? null,
    )

    if (!lobby) {
        return (
            <main className="page-lobby page-lobby--loading">
                <p className="page-lobby__loading-text">Connecting…</p>
            </main>
        )
    }

    return (
        <main className="page-lobby">
            <header className="page-lobby__header">
                <h1 className="page-lobby__logo">WordIt!</h1>
                <div className="page-lobby__room">
                    <span className="page-lobby__room-label">
                        Room: <strong>{roomCode}</strong>
                    </span>
                    <button
                        className="page-lobby__copy-btn"
                        onClick={handleCopyLink}
                        aria-label="Copy join link"
                    >
                        Copy link 🔗
                    </button>
                </div>
            </header>

            <section className="page-lobby__settings" aria-label="Game settings">
                <h2 className="page-lobby__section-title">Game Settings</h2>
                <div className="page-lobby__variation">
                    <span className="page-lobby__variation-label">Variation:</span>
                    <div className="page-lobby__variation-lengths" role="list">
                        {lobby.variation.wordLengths.map((len, i) => (
                            <span
                                key={i}
                                className="page-lobby__variation-chip"
                                role="listitem"
                            >
                                {len}
                            </span>
                        ))}
                    </div>
                    {isHost && (
                        <div className="page-lobby__variation-controls">
                            <button
                                className="page-lobby__variation-btn"
                                onClick={handleAddLength}
                                disabled={
                                    lobby.variation.wordLengths.length >= MAX_VARIATION_LENGTHS
                                }
                                aria-label="Add word length"
                            >
                                +
                            </button>
                            <button
                                className="page-lobby__variation-btn"
                                onClick={handleRemoveLength}
                                disabled={
                                    lobby.variation.wordLengths.length <= MIN_VARIATION_LENGTHS
                                }
                                aria-label="Remove word length"
                            >
                                −
                            </button>
                        </div>
                    )}
                </div>
            </section>

            <section className="page-lobby__players" aria-label="Players">
                <h2 className="page-lobby__section-title">
                    Players ({lobby.players.length}/{MAX_PLAYERS})
                </h2>
                <div className="page-lobby__player-grid">
                    {playerSlots.map((player, i) => (
                        <div
                            key={i}
                            className={[
                                'page-lobby__player-card',
                                player === null && 'page-lobby__player-card--empty',
                                player &&
                                !player.isConnected &&
                                'page-lobby__player-card--disconnected',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                        >
                            {player ? (
                                <>
                                    <span
                                        className="page-lobby__player-avatar"
                                        aria-hidden="true"
                                    >
                                        👤
                                    </span>
                                    <span className="page-lobby__player-name">
                                        {player.name}
                                        {player.id === lobby.hostPlayerId && (
                                            <span className="page-lobby__player-host">
                                                {' '}
                                                (Host)
                                            </span>
                                        )}
                                    </span>
                                    {!player.isConnected && (
                                        <span className="page-lobby__player-status page-lobby__player-status--disconnected">
                                            Disconnected
                                        </span>
                                    )}
                                    {player.isReady && (
                                        <span
                                            className="page-lobby__player-ready"
                                            aria-label="Ready"
                                        >
                                            ✓
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="page-lobby__player-waiting">Waiting…</span>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            <div className="page-lobby__actions">
                <button
                    className="page-lobby__ready-btn"
                    onClick={handleReady}
                    disabled={isReady}
                >
                    {isReady ? 'Ready ✓' : 'Ready'}
                </button>
                {isHost && (
                    <button
                        className="page-lobby__start-btn"
                        onClick={handleStart}
                        disabled={!canStart}
                    >
                        Start →
                    </button>
                )}
            </div>
        </main>
    )
}
