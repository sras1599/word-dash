import { API_BASE_URL } from './config';

export class ApiError extends Error {
    readonly status: number;

    constructor(status: number) {
        super(`HTTP ${status}`);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function get<TResponse>(path: string): Promise<TResponse> {
    const res = await fetch(`${API_BASE_URL}${path}`);
    if (!res.ok) throw new ApiError(res.status);
    return res.json() as Promise<TResponse>;
}

async function post<TBody, TResponse>(path: string, body: TBody): Promise<TResponse> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new ApiError(res.status);
    return res.json() as Promise<TResponse>;
}

type Variation = {
    wordLengths: number[];
};

type CreateRoomResponse = {
    roomCode: string;
    playerId: string;
};

export const createRoom = (name: string, variation: Variation) =>
    post<{ name: string; variation: Variation }, CreateRoomResponse>('/rooms', { name, variation });

export const joinRoom = (roomCode: string, name: string) =>
    post<{ name: string }, CreateRoomResponse>(`/rooms/${encodeURIComponent(roomCode)}/join`, { name });

export const validateRoom = (roomCode: string) =>
    get<{ roomCode: string }>(`/rooms/${encodeURIComponent(roomCode)}`);
