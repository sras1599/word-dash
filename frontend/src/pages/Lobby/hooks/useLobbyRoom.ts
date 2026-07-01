import { useEffect, useRef } from 'react'
import { useMachine } from '@xstate/react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../lib/api'
import type { LobbyPlayer, Variation } from '../../../lib/gameTypes'
import { useValidateRoomQuery } from '../../../lib/roomQueries'
import { createWsClient, type WsClient } from '../../../lib/ws'
import { getLobbyPageStatus, lobbyMachine } from '../state/lobbyMachine'

export type LobbyPageStatus = 'connecting' | 'ready' | 'room-not-found' | 'connection-error'

type LobbySettingsPayload = {
    variation: Variation
    turnDurationMs: number
}

export function useLobbyRoom(roomCode: string | undefined, localPlayerId: string) {
    const navigate = useNavigate()
    const [snapshot, send] = useMachine(lobbyMachine)
    const validateRoomQuery = useValidateRoomQuery(roomCode, !!roomCode && !!localPlayerId)
    const wsRef = useRef<WsClient | null>(null)

    useEffect(() => {
        if (!roomCode || !localPlayerId) {
            send({ type: 'CONNECTION_ERROR' })
            return
        }

        if (validateRoomQuery.isPending) {
            send({ type: 'VALIDATING' })
        }

        if (validateRoomQuery.isError) {
            send({
                type:
                    validateRoomQuery.error instanceof ApiError && validateRoomQuery.error.status === 404
                        ? 'ROOM_NOT_FOUND'
                        : 'CONNECTION_ERROR',
            })
        }

        if (validateRoomQuery.isSuccess && !wsRef.current) {
            send({ type: 'CONNECTING' })
        }
    }, [
        localPlayerId,
        roomCode,
        send,
        validateRoomQuery.error,
        validateRoomQuery.isError,
        validateRoomQuery.isPending,
        validateRoomQuery.isSuccess,
    ])

    useEffect(() => {
        if (!roomCode || !localPlayerId || !validateRoomQuery.isSuccess) return

        const ws = createWsClient(roomCode, localPlayerId)
        wsRef.current = ws

        ws.on('lobby:state', (payload) => {
            send({ type: 'LOBBY_STATE', state: payload as never })
        })
        ws.on('lobby:player_joined', (payload) => {
            const { player } = payload as { player: LobbyPlayer }
            send({ type: 'PLAYER_JOINED', player })
        })
        ws.on('lobby:player_ready', (payload) => {
            const { playerId } = payload as { playerId: string }
            send({ type: 'PLAYER_READY', playerId, isReady: true })
        })
        ws.on('lobby:player_unready', (payload) => {
            const { playerId } = payload as { playerId: string }
            send({ type: 'PLAYER_READY', playerId, isReady: false })
        })
        ws.on('lobby:player_disconnected', (payload) => {
            const { playerId, hostPlayerId } = payload as {
                playerId: string
                hostPlayerId: string
            }
            send({ type: 'PLAYER_DISCONNECTED', playerId, hostPlayerId })
        })
        ws.on('lobby:settings_changed', (payload) => {
            const { variation, turnDurationMs } = payload as LobbySettingsPayload
            send({ type: 'SETTINGS_CHANGED', variation, turnDurationMs })
        })
        ws.on('lobby:game_starting', (payload) => {
            const { roomCode: rc } = payload as { roomCode: string }
            navigate(`/game/${rc}`)
        })

        return () => {
            ws.close()
            if (wsRef.current === ws) {
                wsRef.current = null
            }
        }
    }, [localPlayerId, navigate, roomCode, send, validateRoomQuery.isSuccess])

    function sendReady(isReady: boolean) {
        wsRef.current?.send(isReady ? 'lobby:player_unready' : 'lobby:player_ready')
    }

    function startGame() {
        wsRef.current?.send('lobby:start_game')
    }

    function updateSettings(settings: LobbySettingsPayload) {
        wsRef.current?.send('lobby:settings_changed', settings)
        send({ type: 'SETTINGS_CHANGED', ...settings })
    }

    return {
        lobby: snapshot.context.lobby,
        pageStatus: getLobbyPageStatus(snapshot.value),
        sendReady,
        startGame,
        updateSettings,
    }
}
