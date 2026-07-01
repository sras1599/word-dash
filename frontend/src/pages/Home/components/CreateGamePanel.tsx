import type { InputHTMLAttributes } from 'react'
import { HomeFormField } from './HomeFormField'

type CreateGamePanelProps = {
    nameError: string
    submitError: string
    isLoading: boolean
    nameInputProps: InputHTMLAttributes<HTMLInputElement>
    onSubmit: () => void
}

export function CreateGamePanel({
    nameError,
    submitError,
    isLoading,
    nameInputProps,
    onSubmit,
}: CreateGamePanelProps) {
    return (
        <section className="page-home__panel" id="page-home-create-panel" aria-label="Create game form">
            <form className="page-home__form" onSubmit={onSubmit} noValidate>
                <HomeFormField
                    id="create-name"
                    label="Your name"
                    error={nameError}
                    inputProps={nameInputProps}
                    autoComplete="nickname"
                />

                {submitError && (
                    <p className="page-home__error" role="alert">
                        {submitError}
                    </p>
                )}

                <button className="wd-btn wd-btn--lift wd-btn--primary page-home__submit" type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating…' : 'Create →'}
                </button>
            </form>
        </section>
    )
}
