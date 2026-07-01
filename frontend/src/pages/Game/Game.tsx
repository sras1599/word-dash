import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createWsClient, WsClient } from '../../lib/ws'
import { session } from '../../lib/session'
import { GameBoard } from '../../components/GameBoard/GameBoard'
import { WordRow } from '../../components/WordRow/WordRow'
import type { WordRowState } from '../../components/WordRow/WordRow'
import type { CardData } from '../../components/Card/Card'
import wordDashLogo from '../../assets/word-dash-logo.svg'
import './Game.css'

type Card = CardData

type WordBoardState = {
    rows: WordRowState[]
    allComplete: boolean
}

type Variation = {
    wordLengths: number[]
}

type TurnPhase = 'draw' | 'arrange' | 'idle'

type Turn = {
    currentPlayerId: string
    phase: TurnPhase
    timeRemainingMs: number
    drawnCard: Card | null
}

type Player = {
    id: string
    name: string
    handCount: number
    hand?: Card[]
    wordBoard: WordBoardState
    isReady: boolean
    isConnected: boolean
}

type GamePhase = 'waiting' | 'playing' | 'finished'

type GameState = {
    roomCode: string
    variation: Variation
    players: Player[]
    drawPileCount: number
    discardPileTop: Card | null
    turn: Turn
    phase: GamePhase
    winnerId: string | null
    hostPlayerId: string
}

const LOCAL_COUNTDOWN_STEP_MS = 1000
const URGENCY_THRESHOLD_MS = 15_000

const FLOATING_LETTERS = [
    { key: 'a', letter: 'A', className: 'page-game__floating-letter--a' },
    { key: 'w', letter: 'W', className: 'page-game__floating-letter--w' },
    { key: 's', letter: 'S', className: 'page-game__floating-letter--s' },
]

function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function GameIcon({
    name,
    className,
}: {
    name: 'timer' | 'help' | 'settings'
    className?: string
}) {
    switch (name) {
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
        case 'help':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                    <path
                        d="M9.7 9.2a2.7 2.7 0 0 1 4.8 1.7c0 1.2-.6 1.9-1.8 2.7c-1 .6-1.4 1.1-1.4 2"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle cx="12" cy="17.2" r="0.9" fill="currentColor" />
                </svg>
            )
        case 'settings':
            return (
                <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
                    <path
                        d="M12 8.25A3.75 3.75 0 1 0 12 15.75A3.75 3.75 0 1 0 12 8.25Z"
                        stroke="currentColor"
                        strokeWidth="1.75"
                    />
                    <path
                        d="M19.2 15.25l1.05 1.82l-1.92 3.33l-2.08-.4a7.83 7.83 0 0 1-1.53.9L14 23h-4l-.72-2.1a7.84 7.84 0 0 1-1.53-.9l-2.08.4l-1.92-3.33l1.05-1.82a7.93 7.93 0 0 1 0-1.8L3.75 11.63l1.92-3.33l2.08.4c.47-.36.98-.66 1.53-.9L10 5h4l.72 2.1c.55.24 1.06.54 1.53.9l2.08-.4l1.92 3.33l-1.05 1.82c.08.59.08 1.21 0 1.8Z"
                        stroke="currentColor"
                        strokeWidth="1.45"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )
    }
}

export function Game() {
    const { roomCode } = useParams<{ roomCode: string }>()
    const navigate = useNavigate()
    const localPlayerId = session.getPlayerId() ?? ''

    const [gameState, setGameState] = useState<GameState | null>(null)
    const wsRef = useRef<WsClient | null>(null)

    const canPlaceCard = (state: GameState | null) => {
        if (!state) return false
        if (state.phase !== 'playing') return false
        return state.turn.phase === 'draw' || state.turn.phase === 'arrange'
    }

    useEffect(() => {
        if (!roomCode || !localPlayerId) return

        const ws = createWsClient(roomCode, localPlayerId)
        wsRef.current = ws

        ws.on('game:state', (payload) => {
            setGameState(payload as GameState)
        })

        ws.on('game:turn_started', (payload) => {
            const { currentPlayerId, timeRemainingMs } = payload as {
                currentPlayerId: string
                timeRemainingMs: number
            }
            setGameState((prev) =>
                prev
                    ? {
                        ...prev,
                        turn: {
                            ...prev.turn,
                            currentPlayerId,
                            phase: 'draw',
                            timeRemainingMs,
                            drawnCard: null,
                        },
                    }
                    : prev,
            )
        })

        ws.on('game:card_drawn', (payload) => {
            const { playerId, card, drawPileCount, discardPileTop } = payload as {
                playerId: string
                source: 'draw' | 'discard'
                card: Card | null
                drawPileCount: number
                discardPileTop: Card | null
            }
            setGameState((prev) => {
                if (!prev) return prev
                const players = prev.players.map((p) => {
                    if (p.id !== playerId) return p
                    if (p.id === localPlayerId) {
                        const newCard = card ?? { id: `unknown-${Date.now()}`, letter: '?' }
                        return { ...p, handCount: p.handCount + 1, hand: [...(p.hand ?? []), newCard] }
                    }
                    return { ...p, handCount: p.handCount + 1 }
                })

                return {
                    ...prev,
                    players,
                    drawPileCount,
                    discardPileTop,
                    turn: {
                        ...prev.turn,
                        phase: 'arrange' as TurnPhase,
                        drawnCard: playerId === localPlayerId ? card : prev.turn.drawnCard,
                    },
                }
            })
        })

        ws.on('game:board_updated', (payload) => {
            const { playerId, wordBoard, handCount, hand } = payload as {
                playerId: string
                wordBoard: WordBoardState
                handCount: number
                hand?: Card[]
            }
            setGameState((prev) =>
                prev
                    ? {
                        ...prev,
                        players: prev.players.map((p) =>
                            p.id === playerId
                                ? {
                                    ...p,
                                    wordBoard,
                                    handCount,
                                    hand: p.id === localPlayerId && hand ? hand : p.hand,
                                }
                                : p,
                        ),
                    }
                    : prev,
            )
        })

        ws.on('game:timer_warning', (payload) => {
            const { currentPlayerId, timeRemainingMs } = payload as {
                currentPlayerId?: string
                timeRemainingMs: number
            }

            setGameState((prev) =>
                prev
                    ? {
                        ...prev,
                        turn: {
                            ...prev.turn,
                            currentPlayerId: currentPlayerId ?? prev.turn.currentPlayerId,
                            timeRemainingMs: Math.max(0, timeRemainingMs),
                        },
                    }
                    : prev,
            )
        })

        ws.on('game:turn_ended', (payload) => {
            const { nextPlayerId, discardPileTop, timeRemainingMs } = payload as {
                playerId: string
                reason: 'discarded' | 'timeout'
                discardedCard: Card
                discardPileTop: Card
                nextPlayerId: string
                timeRemainingMs?: number
            }
            setGameState((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
                    discardPileTop,
                    turn: {
                        ...prev.turn,
                        currentPlayerId: nextPlayerId,
                        phase: 'draw' as TurnPhase,
                        timeRemainingMs:
                            typeof timeRemainingMs === 'number'
                                ? timeRemainingMs
                                : prev.turn.timeRemainingMs,
                        drawnCard: null,
                    },
                }
            })
        })

        ws.on('game:turn_skipped', (payload) => {
            const { playerId, nextPlayerId, timeRemainingMs } = payload as {
                playerId: string
                reason: string
                nextPlayerId?: string
                timeRemainingMs?: number
            }
            setGameState((prev) => {
                if (!prev) return prev
                const idx = prev.players.findIndex((p) => p.id === playerId)
                const nextIdx = idx === -1 ? 0 : (idx + 1) % prev.players.length
                return {
                    ...prev,
                    turn: {
                        ...prev.turn,
                        currentPlayerId: nextPlayerId ?? prev.players[nextIdx].id,
                        phase: 'draw' as TurnPhase,
                        timeRemainingMs:
                            typeof timeRemainingMs === 'number'
                                ? timeRemainingMs
                                : prev.turn.timeRemainingMs,
                        drawnCard: null,
                    },
                }
            })
        })

        ws.on('game:player_won', (payload) => {
            const { winnerId } = payload as {
                winnerId: string
                winnerName: string
                winningWordBoard: WordBoardState
            }
            setGameState((prev) => (prev ? { ...prev, phase: 'finished', winnerId } : prev))
        })

        ws.on('game:player_disconnected', (payload) => {
            const { playerId } = payload as { playerId: string }
            setGameState((prev) =>
                prev
                    ? {
                        ...prev,
                        players: prev.players.map((p) =>
                            p.id === playerId ? { ...p, isConnected: false } : p,
                        ),
                    }
                    : prev,
            )
        })

        ws.on('game:player_reconnected', (payload) => {
            const { playerId } = payload as { playerId: string }
            setGameState((prev) =>
                prev
                    ? {
                        ...prev,
                        players: prev.players.map((p) =>
                            p.id === playerId ? { ...p, isConnected: true } : p,
                        ),
                    }
                    : prev,
            )
        })

        return () => {
            ws.close()
        }
    }, [roomCode, localPlayerId])

    useEffect(() => {
        const timerId = window.setInterval(() => {
            setGameState((prev) => {
                if (!prev) return prev
                if (prev.phase !== 'playing') return prev
                if (prev.turn.phase === 'idle') return prev
                if (prev.turn.timeRemainingMs <= 0) return prev

                return {
                    ...prev,
                    turn: {
                        ...prev.turn,
                        timeRemainingMs: Math.max(0, prev.turn.timeRemainingMs - LOCAL_COUNTDOWN_STEP_MS),
                    },
                }
            })
        }, LOCAL_COUNTDOWN_STEP_MS)

        return () => {
            window.clearInterval(timerId)
        }
    }, [])

    function handleDraw(source: 'draw' | 'discard') {
        wsRef.current?.send('game:draw_card', { source })
    }

    function handlePlace(cardId: string, rowIndex: number, slotIndex: number) {
        if (!canPlaceCard(gameState)) {
            return
        }

        setGameState((prev) => {
            if (!prev) return prev
            if (prev.phase !== 'playing') return prev
            if (prev.turn.phase !== 'draw' && prev.turn.phase !== 'arrange') return prev
            return {
                ...prev,
                players: prev.players.map((p) => {
                    if (p.id !== localPlayerId) return p

                    const hand = p.hand ?? []
                    const cardIndex = hand.findIndex((card) => card.id === cardId)
                    if (cardIndex === -1) return p

                    const swappedCard = p.wordBoard.rows[rowIndex]?.slots[slotIndex]?.card ?? null
                    const nextHand = [...hand]
                    if (swappedCard) {
                        nextHand[cardIndex] = swappedCard
                    } else {
                        nextHand.splice(cardIndex, 1)
                    }

                    return {
                        ...p,
                        hand: nextHand,
                        handCount: nextHand.length,
                    }
                }),
            }
        })

        wsRef.current?.send('game:place_card', { cardId, rowIndex, slotIndex })
    }

    function handleUnplace(rowIndex: number, slotIndex: number) {
        wsRef.current?.send('game:unplace_card', { rowIndex, slotIndex })
    }

    function handleDiscard(cardId: string) {
        wsRef.current?.send('game:discard_card', { cardId })
    }

    function handlePlayAgain() {
        wsRef.current?.send('lobby:restart')
        navigate(`/lobby/${roomCode}`)
    }

    function handleHome() {
        wsRef.current?.close()
        navigate('/')
    }

    if (!roomCode || !localPlayerId) {
        return (
            <div className="wd-page page-game page-game--error">
                <div className="wd-floating-bg page-game__floating-bg" aria-hidden="true">
                    {FLOATING_LETTERS.map(({ key, letter, className }) => (
                        <div key={key} className={['page-game__floating-letter', className].join(' ')}>
                            {letter}
                        </div>
                    ))}
                </div>

                <main className="page-game__state-shell">
                    <img src={wordDashLogo} alt="Word Dash" className="page-game__state-logo" />
                    <div className="page-game__state-panel">
                        <h1 className="page-game__state-title">Invalid session</h1>
                        <p className="page-game__state-copy">Please rejoin from the home page.</p>
                        <button className="page-game__state-btn" type="button" onClick={handleHome}>
                            Return Home
                        </button>
                    </div>
                </main>
            </div>
        )
    }

    if (!gameState) {
        return (
            <div className="wd-page page-game page-game--loading">
                <div className="wd-floating-bg page-game__floating-bg" aria-hidden="true">
                    {FLOATING_LETTERS.map(({ key, letter, className }) => (
                        <div key={key} className={['page-game__floating-letter', className].join(' ')}>
                            {letter}
                        </div>
                    ))}
                </div>

                <main className="page-game__state-shell">
                    <img src={wordDashLogo} alt="Word Dash" className="page-game__state-logo" />
                    <p className="page-game__loading-text">Connecting…</p>
                </main>
            </div>
        )
    }

    const currentGameState = gameState
    const localPlayerData = currentGameState.players.find((p) => p.id === localPlayerId) ?? null
    const opponents = currentGameState.players.filter((p) => p.id !== localPlayerId)
    const winner = currentGameState.winnerId
        ? currentGameState.players.find((p) => p.id === currentGameState.winnerId) ?? null
        : null
    const isHost = currentGameState.hostPlayerId === localPlayerId
    const isLocalTurn = currentGameState.turn.currentPlayerId === localPlayerId
    const isArrangePhase = currentGameState.phase === 'playing' && isLocalTurn && currentGameState.turn.phase === 'arrange'
    const timerIsUrgent =
        currentGameState.phase === 'playing' &&
        currentGameState.turn.phase !== 'idle' &&
        currentGameState.turn.timeRemainingMs <= URGENCY_THRESHOLD_MS
    const drawnCardId = currentGameState.turn.drawnCard?.id ?? null
    const localHand = localPlayerData?.hand ?? []
    const handCount = localPlayerData?.handCount ?? localHand.length
    const currentTurnPlayer = currentGameState.players.find((p) => p.id === currentGameState.turn.currentPlayerId) ?? null

    function getBoardSubtitle(): string {
        if (currentGameState.phase === 'finished') {
            return 'Round complete.'
        }

        if (currentGameState.phase === 'waiting') {
            return 'Preparing the board.'
        }

        if (isLocalTurn) {
            return currentGameState.turn.phase === 'draw'
                ? 'Draw a card, then build or discard.'
                : 'Arrange your cards before the timer expires.'
        }

        return `Waiting for ${currentTurnPlayer?.name ?? 'the next player'}.`
    }

    return (
        <div className="wd-page page-game">
            <div className="wd-floating-bg page-game__floating-bg" aria-hidden="true">
                {FLOATING_LETTERS.map(({ key, letter, className }) => (
                    <div key={key} className={['page-game__floating-letter', className].join(' ')}>
                        {letter}
                    </div>
                ))}
            </div>

            <nav className="page-game__nav" aria-label="Game navigation">
                <div className="page-game__nav-start">
                    <button className="page-game__nav-brand" type="button" onClick={handleHome} aria-label="Return home">
                        <img src={wordDashLogo} alt="Word Dash" className="page-game__nav-logo" />
                    </button>

                    <div className="page-game__nav-divider" aria-hidden="true" />

                    <div
                        className={[
                            'page-game__nav-timer',
                            timerIsUrgent && 'page-game__nav-timer--urgent',
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        role="timer"
                        aria-label={`Time remaining ${formatTime(currentGameState.turn.timeRemainingMs)}`}
                    >
                        <GameIcon name="timer" className="page-game__nav-timer-icon" />
                        <span className="page-game__nav-timer-text">{formatTime(currentGameState.turn.timeRemainingMs)}</span>
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
                            <GameIcon name="help" className="page-game__nav-icon" />
                        </span>
                        <span className="page-game__nav-icon-btn">
                            <GameIcon name="settings" className="page-game__nav-icon" />
                        </span>
                    </div>
                </div>
            </nav>

            <main className="wd-content-layer page-game__main">
                <GameBoard
                    phase={currentGameState.phase}
                    localPlayerId={localPlayerId}
                    winnerId={currentGameState.winnerId}
                    localPlayer={localPlayerData ? { ...localPlayerData, hand: localHand } : null}
                    opponents={opponents}
                    turn={currentGameState.turn}
                    variation={currentGameState.variation}
                    discardTopCard={currentGameState.discardPileTop}
                    drawPileCount={currentGameState.drawPileCount}
                    boardSubtitle={getBoardSubtitle()}
                    handCount={handCount}
                    drawnCardId={drawnCardId}
                    willAutoDiscardCardId={isArrangePhase && timerIsUrgent ? drawnCardId : null}
                    onDraw={handleDraw}
                    onPlace={handlePlace}
                    onUnplace={handleUnplace}
                    onDiscard={handleDiscard}
                />
            </main>

            {currentGameState.phase === 'finished' && winner && (
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
                                <button
                                    className="page-game__overlay-btn page-game__overlay-btn--primary"
                                    onClick={handlePlayAgain}
                                >
                                    Play Again
                                </button>
                            )}
                            <button
                                className="page-game__overlay-btn page-game__overlay-btn--secondary"
                                onClick={handleHome}
                            >
                                Home
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
