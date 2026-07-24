import { produce } from 'immer'
import type { LobbyPlayer, LobbyState, Variation } from '../../../lib/gameTypes'

export type LobbyAction =
    | { type: 'lobby/state'; state: LobbyState | null }
    | { type: 'lobby/playerJoined'; player: LobbyPlayer }
    | { type: 'lobby/playerDisconnected'; playerId: string; hostPlayerId: string }
    | { type: 'lobby/settingsChanged'; variation: Variation; turnDurationMs: number }

export function lobbyReducer(state: LobbyState | null, action: LobbyAction): LobbyState | null {
    if (action.type === 'lobby/state') return action.state
    if (!state) return state

    return produce(state, (draft) => {
        switch (action.type) {
            case 'lobby/playerJoined': {
                const existingIndex = draft.players.findIndex((player) => player.id === action.player.id)
                if (existingIndex === -1) {
                    draft.players.push(action.player)
                } else {
                    draft.players[existingIndex] = action.player
                }
                break
            }
            case 'lobby/playerDisconnected':
                draft.hostPlayerId = action.hostPlayerId
                draft.players = draft.players.filter((player) => player.id !== action.playerId)
                break
            case 'lobby/settingsChanged':
                draft.variation = action.variation
                draft.turnDurationMs = action.turnDurationMs
                break
        }
    })
}
