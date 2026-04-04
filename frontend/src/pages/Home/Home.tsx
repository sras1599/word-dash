import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom } from '../../lib/api'
import { session } from '../../lib/session'
import './Home.css'

type Panel = 'create' | 'join' | null

export function Home() {
    const navigate = useNavigate()
    const [panel, setPanel] = useState<Panel>(null)

    // Create Game form state
    const [createName, setCreateName] = useState('')
    const [createNameError, setCreateNameError] = useState('')
    const [createLoading, setCreateLoading] = useState(false)

    // Join Game form state
    const [joinName, setJoinName] = useState('')
    const [joinRoomCode, setJoinRoomCode] = useState('')
    const [joinNameError, setJoinNameError] = useState('')
    const [joinRoomCodeError, setJoinRoomCodeError] = useState('')
    const [joinLoading, setJoinLoading] = useState(false)

    function openPanel(next: Panel) {
        setPanel(next)
        setCreateName('')
        setCreateNameError('')
        setJoinName('')
        setJoinRoomCode('')
        setJoinNameError('')
        setJoinRoomCodeError('')
    }

    const handleCreateSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault()
        setCreateNameError('')

        if (!createName.trim()) {
            setCreateNameError('Name is required.')
            return
        }

        setCreateLoading(true)
        try {
            const { roomCode, playerId } = await createRoom(createName.trim(), { wordLengths: [3, 4, 5] })
            session.setPlayerId(playerId)
            session.setRoomCode(roomCode)
            navigate(`/lobby/${roomCode}`)
        } catch {
            setCreateLoading(false)
        }
    }

    const handleJoinSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault()
        setJoinNameError('')
        setJoinRoomCodeError('')

        let valid = true
        if (!joinName.trim()) {
            setJoinNameError('Name is required.')
            valid = false
        }
        if (!joinRoomCode.trim()) {
            setJoinRoomCodeError('Room code is required.')
            valid = false
        }
        if (!valid) return

        setJoinLoading(true)
        try {
            // TODO: call server to join an existing room — expects { roomCode: string; playerId: string }
            // On invalid room code the server should throw so the catch block fires
            const roomCode = joinRoomCode.trim().toUpperCase()
            navigate(`/lobby/${roomCode}`)
        } catch {
            setJoinRoomCodeError('Invalid room code. Please try again.')
            setJoinLoading(false)
        }
    }

    return (
        <main className="page-home">
            <section className="page-home__hero">
                <h1 className="page-home__logo">WordIt!</h1>
                <p className="page-home__tagline">Fun With Words</p>
            </section>

            <section className="page-home__actions">
                <button
                    className={[
                        'page-home__action-btn',
                        panel === 'create' && 'page-home__action-btn--active',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    onClick={() => openPanel(panel === 'create' ? null : 'create')}
                    aria-expanded={panel === 'create'}
                >
                    Create Game
                </button>

                <button
                    className={[
                        'page-home__action-btn',
                        panel === 'join' && 'page-home__action-btn--active',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    onClick={() => openPanel(panel === 'join' ? null : 'join')}
                    aria-expanded={panel === 'join'}
                >
                    Join Game
                </button>
            </section>

            {panel === 'create' && (
                <section className="page-home__panel" aria-label="Create game form">
                    <form onSubmit={handleCreateSubmit} noValidate>
                        <div className="page-home__field">
                            <label className="page-home__label" htmlFor="create-name">
                                Your name
                            </label>
                            <input
                                id="create-name"
                                className={[
                                    'page-home__input',
                                    createNameError && 'page-home__input--error',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                type="text"
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value)}
                                autoComplete="nickname"
                                aria-describedby={createNameError ? 'create-name-error' : undefined}
                                aria-invalid={!!createNameError}
                            />
                            {createNameError && (
                                <p id="create-name-error" className="page-home__error" role="alert">
                                    {createNameError}
                                </p>
                            )}
                        </div>

                        <button
                            className="page-home__submit"
                            type="submit"
                            disabled={createLoading}
                        >
                            {createLoading ? 'Creating…' : 'Create →'}
                        </button>
                    </form>
                </section>
            )}

            {panel === 'join' && (
                <section className="page-home__panel" aria-label="Join game form">
                    <form onSubmit={handleJoinSubmit} noValidate>
                        <div className="page-home__field">
                            <label className="page-home__label" htmlFor="join-name">
                                Your name
                            </label>
                            <input
                                id="join-name"
                                className={[
                                    'page-home__input',
                                    joinNameError && 'page-home__input--error',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                type="text"
                                value={joinName}
                                onChange={(e) => setJoinName(e.target.value)}
                                autoComplete="nickname"
                                aria-describedby={joinNameError ? 'join-name-error' : undefined}
                                aria-invalid={!!joinNameError}
                            />
                            {joinNameError && (
                                <p id="join-name-error" className="page-home__error" role="alert">
                                    {joinNameError}
                                </p>
                            )}
                        </div>

                        <div className="page-home__field">
                            <label className="page-home__label" htmlFor="join-room-code">
                                Room code
                            </label>
                            <input
                                id="join-room-code"
                                className={[
                                    'page-home__input',
                                    joinRoomCodeError && 'page-home__input--error',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                type="text"
                                value={joinRoomCode}
                                onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                                autoComplete="off"
                                autoCapitalize="characters"
                                aria-describedby={joinRoomCodeError ? 'join-room-code-error' : undefined}
                                aria-invalid={!!joinRoomCodeError}
                            />
                            {joinRoomCodeError && (
                                <p id="join-room-code-error" className="page-home__error" role="alert">
                                    {joinRoomCodeError}
                                </p>
                            )}
                        </div>

                        <button
                            className="page-home__submit"
                            type="submit"
                            disabled={joinLoading}
                        >
                            {joinLoading ? 'Joining…' : 'Join →'}
                        </button>
                    </form>
                </section>
            )}
        </main>
    )
}
