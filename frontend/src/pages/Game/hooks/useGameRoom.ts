import { useEffect, useRef, useState } from 'react'
import { useMachine } from '@xstate/react'
import type { Card, WordBoardState } from '../../../lib/gameTypes'
import { reconcileTurnTimerAnchor, remainingFromAnchor, type TurnTimerAnchor } from '../../../lib/turnTimer'
import { createWsClient, type GameEventMeta, type WsClient } from '../../../lib/ws'
import { gameMachine } from '../state/gameMachine'
import { canDiscardCard, canDrawCard, canPlaceCard } from '../state/gameReducer'

export function createClientActionId(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export function useGameRoom(roomCode: string | undefined, localPlayerId: string) {
    const [snapshot, send] = useMachine(gameMachine)
    const wsRef = useRef<WsClient | null>(null)
    const [timerAnchor, setTimerAnchor] = useState<TurnTimerAnchor | null>(null)
    const [repaintAtMs, setRepaintAtMs] = useState(() => performance.now())
    const [rejectionFeedback, setRejectionFeedback] = useState<string | null>(null)
    const gameState = snapshot.context.gameState

    useEffect(() => {
        if (!roomCode || !localPlayerId) {
            send({ type: 'INVALID_SESSION' })
            return
        }

        send({ type: 'CONNECTING' })

        const ws = createWsClient(roomCode, localPlayerId)
        wsRef.current = ws
        let rejectionTimer: number | undefined

        const reconcileTimer = (meta?: GameEventMeta) => {
            if (!meta) return
            if (!meta.turn) {
                setTimerAnchor(null)
                setRepaintAtMs(performance.now())
                return
            }
            const receivedAtMs = performance.now()
            setTimerAnchor((current) => reconcileTurnTimerAnchor(current, meta, receivedAtMs))
            setRepaintAtMs(receivedAtMs)
        }

        ws.on('game:state', (payload, meta) => {
            reconcileTimer(meta)
            send({ type: 'GAME_STATE', state: payload as never, localPlayerId })
        })

        ws.on('game:card_drawn', (payload, meta) => {
            reconcileTimer(meta)
            const { playerId, card, drawPileCount, discardPileTop } = payload as {
                playerId: string
                source: 'draw' | 'discard'
                card: Card | null
                drawPileCount: number
                discardPileTop: Card | null
            }
            send({
                type: 'CARD_DRAWN',
                localPlayerId,
                playerId,
                card,
                drawPileCount,
                discardPileTop,
            })
        })

        ws.on('game:board_updated', (payload, meta) => {
            reconcileTimer(meta)
            const { playerId, wordBoard, handCount, hand, boardRevision, clientActionId } = payload as {
                playerId: string
                wordBoard: WordBoardState
                handCount: number
                hand?: Card[]
                boardRevision: number
                clientActionId?: string
            }
            send({ type: 'BOARD_UPDATED', localPlayerId, playerId, wordBoard, handCount, hand, boardRevision, clientActionId })
        })

        ws.on('game:error', (payload) => {
            const { clientActionId } = payload as { code: string; message: string; clientActionId?: string }
            const message = 'That move was rejected. Your board has been refreshed.'
            send({ type: 'ACTION_REJECTED', clientActionId, message })
            setRejectionFeedback(message)
            if (rejectionTimer !== undefined) window.clearTimeout(rejectionTimer)
            rejectionTimer = window.setTimeout(() => setRejectionFeedback(null), 5_000)
        })

        ws.on('game:turn_ended', (payload, meta) => {
            reconcileTimer(meta)
            const { nextPlayerId, discardPileTop } = payload as {
                playerId: string
                reason: 'discarded' | 'timeout'
                discardedCard: Card
                discardPileTop: Card
                nextPlayerId: string
            }
            send({ type: 'TURN_ENDED', nextPlayerId, discardPileTop })
        })

        ws.on('game:turn_skipped', (payload, meta) => {
            reconcileTimer(meta)
            const { playerId, nextPlayerId } = payload as {
                playerId: string
                reason: string
                nextPlayerId?: string
            }
            send({ type: 'TURN_SKIPPED', playerId, nextPlayerId })
        })

        ws.on('game:player_won', (payload, meta) => {
            reconcileTimer(meta)
            const { winnerId } = payload as {
                winnerId: string
                winnerName: string
                winningWordBoard: WordBoardState
            }
            send({ type: 'PLAYER_WON', winnerId })
        })

        ws.on('game:player_disconnected', (payload, meta) => {
            reconcileTimer(meta)
            const { playerId } = payload as { playerId: string }
            send({ type: 'PLAYER_CONNECTION_CHANGED', playerId, isConnected: false })
        })

        ws.on('game:player_reconnected', (payload, meta) => {
            reconcileTimer(meta)
            const { playerId } = payload as { playerId: string }
            send({ type: 'PLAYER_CONNECTION_CHANGED', playerId, isConnected: true })
        })

        return () => {
            if (rejectionTimer !== undefined) window.clearTimeout(rejectionTimer)
            ws.close()
            if (wsRef.current === ws) {
                wsRef.current = null
            }
        }
    }, [localPlayerId, roomCode, send])

    useEffect(() => {
        const repaint = () => setRepaintAtMs(performance.now())
        const timerId = window.setInterval(repaint, 1000)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') repaint()
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            window.clearInterval(timerId)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    function draw(source: 'draw' | 'discard') {
        if (!canDrawCard(gameState, localPlayerId)) return
        if (source === 'discard' && !gameState?.discardPileTop) return

        if (source === 'discard') {
            send({ type: 'LOCAL_DISCARD_PILE_DRAWN_OPTIMISTICALLY', localPlayerId })
        }

        wsRef.current?.send('game:draw_card', { source })
    }

    function place(cardId: string, rowIndex: number, slotIndex: number) {
        if (!canPlaceCard(gameState)) return

        const clientActionId = createClientActionId()
        send({ type: 'LOCAL_CARD_PLACED_OPTIMISTICALLY', localPlayerId, clientActionId, cardId, rowIndex, slotIndex })
        wsRef.current?.send('game:place_card', { cardId, rowIndex, slotIndex, clientActionId })
    }

    function unplace(rowIndex: number, slotIndex: number) {
        if (!canPlaceCard(gameState)) return

        const clientActionId = createClientActionId()
        send({ type: 'LOCAL_CARD_UNPLACED_OPTIMISTICALLY', localPlayerId, clientActionId, rowIndex, slotIndex })

        wsRef.current?.send('game:unplace_card', { rowIndex, slotIndex, clientActionId })
    }

    function clearWord(rowIndex: number) {
        if (!canPlaceCard(gameState)) return

        const clientActionId = createClientActionId()
        send({ type: 'LOCAL_WORD_CLEARED_OPTIMISTICALLY', localPlayerId, clientActionId, rowIndex })

        wsRef.current?.send('game:clear_word', { rowIndex, clientActionId })
    }

    function clearBoard() {
        if (!canPlaceCard(gameState)) return

        const clientActionId = createClientActionId()
        send({ type: 'LOCAL_BOARD_CLEARED_OPTIMISTICALLY', localPlayerId, clientActionId })

        wsRef.current?.send('game:clear_board', { clientActionId })
    }

    function discard(cardId: string) {
        if (!canDiscardCard(gameState, localPlayerId)) return

        const clientActionId = createClientActionId()
        send({ type: 'LOCAL_CARD_DISCARDED_OPTIMISTICALLY', localPlayerId, clientActionId, cardId })

        wsRef.current?.send('game:discard_card', { cardId, clientActionId })
    }

    function restartLobby() {
        wsRef.current?.send('lobby:restart')
    }

    function close() {
        wsRef.current?.close()
    }

    return {
        gameState,
        rejectionFeedback,
        timeRemainingMs: remainingFromAnchor(timerAnchor, repaintAtMs),
        turnDurationMs: timerAnchor?.durationMs ?? 0,
        draw,
        place,
        unplace,
        clearWord,
        clearBoard,
        discard,
        restartLobby,
        close,
    }
}
