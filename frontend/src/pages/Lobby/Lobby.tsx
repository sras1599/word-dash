import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, validateRoom } from '../../lib/api'
import { createWsClient, WsClient } from '../../lib/ws'
import { session } from '../../lib/session'
import wordDashLogo from '../../assets/word-dash-logo.svg'
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

type LobbyPageStatus = 'connecting' | 'ready' | 'room-not-found' | 'connection-error'

const MAX_PLAYERS = 4

type VariationPresetGroup = {
    difficulty: string
    presets: { label: string; wordLengths: number[] }[]
}

type VariationTab = VariationPresetGroup['difficulty'] | 'Custom'

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

const VARIATION_TABS: VariationTab[] = ['Easy', 'Medium', 'Hard', 'Custom']

const FLOATING_LETTERS = [
    { key: 'w', letter: 'W', className: 'page-lobby__floating-letter--w' },
    { key: 'd', letter: 'D', className: 'page-lobby__floating-letter--d' },
    { key: 'a', letter: 'A', className: 'page-lobby__floating-letter--a' },
    { key: 's', letter: 'S', className: 'page-lobby__floating-letter--s' },
    { key: 'h', letter: 'H', className: 'page-lobby__floating-letter--h' },
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

function getVariationDifficulty(wordLengths: number[]): VariationTab {
    const key = JSON.stringify(wordLengths)
    for (const group of VARIATION_PRESET_GROUPS) {
        for (const preset of group.presets) {
            if (JSON.stringify(preset.wordLengths) === key) {
                return group.difficulty
            }
        }
    }
    return 'Custom'
}

function getPlayerToneClass(index: number): string {
    const tones = [
        'page-lobby__player-avatar--1',
        'page-lobby__player-avatar--2',
        'page-lobby__player-avatar--3',
        'page-lobby__player-avatar--4',
    ]

    return tones[index % tones.length]
}

function LobbyIcon({
    name,
    className,
}: {
    name:
    | 'tune'
    | 'timer'
    | 'minus'
    | 'plus'
    | 'check'
    | 'door'
    | 'group'
    | 'bag'
    | 'person'
    className?: string
}) {
    switch (name) {
        case 'tune':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <path
                        d="M4 6h10m3 0h3M8 12H4m8 0h8M4 18h3m4 0h9M14 4v4m-6 2v4m3 2v4"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        case 'timer':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <path
                        d="M9 2h6M12 8v5m0 0l3 2M6.5 4.5l1.4 1.4m8.2-1.4l-1.4 1.4M12 21a7 7 0 1 0 0-14a7 7 0 0 0 0 14Z"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        case 'minus':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <path d="M6 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
            )
        case 'plus':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <path
                        d="M12 6v12M6 12h12"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                    />
                </svg>
            )
        case 'check':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <path
                        d="M6 12.5l4 4l8-9"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        case 'door':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <path
                        d="M8 4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5v16.25H8zM16 12h3M8 20.75h11"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle cx="12.5" cy="12" r="0.9" fill="currentColor" />
                </svg>
            )
        case 'group':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <path
                        d="M8.5 12.25a3.25 3.25 0 1 0 0-6.5a3.25 3.25 0 0 0 0 6.5Zm7 0a2.75 2.75 0 1 0 0-5.5a2.75 2.75 0 0 0 0 5.5ZM3.75 18.5a4.75 4.75 0 0 1 9.5 0m1.5 0a4 4 0 0 1 6.25-3.31"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        case 'bag':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <path
                        d="M6.5 8.25h11l-.82 10.13A1.75 1.75 0 0 1 14.94 20H9.06a1.75 1.75 0 0 1-1.74-1.62zm2.75 0a2.75 2.75 0 0 1 5.5 0M9.5 8.25v-1m5 1v-1"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        case 'person':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <path
                        d="M12 11.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7Zm-6 8a6 6 0 0 1 12 0"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )
    }
}

export function Lobby() {
    const { roomCode } = useParams<{ roomCode: string }>()
    const navigate = useNavigate()

    const localPlayerId = session.getPlayerId() ?? ''

    const [lobby, setLobby] = useState<LobbyState | null>(null)
    const [pageStatus, setPageStatus] = useState<LobbyPageStatus>('connecting')
    const [customInput, setCustomInput] = useState('')
    const [customVariationError, setCustomVariationError] = useState('')
    const [variationOpen, setVariationOpen] = useState(false)
    const [turnMinutes, setTurnMinutes] = useState('1')
    const [turnSeconds, setTurnSeconds] = useState('30')
    const [activeVariationTab, setActiveVariationTab] = useState<VariationTab>('Medium')

    const wsRef = useRef<WsClient | null>(null)

    const isHost = lobby !== null && lobby.hostPlayerId === localPlayerId
    const canStart =
        lobby !== null &&
        lobby.players.length >= 2 &&
        lobby.players.every((p) => p.isReady)

    useEffect(() => {
        if (!roomCode || !localPlayerId) return

        let cancelled = false
        let ws: WsClient | null = null

        void Promise.resolve()
            .then(() => {
                if (cancelled) return
                setPageStatus('connecting')
                setLobby(null)
                return validateRoom(roomCode)
            })
            .then(() => {
                if (cancelled) return

                ws = createWsClient(roomCode, localPlayerId)
                wsRef.current = ws

                ws.on('lobby:state', (payload) => {
                    const state = payload as LobbyState
                    setLobby(state)
                    setPageStatus('ready')
                    setActiveVariationTab(getVariationDifficulty(state.variation.wordLengths))
                    setTurnMinutes(String(Math.floor(state.turnDurationMs / 60_000)))
                    setTurnSeconds(String(Math.round((state.turnDurationMs % 60_000) / 1_000)))
                })
                ws.on('lobby:player_joined', handlePlayerJoined)
                ws.on('lobby:player_ready', handlePlayerReady)
                ws.on('lobby:player_unready', handlePlayerUnready)
                ws.on('lobby:player_disconnected', handlePlayerDisconnected)
                ws.on('lobby:settings_changed', handleSettingsChanged)
                ws.on('lobby:game_starting', handleGameStarting)
            })
            .catch((error: unknown) => {
                if (cancelled) return
                setPageStatus(error instanceof ApiError && error.status === 404 ? 'room-not-found' : 'connection-error')
            })

        function handlePlayerJoined(payload: unknown) {
            const { player } = payload as { player: LobbyPlayer }
            setLobby((prev) =>
                prev
                    ? {
                        ...prev,
                        players: prev.players.some((existing) => existing.id === player.id)
                            ? prev.players.map((existing) =>
                                existing.id === player.id ? player : existing,
                            )
                            : [...prev.players, player],
                    }
                    : prev,
            )
        }

        function handlePlayerReady(payload: unknown) {
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
        }

        function handlePlayerUnready(payload: unknown) {
            const { playerId } = payload as { playerId: string }
            setLobby((prev) =>
                prev
                    ? {
                        ...prev,
                        players: prev.players.map((p) =>
                            p.id === playerId ? { ...p, isReady: false } : p,
                        ),
                    }
                    : prev,
            )
        }

        function handlePlayerDisconnected(payload: unknown) {
            const { playerId, hostPlayerId } = payload as {
                playerId: string
                hostPlayerId: string
            }
            setLobby((prev) =>
                prev
                    ? {
                        ...prev,
                        hostPlayerId,
                        players: prev.players.filter((player) => player.id !== playerId),
                    }
                    : prev,
            )
        }

        function handleSettingsChanged(payload: unknown) {
            const { variation, turnDurationMs } = payload as { variation: Variation; turnDurationMs: number }
            setLobby((prev) => (prev ? { ...prev, variation, turnDurationMs } : prev))
            setActiveVariationTab(getVariationDifficulty(variation.wordLengths))
            setTurnMinutes(String(Math.floor(turnDurationMs / 60_000)))
            setTurnSeconds(String(Math.round((turnDurationMs % 60_000) / 1_000)))
        }

        function handleGameStarting(payload: unknown) {
            const { roomCode: rc } = payload as { roomCode: string }
            navigate(`/game/${rc}`)
        }

        return () => {
            cancelled = true
            ws?.close()
            if (wsRef.current === ws) {
                wsRef.current = null
            }
        }
    }, [roomCode, localPlayerId, navigate])

    const localPlayer = lobby?.players.find((player) => player.id === localPlayerId) ?? null
    const isLocalReady = localPlayer?.isReady ?? false

    function handleReady() {
        wsRef.current?.send(isLocalReady ? 'lobby:player_unready' : 'lobby:player_ready')
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
        setActiveVariationTab(getVariationDifficulty(wordLengths))
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
        setActiveVariationTab(getVariationDifficulty(wordLengths))
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

    function handleCopyRoomCode() {
        void navigator.clipboard.writeText(`${roomCode}`)
    }

    function handleVariationTabChange(nextTab: VariationTab) {
        if (!isHost) return

        setActiveVariationTab(nextTab)
        setVariationOpen(nextTab === 'Custom')
        setCustomVariationError('')
    }

    function handleTimerStep(deltaSeconds: number) {
        if (!lobby || !isHost) return

        const currentMinutes = Math.min(5, Math.max(1, parseInt(turnMinutes, 10) || 1))
        const currentSeconds = currentMinutes === 5 ? 0 : Math.min(59, Math.max(0, parseInt(turnSeconds, 10) || 0))
        const nextTotalSeconds = Math.min(300, Math.max(60, currentMinutes * 60 + currentSeconds + deltaSeconds))
        const nextMinutes = Math.floor(nextTotalSeconds / 60)
        const nextSeconds = nextMinutes === 5 ? 0 : nextTotalSeconds % 60

        setTurnMinutes(String(nextMinutes))
        setTurnSeconds(String(nextSeconds))
        wsRef.current?.send('lobby:settings_changed', {
            variation: lobby.variation,
            turnDurationMs: nextTotalSeconds * 1_000,
        })
    }

    const playerSlots = Array.from(
        { length: MAX_PLAYERS },
        (_, i) => lobby?.players[i] ?? null,
    )

    if (pageStatus !== 'ready' || !lobby) {
        const isRoomNotFound = pageStatus === 'room-not-found'
        const isConnectionError = pageStatus === 'connection-error'

        return (
            <div className="wd-page page-lobby page-lobby--loading">
                <div className="wd-floating-bg page-lobby__floating-bg" aria-hidden="true">
                    {FLOATING_LETTERS.map(({ key, letter, className }) => (
                        <div key={key} className={["wd-floating-letter", "page-lobby__floating-letter", className].join(' ')}>
                            {letter}
                        </div>
                    ))}
                </div>

                <main className="page-lobby__loading-shell">
                    <img src={wordDashLogo} alt="Word Dash" className="page-lobby__loading-logo" />
                    {isRoomNotFound || isConnectionError ? (
                        <div className="page-lobby__error" role="alert">
                            <h1 className="page-lobby__error-title">
                                {isRoomNotFound ? 'Room not found' : 'Unable to connect'}
                            </h1>
                            <p className="page-lobby__error-message">
                                {isRoomNotFound
                                    ? 'This room no longer exists. Go back home to create or join another game.'
                                    : 'We could not reach the server. Please try again from the home page.'}
                            </p>
                            <button
                                type="button"
                                className="page-lobby__home-button"
                                onClick={() => navigate('/')}
                            >
                                Go to home
                            </button>
                        </div>
                    ) : (
                        <p className="page-lobby__loading-text">Connecting…</p>
                    )}
                </main>
            </div>
        )
    }

    const activeVariationGroup = VARIATION_PRESET_GROUPS.find(
        (group) => group.difficulty === activeVariationTab,
    )
    const currentVariationLabel = getPresetDisplayLabel(lobby.variation.wordLengths)

    return (
        <div className="wd-page page-lobby">
            <div className="wd-floating-bg page-lobby__floating-bg" aria-hidden="true">
                {FLOATING_LETTERS.map(({ key, letter, className }) => (
                    <div key={key} className={["wd-floating-letter", "page-lobby__floating-letter", className].join(' ')}>
                        {letter}
                    </div>
                ))}
            </div>

            <nav className="page-lobby__topbar" aria-label="Lobby navigation">
                <div className="page-lobby__topbar-brand">
                    <img src={wordDashLogo} alt="Word Dash" className="page-lobby__nav-logo" />
                    <div className="page-lobby__room-pill">
                        <span className="page-lobby__room-pill-label">Room Code</span>
                        <span className="page-lobby__room-pill-value">{lobby.roomCode}</span>
                    </div>
                </div>

                <div className="page-lobby__topbar-actions">
                    <button className="wd-btn wd-btn--lift page-lobby__copy-btn" type="button" onClick={handleCopyRoomCode}>
                        Copy Room Code
                    </button>
                </div>
            </nav>

            <main className="wd-content-layer page-lobby__main">
                <div className="page-lobby__grid">
                    <section className="page-lobby__settings-column" aria-labelledby="page-lobby-settings-title">
                        <div className="page-lobby__settings-card">
                            <div className="page-lobby__settings-ornament" aria-hidden="true">
                                <LobbyIcon name="tune" className="page-lobby__settings-ornament-icon" />
                            </div>

                            <div className="page-lobby__section-heading">
                                <span className="page-lobby__section-bar" aria-hidden="true" />
                                <div className="page-lobby__section-copy">
                                    <h1 className="page-lobby__section-title" id="page-lobby-settings-title">
                                        Game Settings
                                    </h1>
                                </div>
                            </div>

                            <section className="page-lobby__variation" aria-labelledby="page-lobby-variation-title">
                                <div className="page-lobby__variation-header">
                                    <p className="page-lobby__eyebrow" id="page-lobby-variation-title">
                                        Variation
                                    </p>
                                    <p className="page-lobby__variation-caption">
                                        Choose a preset or enter a custom dash.
                                    </p>
                                </div>

                                <div className="page-lobby__variation-tabs" role="tablist" aria-label="Variation difficulty">
                                    {VARIATION_TABS.map((tab) => (
                                        <button
                                            key={tab}
                                            className={[
                                                'wd-btn',
                                                'page-lobby__variation-tab',
                                                activeVariationTab === tab && 'page-lobby__variation-tab--active',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                            type="button"
                                            role="tab"
                                            aria-selected={activeVariationTab === tab}
                                            onClick={() => handleVariationTabChange(tab)}
                                            disabled={!isHost}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                <div
                                    className={[
                                        'page-lobby__variation-panel',
                                        variationOpen && 'page-lobby__variation-panel--open',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                >
                                    <h2 className="page-lobby__panel-title">
                                        {activeVariationGroup ? 'Select Word Length Preset' : 'Custom Word Lengths'}
                                    </h2>

                                    {activeVariationGroup ? (
                                        <div className="page-lobby__preset-list">
                                            {activeVariationGroup.presets.map((preset) => {
                                                const isSelected =
                                                    JSON.stringify(preset.wordLengths) ===
                                                    JSON.stringify(lobby.variation.wordLengths)

                                                return (
                                                    <button
                                                        key={preset.label}
                                                        className={[
                                                            'wd-btn',
                                                            'page-lobby__preset-button',
                                                            isSelected && 'page-lobby__preset-button--selected',
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' ')}
                                                        type="button"
                                                        onClick={() => handlePresetClick(preset.wordLengths)}
                                                        disabled={!isHost}
                                                    >
                                                        <span className="page-lobby__preset-button-label">{preset.label}</span>
                                                        {isSelected && (
                                                            <span className="page-lobby__preset-button-check" aria-hidden="true">
                                                                <LobbyIcon name="check" className="page-lobby__preset-check-icon" />
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="page-lobby__custom-panel">
                                            <p className="page-lobby__custom-caption">
                                                Add custom word lengths for your dash.
                                            </p>

                                            <div className="page-lobby__custom-row">
                                                <div className="page-lobby__custom-field">
                                                    <label className="wd-sr-only" htmlFor="variation-custom">
                                                        Custom variation
                                                    </label>
                                                    <input
                                                        id="variation-custom"
                                                        className={[
                                                            'page-lobby__custom-input',
                                                            customVariationError && 'page-lobby__custom-input--error',
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' ')}
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="e.g. 4,7"
                                                        maxLength={20}
                                                        value={customInput}
                                                        onChange={handleCustomInputChange}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleCustomApply()
                                                        }}
                                                        disabled={!isHost}
                                                        aria-describedby={
                                                            customVariationError
                                                                ? 'custom-variation-error'
                                                                : undefined
                                                        }
                                                    />
                                                </div>

                                                <button
                                                    className="wd-btn wd-btn--lift wd-btn--secondary page-lobby__custom-apply-btn"
                                                    type="button"
                                                    onClick={handleCustomApply}
                                                    disabled={!isHost}
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

                                            <div className="page-lobby__custom-chips" aria-label="Current variation">
                                                <p className="page-lobby__custom-current-label">Current</p>
                                                <div className="page-lobby__preset-button page-lobby__preset-button--selected page-lobby__preset-button--current">
                                                    <span className="page-lobby__preset-button-label">
                                                        {currentVariationLabel}
                                                    </span>
                                                    <span className="page-lobby__preset-button-check" aria-hidden="true">
                                                        <LobbyIcon
                                                            name="check"
                                                            className="page-lobby__preset-check-icon"
                                                        />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="page-lobby__timer-card" aria-labelledby="page-lobby-timer-title">
                                <div className="page-lobby__timer-copy">
                                    <span className="page-lobby__timer-icon-wrap" aria-hidden="true">
                                        <LobbyIcon name="timer" className="page-lobby__timer-icon" />
                                    </span>

                                    <div>
                                        <h2 className="page-lobby__timer-title" id="page-lobby-timer-title">
                                            Turn Timer
                                        </h2>
                                        <p className="page-lobby__timer-subtitle">Time per word dash</p>
                                    </div>
                                </div>

                                <div className="page-lobby__timer-controls">
                                    <button
                                        className="wd-btn wd-btn--lift page-lobby__timer-step"
                                        type="button"
                                        onClick={() => handleTimerStep(-15)}
                                        disabled={!isHost}
                                        aria-label="Decrease turn time"
                                    >
                                        <LobbyIcon name="minus" className="page-lobby__timer-step-icon" />
                                    </button>

                                    <div className="page-lobby__timer-display">
                                        <label className="wd-sr-only" htmlFor="turn-minutes">
                                            Turn length minutes
                                        </label>
                                        <input
                                            id="turn-minutes"
                                            className="page-lobby__timer-input page-lobby__timer-input--minutes"
                                            type="number"
                                            min={1}
                                            max={5}
                                            value={turnMinutes}
                                            onChange={handleTurnMinutesChange}
                                            onBlur={handleTurnLengthBlur}
                                            disabled={!isHost}
                                        />

                                        <span className="page-lobby__timer-separator" aria-hidden="true">
                                            :
                                        </span>

                                        <label className="wd-sr-only" htmlFor="turn-seconds">
                                            Turn length seconds
                                        </label>
                                        <input
                                            id="turn-seconds"
                                            className="page-lobby__timer-input page-lobby__timer-input--seconds"
                                            type="number"
                                            min={0}
                                            max={59}
                                            value={turnSeconds.padStart(2, '0')}
                                            onChange={handleTurnSecondsChange}
                                            onBlur={handleTurnLengthBlur}
                                            disabled={!isHost}
                                        />
                                    </div>

                                    <button
                                        className="wd-btn wd-btn--lift page-lobby__timer-step"
                                        type="button"
                                        onClick={() => handleTimerStep(15)}
                                        disabled={!isHost}
                                        aria-label="Increase turn time"
                                    >
                                        <LobbyIcon name="plus" className="page-lobby__timer-step-icon" />
                                    </button>
                                </div>
                            </section>

                            {isHost && (
                                <div className="page-lobby__settings-footer">
                                    <button
                                        className="wd-btn wd-btn--lift wd-btn--secondary page-lobby__start-btn"
                                        type="button"
                                        onClick={handleStart}
                                        disabled={!canStart}
                                    >
                                        Start →
                                    </button>
                                    <p className="page-lobby__start-note">
                                        {canStart
                                            ? 'Everyone is ready.'
                                            : 'Need at least 2 ready players to start.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="page-lobby__players-column" aria-labelledby="page-lobby-players-title">
                        <div className="page-lobby__players-card">
                            <div className="page-lobby__players-header">
                                <h2 className="page-lobby__players-title" id="page-lobby-players-title">
                                    Players
                                    <span className="page-lobby__players-count">
                                        {lobby.players.length}/{MAX_PLAYERS}
                                    </span>
                                </h2>
                            </div>

                            <div className="page-lobby__players-list">
                                {playerSlots.map((player, index) => {
                                    const isCurrentPlayer = player?.id === localPlayerId
                                    const toneClass = getPlayerToneClass(index)
                                    const isReadyPlayer = player?.isReady ?? false
                                    const statusText = player
                                        ? !player.isConnected
                                            ? 'Disconnected'
                                            : player.isReady
                                                ? 'Ready'
                                                : 'Not Ready'
                                        : ''

                                    return (
                                        <article
                                            key={index}
                                            className={[
                                                'page-lobby__player-card',
                                                player === null && 'page-lobby__player-card--empty',
                                                player !== null && isReadyPlayer && 'page-lobby__player-card--ready',
                                                player !== null && isCurrentPlayer && 'page-lobby__player-card--current',
                                                player !== null && !player.isConnected && 'page-lobby__player-card--disconnected',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                        >
                                            {player ? (
                                                <>
                                                    <div className="page-lobby__player-main">
                                                        <div className="page-lobby__player-avatar-wrap">
                                                            <span
                                                                className={[
                                                                    'page-lobby__player-avatar',
                                                                    toneClass,
                                                                    isCurrentPlayer && 'page-lobby__player-avatar--current',
                                                                ]
                                                                    .filter(Boolean)
                                                                    .join(' ')}
                                                            >
                                                                <span className="page-lobby__player-avatar-letter">
                                                                    {player.name.charAt(0).toUpperCase()}
                                                                </span>
                                                            </span>

                                                            <span
                                                                className={[
                                                                    'page-lobby__player-dot',
                                                                    !player.isConnected
                                                                        ? 'page-lobby__player-dot--disconnected'
                                                                        : player.isReady
                                                                            ? 'page-lobby__player-dot--ready'
                                                                            : 'page-lobby__player-dot--not-ready',
                                                                    isCurrentPlayer && 'page-lobby__player-dot--current',
                                                                ]
                                                                    .filter(Boolean)
                                                                    .join(' ')}
                                                                aria-hidden="true"
                                                            />
                                                        </div>

                                                        <div className="page-lobby__player-copy">
                                                            <div className="page-lobby__player-name-row">
                                                                <span className="page-lobby__player-name">
                                                                    {isCurrentPlayer ? 'You' : player.name}
                                                                </span>
                                                                {player.id === lobby.hostPlayerId && (
                                                                    <span className="page-lobby__player-badge">Host</span>
                                                                )}
                                                            </div>

                                                            <span
                                                                className={[
                                                                    'page-lobby__player-status',
                                                                    player.isConnected && player.isReady && 'page-lobby__player-status--ready',
                                                                    player.isConnected && !player.isReady && 'page-lobby__player-status--not-ready',
                                                                    !player.isConnected && 'page-lobby__player-status--disconnected',
                                                                ]
                                                                    .filter(Boolean)
                                                                    .join(' ')}
                                                            >
                                                                {statusText}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="page-lobby__player-actions">
                                                        {isCurrentPlayer ? (
                                                            <button
                                                                className={[
                                                                    'wd-btn',
                                                                    'wd-btn--lift',
                                                                    isLocalReady ? 'wd-btn--primary' : 'wd-btn--secondary',
                                                                    'page-lobby__ready-btn',
                                                                ]
                                                                    .filter(Boolean)
                                                                    .join(' ')}
                                                                type="button"
                                                                onClick={handleReady}
                                                                disabled={localPlayer === null}
                                                            >
                                                                {isLocalReady ? 'Not Ready' : 'Ready'}
                                                            </button>
                                                        ) : player.isReady ? (
                                                            <span className="page-lobby__player-check" aria-label="Ready">
                                                                <LobbyIcon name="check" className="page-lobby__player-check-icon" />
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="page-lobby__player-empty">
                                                    <span className="page-lobby__player-empty-photo" aria-hidden="true">
                                                        <LobbyIcon name="person" className="page-lobby__player-empty-icon-svg" />
                                                    </span>
                                                    <span className="wd-sr-only">Open player slot</span>
                                                </div>
                                            )}
                                        </article>
                                    )
                                })}
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}
