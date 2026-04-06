import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createWsClient, WsClient } from '../../lib/ws'
import { session } from '../../lib/session'
import { GameBoard, type GameBoardLocalPlayer, type GameBoardOpponentPlayer, type GameBoardTurn, type GameBoardVariation } from '../../components/GameBoard/GameBoard'
import { WordRow } from '../../components/WordRow/WordRow'
import type { WordRowState } from '../../components/WordRow/WordRow'
import type { CardData } from '../../components/Card/Card'
import './Game.css'

// ─── Types (mirroring server GameState) ────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

export function Game() {
    const { roomCode } = useParams<{ roomCode: string }>()
    const navigate = useNavigate()
    const localPlayerId = session.getPlayerId() ?? ''

    const [gameState, setGameState] = useState<GameState | null>(null)
    const wsRef = useRef<WsClient | null>(null)

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
            const { playerId, wordBoard } = payload as {
                playerId: string
                wordBoard: WordBoardState
            }
            setGameState((prev) =>
                prev
                    ? {
                        ...prev,
                        players: prev.players.map((p) =>
                            p.id === playerId ? { ...p, wordBoard } : p,
                        ),
                    }
                    : prev,
            )
        })

        ws.on('game:timer_tick', (payload) => {
            const { timeRemainingMs } = payload as { timeRemainingMs: number }
            setGameState((prev) =>
                prev
                    ? { ...prev, turn: { ...prev.turn, timeRemainingMs } }
                    : prev,
            )
        })

        ws.on('game:turn_ended', (payload) => {
            const { nextPlayerId, discardPileTop } = payload as {
                playerId: string
                reason: 'discarded' | 'timeout'
                discardedCard: Card
                discardPileTop: Card
                nextPlayerId: string
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
                        drawnCard: null,
                    },
                }
            })
        })

        ws.on('game:player_won', (payload) => {
            const { winnerId } = payload as { winnerId: string; winnerName: string; winningWordBoard: WordBoardState }
            setGameState((prev) =>
                prev ? { ...prev, phase: 'finished', winnerId } : prev,
            )
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

        ws.send('game:player_connected')

        return () => {
            ws.close()
        }
    }, [roomCode, localPlayerId])

    function handleDraw(source: 'draw' | 'discard') {
        wsRef.current?.send('game:draw_card', { source })
    }

    function handlePlace(cardId: string, rowIndex: number, slotIndex: number) {
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
        return <p className="page-game__error">Invalid session. Please rejoin from the home page.</p>
    }

    if (!gameState) {
        return (
            <main className="page-game page-game--loading">
                <p className="page-game__loading-text">Connecting…</p>
            </main>
        )
    }

    const localPlayerData = gameState.players.find((p) => p.id === localPlayerId) ?? null
    const boardLocalPlayer: GameBoardLocalPlayer | null = localPlayerData
        ? {
            id: localPlayerData.id,
            name: localPlayerData.name,
            isConnected: localPlayerData.isConnected,
            hand: localPlayerData.hand ?? [],
            wordBoard: localPlayerData.wordBoard,
        }
        : null
    const boardOpponents: GameBoardOpponentPlayer[] = gameState.players
        .filter((p) => p.id !== localPlayerId)
        .map((p) => ({
            id: p.id,
            name: p.name,
            isConnected: p.isConnected,
            handCount: p.handCount,
            wordBoard: p.wordBoard,
        }))

    const boardTurn: GameBoardTurn = {
        currentPlayerId: gameState.turn.currentPlayerId,
        phase: gameState.turn.phase,
        timeRemainingMs: gameState.turn.timeRemainingMs,
        totalDurationMs: 60_000,
    }

    const boardVariation: GameBoardVariation = gameState.variation

    const winner = gameState.winnerId
        ? gameState.players.find((p) => p.id === gameState.winnerId) ?? null
        : null

    const isHost = gameState.hostPlayerId === localPlayerId

    return (
        <main className="page-game">
            <GameBoard
                localPlayer={boardLocalPlayer}
                opponents={boardOpponents}
                turn={boardTurn}
                variation={boardVariation}
                discardTopCard={gameState.discardPileTop}
                drawPileCount={gameState.drawPileCount}
                onDraw={handleDraw}
                onPlace={handlePlace}
                onUnplace={handleUnplace}
                onDiscard={handleDiscard}
            />

            {gameState.phase === 'finished' && winner && (
                <div className="page-game__overlay" role="dialog" aria-modal="true" aria-label="Game over">
                    <div className="page-game__overlay-card">
                        <h2 className="page-game__overlay-heading">
                            🏆 {winner.name} wins!
                        </h2>
                        <section className="page-game__overlay-words" aria-label="Winning words">
                            {winner.wordBoard.rows.map((row, i) => (
                                <WordRow
                                    key={i}
                                    rowState={row}
                                    rowIndex={i}
                                />
                            ))}
                        </section>
                        <div className="page-game__overlay-actions">
                            {isHost && (
                                <button
                                    className="page-game__btn page-game__btn--primary"
                                    onClick={handlePlayAgain}
                                >
                                    Play Again
                                </button>
                            )}
                            <button
                                className="page-game__btn page-game__btn--secondary"
                                onClick={handleHome}
                            >
                                Home
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
