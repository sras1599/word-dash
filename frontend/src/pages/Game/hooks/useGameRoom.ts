import { useEffect, useRef } from 'react'
import { useMachine } from '@xstate/react'
import type { Card, WordBoardState } from '../../../lib/gameTypes'
import { createWsClient, type WsClient } from '../../../lib/ws'
import { gameMachine } from '../state/gameMachine'
import { canPlaceCard, LOCAL_COUNTDOWN_STEP_MS } from '../state/gameReducer'

export function useGameRoom(roomCode: string | undefined, localPlayerId: string) {
    const [snapshot, send] = useMachine(gameMachine)
    const wsRef = useRef<WsClient | null>(null)
    const gameState = snapshot.context.gameState

    useEffect(() => {
        if (!roomCode || !localPlayerId) {
            send({ type: 'INVALID_SESSION' })
            return
        }

        send({ type: 'CONNECTING' })

        const ws = createWsClient(roomCode, localPlayerId)
        wsRef.current = ws

        ws.on('game:state', (payload) => {
            send({ type: 'GAME_STATE', state: payload as never })
        })

        ws.on('game:turn_started', (payload) => {
            const { currentPlayerId, timeRemainingMs } = payload as {
                currentPlayerId: string
                timeRemainingMs: number
            }
            send({ type: 'TURN_STARTED', currentPlayerId, timeRemainingMs })
        })

        ws.on('game:card_drawn', (payload) => {
            const { playerId, card, drawPileCount, discardPileTop, timeRemainingMs } = payload as {
                playerId: string
                source: 'draw' | 'discard'
                card: Card | null
                drawPileCount: number
                discardPileTop: Card | null
                timeRemainingMs?: number
            }
            send({
                type: 'CARD_DRAWN',
                localPlayerId,
                playerId,
                card,
                drawPileCount,
                discardPileTop,
                timeRemainingMs,
            })
        })

        ws.on('game:board_updated', (payload) => {
            const { playerId, wordBoard, handCount, hand } = payload as {
                playerId: string
                wordBoard: WordBoardState
                handCount: number
                hand?: Card[]
            }
            send({ type: 'BOARD_UPDATED', localPlayerId, playerId, wordBoard, handCount, hand })
        })

        ws.on('game:timer_warning', (payload) => {
            const { currentPlayerId, timeRemainingMs } = payload as {
                currentPlayerId?: string
                timeRemainingMs: number
            }
            send({ type: 'TIMER_WARNING', currentPlayerId, timeRemainingMs })
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
            send({ type: 'TURN_ENDED', nextPlayerId, discardPileTop, timeRemainingMs })
        })

        ws.on('game:turn_skipped', (payload) => {
            const { playerId, nextPlayerId, timeRemainingMs } = payload as {
                playerId: string
                reason: string
                nextPlayerId?: string
                timeRemainingMs?: number
            }
            send({ type: 'TURN_SKIPPED', playerId, nextPlayerId, timeRemainingMs })
        })

        ws.on('game:player_won', (payload) => {
            const { winnerId } = payload as {
                winnerId: string
                winnerName: string
                winningWordBoard: WordBoardState
            }
            send({ type: 'PLAYER_WON', winnerId })
        })

        ws.on('game:player_disconnected', (payload) => {
            const { playerId } = payload as { playerId: string }
            send({ type: 'PLAYER_CONNECTION_CHANGED', playerId, isConnected: false })
        })

        ws.on('game:player_reconnected', (payload) => {
            const { playerId } = payload as { playerId: string }
            send({ type: 'PLAYER_CONNECTION_CHANGED', playerId, isConnected: true })
        })

        return () => {
            ws.close()
            if (wsRef.current === ws) {
                wsRef.current = null
            }
        }
    }, [localPlayerId, roomCode, send])

    useEffect(() => {
        const timerId = window.setInterval(() => {
            send({ type: 'LOCAL_TIMER_TICK' })
        }, LOCAL_COUNTDOWN_STEP_MS)

        return () => {
            window.clearInterval(timerId)
        }
    }, [send])

    function draw(source: 'draw' | 'discard') {
        wsRef.current?.send('game:draw_card', { source })
    }

    function place(cardId: string, rowIndex: number, slotIndex: number) {
        if (!canPlaceCard(gameState)) return

        send({ type: 'LOCAL_CARD_PLACED_OPTIMISTICALLY', localPlayerId, cardId, rowIndex, slotIndex })
        wsRef.current?.send('game:place_card', { cardId, rowIndex, slotIndex })
    }

    function unplace(rowIndex: number, slotIndex: number) {
        wsRef.current?.send('game:unplace_card', { rowIndex, slotIndex })
    }

    function discard(cardId: string) {
        wsRef.current?.send('game:discard_card', { cardId })
    }

    function restartLobby() {
        wsRef.current?.send('lobby:restart')
    }

    function close() {
        wsRef.current?.close()
    }

    return {
        gameState,
        draw,
        place,
        unplace,
        discard,
        restartLobby,
        close,
    }
}
