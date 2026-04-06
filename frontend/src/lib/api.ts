import { API_BASE_URL } from './config';

async function post<TBody, TResponse>(path: string, body: TBody): Promise<TResponse> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
