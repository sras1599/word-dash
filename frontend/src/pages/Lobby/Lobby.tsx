import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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

    // TODO: replace with proper session/auth layer
    const localPlayerId = sessionStorage.getItem('playerId') ?? ''

    const [lobby, setLobby] = useState<LobbyState | null>(null)
    const [isReady, setIsReady] = useState(false)

    const wsRef = useRef<WebSocket | null>(null)

    const isHost = lobby !== null && lobby.hostPlayerId === localPlayerId
    const canStart =
        lobby !== null &&
        lobby.players.length >= 2 &&
        lobby.players.every((p) => p.isReady)

    useEffect(() => {
        if (!roomCode) return

        const ws = new WebSocket(
            `ws://${window.location.hostname}:3000/ws?roomCode=${encodeURIComponent(roomCode)}&playerId=${encodeURIComponent(localPlayerId)}`,
        )
        wsRef.current = ws

        ws.onmessage = (event: MessageEvent<string>) => {
            const msg = JSON.parse(event.data) as { type: string; payload: unknown }
            switch (msg.type) {
                case 'lobby:state':
                    setLobby(msg.payload as LobbyState)
                    break
                case 'lobby:player_joined': {
                    const { player } = msg.payload as { player: LobbyPlayer }
                    setLobby((prev) =>
                        prev ? { ...prev, players: [...prev.players, player] } : prev,
                    )
                    break
                }
                case 'lobby:player_ready': {
                    const { playerId } = msg.payload as { playerId: string }
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
                    break
                }
                case 'lobby:variation_changed': {
                    const { variation } = msg.payload as { variation: Variation }
                    setLobby((prev) => (prev ? { ...prev, variation } : prev))
                    break
                }
                case 'lobby:game_starting': {
                    const { roomCode: rc } = msg.payload as { roomCode: string }
                    navigate(`/game/${rc}`)
                    break
                }
            }
        }

        return () => {
            ws.close()
        }
    }, [roomCode, localPlayerId, navigate])

    function send(type: string, payload?: unknown) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, payload }))
        }
    }

    function handleReady() {
        send('lobby:player_ready')
        setIsReady(true)
    }

    function handleStart() {
        send('lobby:start_game')
    }

    function handleAddLength() {
        if (!lobby || lobby.variation.wordLengths.length >= MAX_VARIATION_LENGTHS) return
        const next = (lobby.variation.wordLengths.at(-1) ?? 3) + 1
        const newVariation: Variation = { wordLengths: [...lobby.variation.wordLengths, next] }
        send('lobby:variation_changed', { variation: newVariation })
        setLobby({ ...lobby, variation: newVariation })
    }

    function handleRemoveLength() {
        if (!lobby || lobby.variation.wordLengths.length <= MIN_VARIATION_LENGTHS) return
        const newVariation: Variation = {
            wordLengths: lobby.variation.wordLengths.slice(0, -1),
        }
        send('lobby:variation_changed', { variation: newVariation })
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
