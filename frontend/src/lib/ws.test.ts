import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WsClient } from './ws'

class FakeWebSocket {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSED = 3
    static instances: FakeWebSocket[] = []

    readyState = FakeWebSocket.CONNECTING
    sent: string[] = []
    onopen: (() => void) | null = null
    onmessage: ((event: MessageEvent<string>) => void) | null = null
    onclose: ((event: CloseEvent) => void) | null = null
    readonly url: string

    constructor(url: string) {
        this.url = url
        FakeWebSocket.instances.push(this)
    }

    open() {
        this.readyState = FakeWebSocket.OPEN
        this.onopen?.()
    }

    disconnect() {
        this.readyState = FakeWebSocket.CLOSED
        this.onclose?.({ wasClean: false } as CloseEvent)
    }

    send(data: string) {
        this.sent.push(data)
    }

    close() {
        this.readyState = FakeWebSocket.CLOSED
    }
}

describe('WsClient reconnect queue', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        FakeWebSocket.instances = []
        vi.stubGlobal('WebSocket', FakeWebSocket)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('sends initial queued actions but never carries gameplay mutations across reconnect', () => {
        const client = new WsClient('ws://example.test')
        const first = FakeWebSocket.instances[0]

        expect(client.send('game:place_card', { cardId: 'card-a' })).toBe(true)
        first.open()
        expect(first.sent).toHaveLength(1)

        first.disconnect()
        expect(client.send('game:place_card', { cardId: 'card-b' })).toBe(false)
        vi.advanceTimersByTime(100)

        const second = FakeWebSocket.instances[1]
        second.open()
        expect(second.sent).toEqual([])
        client.close()
    })
})
