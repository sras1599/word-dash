import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import type { LobbyState } from '../../../lib/gameTypes'
import { getLobbyPageStatus, lobbyMachine } from './lobbyMachine'

const lobbyState: LobbyState = {
    roomCode: 'ABCD',
    hostPlayerId: 'p1',
    variation: { wordLengths: [3, 4, 5] },
    turnDurationMs: 90_000,
    players: [{ id: 'p1', name: 'Host', isReady: false, isConnected: true }],
}

describe('lobbyMachine', () => {
    it('moves from validation to ready with lobby context', () => {
        const actor = createActor(lobbyMachine).start()
        actor.send({ type: 'VALIDATING' })
        actor.send({ type: 'CONNECTING' })
        actor.send({ type: 'LOBBY_STATE', state: lobbyState })

        expect(actor.getSnapshot().matches('ready')).toBe(true)
        expect(actor.getSnapshot().context.lobby?.roomCode).toBe('ABCD')
        expect(getLobbyPageStatus(actor.getSnapshot().value)).toBe('ready')
    })

    it('maps validation errors to page statuses', () => {
        const actor = createActor(lobbyMachine).start()
        actor.send({ type: 'VALIDATING' })
        actor.send({ type: 'ROOM_NOT_FOUND' })

        expect(getLobbyPageStatus(actor.getSnapshot().value)).toBe('room-not-found')
    })

    it('keeps ready lobby state when validation events arrive after the socket state', () => {
        const actor = createActor(lobbyMachine).start()
        actor.send({ type: 'VALIDATING' })
        actor.send({ type: 'CONNECTING' })
        actor.send({ type: 'LOBBY_STATE', state: lobbyState })

        actor.send({ type: 'VALIDATING' })
        actor.send({ type: 'CONNECTING' })

        expect(actor.getSnapshot().matches('ready')).toBe(true)
        expect(actor.getSnapshot().context.lobby).toEqual(lobbyState)
    })
})
