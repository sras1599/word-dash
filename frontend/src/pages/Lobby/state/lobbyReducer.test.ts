import { describe, expect, it } from 'vitest'
import type { LobbyState } from '../../../lib/gameTypes'
import { lobbyReducer } from './lobbyReducer'

const initialLobby: LobbyState = {
    roomCode: 'ABCD',
    hostPlayerId: 'p1',
    variation: { wordLengths: [3, 4, 5] },
    turnDurationMs: 90_000,
    players: [
        { id: 'p1', name: 'Host', isConnected: true },
        { id: 'p2', name: 'Guest', isConnected: true },
    ],
}

describe('lobbyReducer', () => {
    it('upserts joined players', () => {
        const joined = lobbyReducer(initialLobby, {
            type: 'lobby/playerJoined',
            player: { id: 'p3', name: 'New', isConnected: true },
        })

        expect(joined?.players.map((player) => player.id)).toEqual(['p1', 'p2', 'p3'])

        const updated = lobbyReducer(joined, {
            type: 'lobby/playerJoined',
            player: { id: 'p3', name: 'Renamed', isConnected: true },
        })

        expect(updated?.players).toHaveLength(3)
        expect(updated?.players[2]).toMatchObject({ name: 'Renamed', isConnected: true })
    })

    it('removes disconnected players and updates the host', () => {
        const disconnected = lobbyReducer(initialLobby, {
            type: 'lobby/playerDisconnected',
            playerId: 'p1',
            hostPlayerId: 'p2',
        })

        expect(disconnected?.hostPlayerId).toBe('p2')
        expect(disconnected?.players.map((player) => player.id)).toEqual(['p2'])
    })

    it('updates settings', () => {
        const next = lobbyReducer(initialLobby, {
            type: 'lobby/settingsChanged',
            variation: { wordLengths: [5, 6] },
            turnDurationMs: 120_000,
        })

        expect(next?.variation.wordLengths).toEqual([5, 6])
        expect(next?.turnDurationMs).toBe(120_000)
    })
})
