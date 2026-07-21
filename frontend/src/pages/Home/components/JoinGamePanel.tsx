import type { InputHTMLAttributes } from 'react'
import { Button, FormField, getFormFieldDescription, Panel, TextInput } from '../../../components/ui'

type HomeTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>

type JoinGamePanelProps = {
    nameError: string
    roomCodeError: string
    isLoading: boolean
    nameInputProps: HomeTextInputProps
    roomCodeInputProps: HomeTextInputProps
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
        <Panel className="page-home__panel" id="page-home-join-panel" aria-label="Join game form">
            <form className="page-home__form" onSubmit={onSubmit} noValidate>
                <FormField id="join-name" label="Your name" error={nameError}>
                    <TextInput
                        id="join-name"
                        data-bwignore="true"
                        invalid={!!nameError}
                        autoComplete="nickname"
                        aria-describedby={getFormFieldDescription('join-name', false, !!nameError)}
                        {...nameInputProps}
                    />
                </FormField>

                <FormField id="join-room-code" label="Room code" error={roomCodeError}>
                    <TextInput
                        id="join-room-code"
                        data-bwignore="true"
                        invalid={!!roomCodeError}
                        autoComplete="off"
                        autoCapitalize="characters"
                        aria-describedby={getFormFieldDescription('join-room-code', false, !!roomCodeError)}
                        {...roomCodeInputProps}
                    />
                </FormField>

                <Button className="page-home__submit" type="submit" pending={isLoading}>
                    {isLoading ? 'Joining…' : 'Join →'}
                </Button>
            </form>
        </Panel>
    )
}
