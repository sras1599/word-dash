import type { InputHTMLAttributes } from 'react'
import { Button, FormField, getFormFieldDescription, Panel, TextInput } from '../../../components/ui'

type HomeTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>

type CreateGamePanelProps = {
    nameError: string
    submitError: string
    isLoading: boolean
    nameInputProps: HomeTextInputProps
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
        <Panel className="page-home__panel" id="page-home-create-panel" aria-label="Create game form">
            <form className="page-home__form" onSubmit={onSubmit} noValidate>
                <FormField id="create-name" label="Your name" error={nameError}>
                    <TextInput
                        id="create-name"
                        data-bwignore="true"
                        invalid={!!nameError}
                        autoComplete="nickname"
                        aria-describedby={getFormFieldDescription('create-name', false, !!nameError)}
                        {...nameInputProps}
                    />
                </FormField>

                {submitError && (
                    <p className="page-home__error" role="alert">
                        {submitError}
                    </p>
                )}

                <Button className="page-home__submit" type="submit" pending={isLoading}>
                    {isLoading ? 'Creating…' : 'Create →'}
                </Button>
            </form>
        </Panel>
    )
}
