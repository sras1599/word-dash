import { assign, setup } from 'xstate'
import type { LobbyPlayer, LobbyState, Variation } from '../../../lib/gameTypes'
import { lobbyReducer } from './lobbyReducer'

type LobbySettingsPayload = {
    variation: Variation
    turnDurationMs: number
}

export type LobbyMachineContext = {
    lobby: LobbyState | null
}

export type LobbyMachineEvent =
    | { type: 'VALIDATING' }
    | { type: 'CONNECTING' }
    | { type: 'ROOM_NOT_FOUND' }
    | { type: 'CONNECTION_ERROR' }
    | { type: 'LOBBY_STATE'; state: LobbyState }
    | { type: 'PLAYER_JOINED'; player: LobbyPlayer }
    | { type: 'PLAYER_READY'; playerId: string; isReady: boolean }
    | { type: 'PLAYER_DISCONNECTED'; playerId: string; hostPlayerId: string }
    | ({ type: 'SETTINGS_CHANGED' } & LobbySettingsPayload)

function reduceLobbyEvent(context: LobbyMachineContext, event: LobbyMachineEvent): LobbyState | null {
    switch (event.type) {
        case 'LOBBY_STATE':
            return lobbyReducer(context.lobby, { type: 'lobby/state', state: event.state })
        case 'PLAYER_JOINED':
            return lobbyReducer(context.lobby, { type: 'lobby/playerJoined', player: event.player })
        case 'PLAYER_READY':
            return lobbyReducer(context.lobby, {
                type: 'lobby/playerReady',
                playerId: event.playerId,
                isReady: event.isReady,
            })
        case 'PLAYER_DISCONNECTED':
            return lobbyReducer(context.lobby, {
                type: 'lobby/playerDisconnected',
                playerId: event.playerId,
                hostPlayerId: event.hostPlayerId,
            })
        case 'SETTINGS_CHANGED':
            return lobbyReducer(context.lobby, {
                type: 'lobby/settingsChanged',
                variation: event.variation,
                turnDurationMs: event.turnDurationMs,
            })
        default:
            return context.lobby
    }
}

export const lobbyMachine = setup({
    types: {
        context: {} as LobbyMachineContext,
        events: {} as LobbyMachineEvent,
    },
    actions: {
        clearLobby: assign({ lobby: null }),
        reduceLobby: assign({
            lobby: ({ context, event }) => reduceLobbyEvent(context, event),
        }),
    },
}).createMachine({
    id: 'lobby',
    initial: 'idle',
    context: {
        lobby: null,
    },
    states: {
        idle: {
            on: {
                VALIDATING: { target: 'validating', actions: 'clearLobby' },
                CONNECTION_ERROR: 'connectionError',
            },
        },
        validating: {
            on: {
                CONNECTING: 'connecting',
                ROOM_NOT_FOUND: 'roomNotFound',
                CONNECTION_ERROR: 'connectionError',
            },
        },
        connecting: {
            on: {
                LOBBY_STATE: { target: 'ready', actions: 'reduceLobby' },
                ROOM_NOT_FOUND: 'roomNotFound',
                CONNECTION_ERROR: 'connectionError',
            },
        },
        ready: {
            on: {
                ROOM_NOT_FOUND: 'roomNotFound',
                CONNECTION_ERROR: 'connectionError',
                LOBBY_STATE: { actions: 'reduceLobby' },
                PLAYER_JOINED: { actions: 'reduceLobby' },
                PLAYER_READY: { actions: 'reduceLobby' },
                PLAYER_DISCONNECTED: { actions: 'reduceLobby' },
                SETTINGS_CHANGED: { actions: 'reduceLobby' },
            },
        },
        roomNotFound: {},
        connectionError: {},
    },
})

export function getLobbyPageStatus(snapshotValue: unknown): 'connecting' | 'ready' | 'room-not-found' | 'connection-error' {
    if (snapshotValue === 'ready') return 'ready'
    if (snapshotValue === 'roomNotFound') return 'room-not-found'
    if (snapshotValue === 'connectionError') return 'connection-error'
    return 'connecting'
}
