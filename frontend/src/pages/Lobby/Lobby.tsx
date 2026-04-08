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
    turnDurationMs: number
    players: LobbyPlayer[]
}

const MAX_PLAYERS = 4

type VariationPresetGroup = {
    difficulty: string
    presets: { label: string; wordLengths: number[] }[]
}

const VARIATION_PRESET_GROUPS: VariationPresetGroup[] = [
    {
        difficulty: 'Easy',
        presets: [
            { label: '4, 4, 4', wordLengths: [4, 4, 4] },
            { label: '4, 5', wordLengths: [4, 5] },
        ],
    },
    {
        difficulty: 'Medium',
        presets: [
            { label: '3, 4, 5', wordLengths: [3, 4, 5] },
            { label: '5, 6', wordLengths: [5, 6] },
        ],
    },
    {
        difficulty: 'Hard',
        presets: [{ label: '5, 6, 7, 8', wordLengths: [5, 6, 7, 8] }],
    },
]

function parseCustomVariation(input: string): number[] | null {
    const parts = input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    if (parts.length < 2) return null
    const lengths = parts.map((p) => parseInt(p, 10))
    if (lengths.some((n) => isNaN(n) || n < 1)) return null
    return lengths
}

function getPresetDisplayLabel(wordLengths: number[]): string {
    const key = JSON.stringify(wordLengths)
    for (const group of VARIATION_PRESET_GROUPS) {
        for (const preset of group.presets) {
            if (JSON.stringify(preset.wordLengths) === key) {
                return `${preset.label} (${group.difficulty})`
            }
        }
    }
    return `${wordLengths.join(', ')} (Custom)`
}

export function Lobby() {
    const { roomCode } = useParams<{ roomCode: string }>()
    const navigate = useNavigate()

    const localPlayerId = session.getPlayerId() ?? ''

    const [lobby, setLobby] = useState<LobbyState | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [customInput, setCustomInput] = useState('')
    const [customVariationError, setCustomVariationError] = useState('')
    const [variationOpen, setVariationOpen] = useState(false)
    const [turnMinutes, setTurnMinutes] = useState('1')
    const [turnSeconds, setTurnSeconds] = useState('30')

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
            const state = payload as LobbyState
            setLobby(state)
            setTurnMinutes(String(Math.floor(state.turnDurationMs / 60_000)))
            setTurnSeconds(String(Math.round((state.turnDurationMs % 60_000) / 1_000)))
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
        ws.on('lobby:settings_changed', (payload) => {
            const { variation, turnDurationMs } = payload as { variation: Variation; turnDurationMs: number }
            setLobby((prev) => (prev ? { ...prev, variation, turnDurationMs } : prev))
            setTurnMinutes(String(Math.floor(turnDurationMs / 60_000)))
            setTurnSeconds(String(Math.round((turnDurationMs % 60_000) / 1_000)))
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

    function handlePresetClick(wordLengths: number[]) {
        const newVariation: Variation = { wordLengths }
        const m = Math.min(5, Math.max(1, parseInt(turnMinutes, 10) || 1))
        const s = m === 5 ? 0 : Math.min(59, Math.max(0, parseInt(turnSeconds, 10) || 0))
        wsRef.current?.send('lobby:settings_changed', { variation: newVariation, turnDurationMs: (m * 60 + s) * 1_000 })
        setLobby((prev) => (prev ? { ...prev, variation: newVariation } : prev))
        setCustomInput('')
        setCustomVariationError('')
        setVariationOpen(false)
    }

    function handleCustomInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setCustomInput(e.target.value.replace(/[^0-9,\s]/g, ''))
        setCustomVariationError('')
    }

    function handleCustomApply() {
        const wordLengths = parseCustomVariation(customInput)
        if (!wordLengths) {
            setCustomVariationError('Enter at least 2 comma-separated numbers, e.g. 4,7')
            return
        }
        const newVariation: Variation = { wordLengths }
        const m = Math.min(5, Math.max(1, parseInt(turnMinutes, 10) || 1))
        const s = m === 5 ? 0 : Math.min(59, Math.max(0, parseInt(turnSeconds, 10) || 0))
        wsRef.current?.send('lobby:settings_changed', { variation: newVariation, turnDurationMs: (m * 60 + s) * 1_000 })
        setLobby((prev) => (prev ? { ...prev, variation: newVariation } : prev))
        setCustomInput('')
        setCustomVariationError('')
        setVariationOpen(false)
    }

    function handleTurnMinutesChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTurnMinutes(e.target.value.replace(/[^0-9]/g, ''))
    }

    function handleTurnSecondsChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTurnSeconds(e.target.value.replace(/[^0-9]/g, ''))
    }

    function handleTurnLengthBlur() {
        const m = Math.min(5, Math.max(1, parseInt(turnMinutes, 10) || 1))
        const s = m === 5 ? 0 : Math.min(59, Math.max(0, parseInt(turnSeconds, 10) || 0))
        setTurnMinutes(String(m))
        setTurnSeconds(String(s))
        wsRef.current?.send('lobby:settings_changed', {
            variation: lobby!.variation,
            turnDurationMs: (m * 60 + s) * 1_000,
        })
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

                {/* ── Variation ── */}
                <div className="page-lobby__setting-row">
                    <span className="page-lobby__setting-label">Variation</span>
                    <div className="page-lobby__variation-picker">
                        <button
                            className="page-lobby__setting-trigger"
                            onClick={() => isHost && setVariationOpen((o) => !o)}
                            aria-expanded={variationOpen}
                            aria-haspopup="listbox"
                            disabled={!isHost}
                        >
                            <span>{getPresetDisplayLabel(lobby.variation.wordLengths)}</span>
                            <svg
                                className="page-lobby__setting-chevron"
                                aria-hidden="true"
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                {variationOpen ? (
                                    <path
                                        d="M10 8L6 4L2 8"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                ) : (
                                    <path
                                        d="M2 4L6 8L10 4"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )}
                            </svg>
                        </button>
                        {variationOpen && (
                            <div
                                className="page-lobby__variation-panel"
                                role="listbox"
                                aria-label="Variation presets"
                            >
                                {VARIATION_PRESET_GROUPS.map((group) => (
                                    <div
                                        key={group.difficulty}
                                        className="page-lobby__variation-group"
                                    >
                                        <span className="page-lobby__variation-group-label">
                                            {group.difficulty}
                                        </span>
                                        <div className="page-lobby__variation-options">
                                            {group.presets.map((preset) => {
                                                const isSelected =
                                                    JSON.stringify(preset.wordLengths) ===
                                                    JSON.stringify(lobby.variation.wordLengths)
                                                return (
                                                    <button
                                                        key={preset.label}
                                                        className={[
                                                            'page-lobby__variation-option',
                                                            isSelected &&
                                                            'page-lobby__variation-option--selected',
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' ')}
                                                        onClick={() =>
                                                            handlePresetClick(preset.wordLengths)
                                                        }
                                                        role="option"
                                                        aria-selected={isSelected}
                                                    >
                                                        {preset.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                                <div className="page-lobby__variation-group">
                                    <span className="page-lobby__variation-group-label">
                                        Custom
                                    </span>
                                    <div className="page-lobby__custom-variation-row">
                                        <input
                                            id="variation-custom"
                                            className="page-lobby__custom-input"
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="e.g. 4,7"
                                            maxLength={20}
                                            value={customInput}
                                            onChange={handleCustomInputChange}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleCustomApply()
                                            }}
                                            aria-label="Custom variation"
                                            aria-describedby={
                                                customVariationError
                                                    ? 'custom-variation-error'
                                                    : undefined
                                            }
                                        />
                                        <button
                                            className="page-lobby__custom-apply-btn"
                                            onClick={handleCustomApply}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                    {customVariationError && (
                                        <p
                                            id="custom-variation-error"
                                            className="page-lobby__custom-error"
                                            role="alert"
                                        >
                                            {customVariationError}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Turn Length ── */}
                <div className="page-lobby__setting-row">
                    <span className="page-lobby__setting-label">Turn Length</span>
                    <div className="page-lobby__turn-length">
                        <div className="page-lobby__turn-field">
                            <input
                                id="turn-minutes"
                                className="page-lobby__turn-input"
                                type="number"
                                min={1}
                                max={5}
                                value={turnMinutes}
                                onChange={handleTurnMinutesChange}
                                onBlur={handleTurnLengthBlur}
                                disabled={!isHost}
                                aria-label="Turn length minutes"
                            />
                            <label htmlFor="turn-minutes" className="page-lobby__turn-unit">
                                min
                            </label>
                        </div>
                        <div className="page-lobby__turn-field">
                            <input
                                id="turn-seconds"
                                className="page-lobby__turn-input"
                                type="number"
                                min={0}
                                max={59}
                                value={turnSeconds}
                                onChange={handleTurnSecondsChange}
                                onBlur={handleTurnLengthBlur}
                                disabled={!isHost}
                                aria-label="Turn length seconds"
                            />
                            <label htmlFor="turn-seconds" className="page-lobby__turn-unit">
                                sec
                            </label>
                        </div>
                    </div>
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
