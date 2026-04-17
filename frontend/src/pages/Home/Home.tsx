import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom, joinRoom } from '../../lib/api'
import { session } from '../../lib/session'
import wordDashLogo from '../../assets/word-dash-logo.svg'
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
            const roomCode = joinRoomCode.trim().toUpperCase()
            const { roomCode: rc, playerId } = await joinRoom(roomCode, joinName.trim())
            session.setPlayerId(playerId)
            session.setRoomCode(rc)
            navigate(`/lobby/${rc}`)
        } catch (err) {
            if (err instanceof Error && err.message.includes('409')) {
                setJoinNameError('That name is already taken in this room.')
            } else {
                setJoinRoomCodeError('Invalid room code. Please try again.')
            }
            setJoinLoading(false)
        }
    }

    return (
        <div className="wd-page page-home">
            <div className="wd-floating-bg page-home__floating-bg" aria-hidden="true">
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--w float-animation">
                    <span className="page-home__floating-letter-text">W</span>
                </div>
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--a float-animation">
                    <span className="page-home__floating-letter-text">A</span>
                </div>
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--d float-animation">
                    <span className="page-home__floating-letter-text">D</span>
                </div>
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--s float-animation">
                    <span className="page-home__floating-letter-text">S</span>
                </div>
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--h float-animation">
                    <span className="page-home__floating-letter-text">H</span>
                </div>
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--o float-animation">
                    <span className="page-home__floating-letter-text">O</span>
                </div>
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--r float-animation">
                    <span className="page-home__floating-letter-text">R</span>
                </div>
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--d2 float-animation">
                    <span className="page-home__floating-letter-text">D</span>
                </div>
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--a2 float-animation">
                    <span className="page-home__floating-letter-text">A</span>
                </div>
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--s2 float-animation">
                    <span className="page-home__floating-letter-text">S</span>
                </div>
                <div className="wd-floating-letter wd-floating-letter--tile page-home__floating-letter page-home__floating-letter--h2 float-animation">
                    <span className="page-home__floating-letter-text">H</span>
                </div>
            </div>

            <main className="wd-content-layer page-home__main">
                <section className="page-home__hero" aria-labelledby="page-home-title">
                    <div className="page-home__hero-title-wrap">
                        <span className="page-home__hero-orb page-home__hero-orb--primary" aria-hidden="true" />
                        <span className="page-home__hero-orb page-home__hero-orb--secondary" aria-hidden="true" />
                        <h1 className="page-home__hero-title" id="page-home-title">
                            <img
                                src={wordDashLogo}
                                alt="Word Dash"
                                className="page-home__hero-logo"
                            />
                        </h1>
                    </div>

                    <p className="page-home__hero-tagline">
                        Experience wordplay at the speed of thought.{' '}
                        <span className="page-home__hero-accent page-home__hero-accent--primary">
                            Kinetic
                        </span>{' '}
                        rounds,{' '}
                        <span className="page-home__hero-accent page-home__hero-accent--secondary">
                            dynamic
                        </span>{' '}
                        boards, and endless{' '}
                        <span className="page-home__hero-accent page-home__hero-accent--tertiary">
                            fun
                        </span>
                        .
                    </p>

                    <div className="page-home__cta" role="group" aria-label="Game actions">
                        <button
                            className={[
                                'wd-btn',
                                'wd-btn--lift',
                                'wd-btn--primary',
                                'page-home__cta-btn',
                                'page-home__cta-btn--primary',
                                panel === 'create' && 'page-home__cta-btn--active',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            type="button"
                            onClick={() => openPanel(panel === 'create' ? null : 'create')}
                            aria-expanded={panel === 'create'}
                            aria-controls="page-home-create-panel"
                        >
                            Create Game
                        </button>

                        <button
                            className={[
                                'wd-btn',
                                'wd-btn--lift',
                                'page-home__cta-btn',
                                'page-home__cta-btn--secondary',
                                panel === 'join' && 'page-home__cta-btn--active',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            type="button"
                            onClick={() => openPanel(panel === 'join' ? null : 'join')}
                            aria-expanded={panel === 'join'}
                            aria-controls="page-home-join-panel"
                        >
                            Join Game
                        </button>
                    </div>

                    {panel === 'create' && (
                        <section
                            className="page-home__panel"
                            id="page-home-create-panel"
                            aria-label="Create game form"
                        >
                            <form className="page-home__form" onSubmit={handleCreateSubmit} noValidate>
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
                                    className="wd-btn wd-btn--lift wd-btn--primary page-home__submit"
                                    type="submit"
                                    disabled={createLoading}
                                >
                                    {createLoading ? 'Creating…' : 'Create →'}
                                </button>
                            </form>
                        </section>
                    )}

                    {panel === 'join' && (
                        <section
                            className="page-home__panel"
                            id="page-home-join-panel"
                            aria-label="Join game form"
                        >
                            <form className="page-home__form" onSubmit={handleJoinSubmit} noValidate>
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
                                        <p
                                            id="join-room-code-error"
                                            className="page-home__error"
                                            role="alert"
                                        >
                                            {joinRoomCodeError}
                                        </p>
                                    )}
                                </div>

                                <button
                                    className="wd-btn wd-btn--lift wd-btn--primary page-home__submit"
                                    type="submit"
                                    disabled={joinLoading}
                                >
                                    {joinLoading ? 'Joining…' : 'Join →'}
                                </button>
                            </form>
                        </section>
                    )}
                </section>
            </main>
        </div>
    )
}
