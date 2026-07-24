import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse, ws } from 'msw'
import { expect } from 'storybook/test'
import { API_BASE_URL, WS_BASE_URL } from '../../lib/config'
import { Lobby } from './Lobby'

// ---------------------------------------------------------------------------
// MSW WebSocket link — intercepts the connection Lobby opens on mount
// ---------------------------------------------------------------------------
const lobbyWs = ws.link(`${WS_BASE_URL}/ws`)
const roomExists = http.get(`${API_BASE_URL}/rooms/ABC123`, () =>
    HttpResponse.json({ roomCode: 'ABC123' }),
)

// ---------------------------------------------------------------------------
// Shared lobby state shapes
// ---------------------------------------------------------------------------
type LobbyState = {
    roomCode: string
    hostPlayerId: string
    variation: { wordLengths: number[] }
    turnDurationMs: number
    players: {
        id: string
        name: string
        isConnected: boolean
    }[]
}

function sendState(client: Parameters<Parameters<typeof lobbyWs.addEventListener<'connection'>>[1]>[0]['client'], state: LobbyState) {
    client.send(JSON.stringify({ event: 'lobby:state', payload: state }))
}

const BASE_STATE: LobbyState = {
    roomCode: 'ABC123',
    hostPlayerId: 'p1',
    variation: { wordLengths: [3, 4, 5] },
    turnDurationMs: 90_000,
    players: [],
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------
const meta = {
    title: 'WordDash/Pages/Lobby',
    component: Lobby,
    parameters: {
        layout: 'fullscreen',
    },
    decorators: [
        (Story) => {
            // Seed sessionStorage so Lobby knows the local player id
            sessionStorage.setItem('wordit_playerId', 'p1')
            return (
                <MemoryRouter initialEntries={['/lobby/ABC123']}>
                    <Routes>
                        <Route path="/lobby/:roomCode" element={<Story />} />
                        <Route path="/game/:roomCode" element={<div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>→ Game</div>} />
                        <Route path="/" element={<div>Home page</div>} />
                    </Routes>
                </MemoryRouter>
            )
        },
    ],
} satisfies Meta<typeof Lobby>

export default meta
type Story = StoryObj<typeof meta>

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Connecting — no lobby:state received yet (loading skeleton). */
export const Connecting: Story = {
    parameters: {
        msw: {
            handlers: [
                roomExists,
                lobbyWs.addEventListener('connection', () => {
                    // intentionally send nothing — keeps the "Connecting…" state
                }),
            ],
        },
    },
}

/** Host view — one player in the room, waiting for others to join. */
export const HostWaiting: Story = {
    parameters: {
        msw: {
            handlers: [
                roomExists,
                lobbyWs.addEventListener('connection', ({ client }) => {
                    sendState(client, {
                        ...BASE_STATE,
                        players: [
                            { id: 'p1', name: 'Alice', isConnected: true },
                        ],
                    })
                }),
            ],
        },
    },
    play: async ({ canvas }) => {
        await expect(await canvas.findByRole('button', { name: 'Start →' })).toBeDisabled()
        await expect(await canvas.findByText('Need at least 2 players to start.')).toBeInTheDocument()
        await expect(canvas.queryByRole('button', { name: /^ready$/i })).not.toBeInTheDocument()
    },
}

/** Host view — two players joined, so Start is enabled. */
export const TwoPlayers: Story = {
    parameters: {
        msw: {
            handlers: [
                roomExists,
                lobbyWs.addEventListener('connection', ({ client }) => {
                    sendState(client, {
                        ...BASE_STATE,
                        players: [
                            { id: 'p1', name: 'Alice', isConnected: true },
                            { id: 'p2', name: 'Bob', isConnected: true },
                        ],
                    })
                }),
            ],
        },
    },
    play: async ({ canvas }) => {
        await expect(await canvas.findByRole('button', { name: 'Start →' })).toBeEnabled()
        await expect(await canvas.findByText('Ready to begin.')).toBeInTheDocument()
        await expect(canvas.queryByText('Not Ready')).not.toBeInTheDocument()
    },
}

/** Full room — four players. */
export const FullRoom: Story = {
    parameters: {
        msw: {
            handlers: [
                roomExists,
                lobbyWs.addEventListener('connection', ({ client }) => {
                    sendState(client, {
                        ...BASE_STATE,
                        players: [
                            { id: 'p1', name: 'Alice', isConnected: true },
                            { id: 'p2', name: 'Bob', isConnected: true },
                            { id: 'p3', name: 'Carol', isConnected: true },
                            { id: 'p4', name: 'Dave', isConnected: true },
                        ],
                    })
                }),
            ],
        },
    },
}

/** Guest view — local player is not the host; settings are read-only, no Start button. */
export const GuestView: Story = {
    decorators: [
        (Story) => {
            sessionStorage.setItem('wordit_playerId', 'p2')
            return <Story />
        },
    ],
    parameters: {
        msw: {
            handlers: [
                roomExists,
                lobbyWs.addEventListener('connection', ({ client }) => {
                    sendState(client, {
                        ...BASE_STATE,
                        players: [
                            { id: 'p1', name: 'Alice', isConnected: true },
                            { id: 'p2', name: 'Bob', isConnected: true },
                        ],
                    })
                }),
            ],
        },
    },
    play: async ({ canvas }) => {
        await canvas.findByText('You')
        await expect(canvas.queryByRole('button', { name: 'Start →' })).not.toBeInTheDocument()
        await expect(canvas.queryByRole('button', { name: /^ready$/i })).not.toBeInTheDocument()
    },
}

/** A player in the room has disconnected — their card shows the disconnected state. */
export const PlayerDisconnected: Story = {
    parameters: {
        msw: {
            handlers: [
                roomExists,
                lobbyWs.addEventListener('connection', ({ client }) => {
                    sendState(client, {
                        ...BASE_STATE,
                        players: [
                            { id: 'p1', name: 'Alice', isConnected: true },
                            { id: 'p2', name: 'Bob', isConnected: false },
                        ],
                    })
                }),
            ],
        },
    },
}

/** Missing room — explain what happened and provide a route back home. */
export const RoomNotFound: Story = {
    parameters: {
        msw: {
            handlers: [
                http.get(`${API_BASE_URL}/rooms/ABC123`, () =>
                    HttpResponse.json({ error: 'room not found' }, { status: 404 }),
                ),
            ],
        },
    },
    play: async ({ canvas, userEvent }) => {
        const heading = await canvas.findByRole('heading', { name: 'Room not found' })
        await expect(heading).toBeInTheDocument()
        await userEvent.click(canvas.getByRole('button', { name: 'Go to home' }))
        const homePage = await canvas.findByText('Home page')
        await expect(homePage).toBeInTheDocument()
    },
}
