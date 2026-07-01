import type { InputHTMLAttributes } from 'react'
import { HomeFormField } from './HomeFormField'

type JoinGamePanelProps = {
    nameError: string
    roomCodeError: string
    isLoading: boolean
    nameInputProps: InputHTMLAttributes<HTMLInputElement>
    roomCodeInputProps: InputHTMLAttributes<HTMLInputElement>
    onSubmit: () => void
}

export function JoinGamePanel({
    nameError,
    roomCodeError,
    isLoading,
    nameInputProps,
    roomCodeInputProps,
    onSubmit,
}: JoinGamePanelProps) {
    return (
        <section className="page-home__panel" id="page-home-join-panel" aria-label="Join game form">
            <form className="page-home__form" onSubmit={onSubmit} noValidate>
                <HomeFormField
                    id="join-name"
                    label="Your name"
                    error={nameError}
                    inputProps={nameInputProps}
                    autoComplete="nickname"
                />

                <HomeFormField
                    id="join-room-code"
                    label="Room code"
                    error={roomCodeError}
                    inputProps={roomCodeInputProps}
                    autoComplete="off"
                    autoCapitalize="characters"
                />

                <button className="wd-btn wd-btn--lift wd-btn--primary page-home__submit" type="submit" disabled={isLoading}>
                    {isLoading ? 'Joining…' : 'Join →'}
                </button>
            </form>
        </section>
    )
}
