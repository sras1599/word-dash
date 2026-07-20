import { WS_BASE_URL } from './config';

export type GameEventMeta = {
    serverNowMs: number
    turn: { sequence: number; endsAtMs: number; durationMs: number } | null
}

type MessageHandler = (payload: unknown, meta?: GameEventMeta) => void;

const MAX_RETRIES = 5;

export class WsClient {
    private ws: WebSocket | null = null;
    private handlers = new Map<string, Set<MessageHandler>>();
    private attempt = 0;
    private closed = false;
    private hasOpened = false;
    private readonly url: string;
    private queue: Array<{ event: string; data: string }> = [];

    constructor(url: string) {
        this.url = url;
        this.connect();
    }

    private connect() {
        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
            this.attempt = 0;
            this.hasOpened = true;
            // Flush any messages that were sent before the connection was open.
            for (const message of this.queue) {
                ws.send(message.data);
            }
            this.queue = [];
        };

        ws.onmessage = (event: MessageEvent<string>) => {
            const msg = JSON.parse(event.data) as { event: string; payload: unknown; meta?: GameEventMeta };
            this.handlers.get(msg.event)?.forEach((h) => h(msg.payload, msg.meta));
        };

        ws.onclose = (closeEvent) => {
            // Gameplay actions are not idempotent, so never carry them into a
            // new connection generation. The reconnect snapshot is authoritative.
            this.queue = this.queue.filter(({ event }) => !event.startsWith('game:'))
            if (!this.closed && !closeEvent.wasClean && this.attempt < MAX_RETRIES) {
                const delay = 100 * Math.pow(2, this.attempt);
                this.attempt++;
                setTimeout(() => this.connect(), delay);
            }
        };
    }

    send(event: string, payload?: unknown): boolean {
        const data = JSON.stringify({ event, payload });
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(data);
            return true;
        } else {
            if (this.hasOpened && event.startsWith('game:')) return false;
            this.queue.push({ event, data });
            return true;
        }
    }

    on(event: string, handler: MessageHandler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event)!.add(handler);
    }

    off(event: string, handler: MessageHandler) {
        this.handlers.get(event)?.delete(handler);
    }

    close() {
        this.closed = true;
        this.ws?.close();
    }
}

export function createWsClient(roomCode: string, playerId: string): WsClient {
    const url = `${WS_BASE_URL}/ws?roomCode=${encodeURIComponent(roomCode)}&playerId=${encodeURIComponent(playerId)}`;
    return new WsClient(url);
}
