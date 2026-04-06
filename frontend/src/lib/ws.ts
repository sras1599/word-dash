import { WS_BASE_URL } from './config';

type MessageHandler = (payload: unknown) => void;

const MAX_RETRIES = 5;

export class WsClient {
    private ws: WebSocket | null = null;
    private handlers = new Map<string, Set<MessageHandler>>();
    private attempt = 0;
    private closed = false;
    private readonly url: string;
    private queue: string[] = [];

    constructor(url: string) {
        this.url = url;
        this.connect();
    }

    private connect() {
        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
            this.attempt = 0;
            // Flush any messages that were sent before the connection was open.
            for (const msg of this.queue) {
                ws.send(msg);
            }
            this.queue = [];
        };

        ws.onmessage = (event: MessageEvent<string>) => {
            const msg = JSON.parse(event.data) as { event: string; payload: unknown };
            this.handlers.get(msg.event)?.forEach((h) => h(msg.payload));
        };

        ws.onclose = (closeEvent) => {
            if (!this.closed && !closeEvent.wasClean && this.attempt < MAX_RETRIES) {
                const delay = 100 * Math.pow(2, this.attempt);
                this.attempt++;
                setTimeout(() => this.connect(), delay);
            }
        };
    }

    send(event: string, payload?: unknown) {
        const data = JSON.stringify({ event, payload });
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        } else {
            this.queue.push(data);
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
