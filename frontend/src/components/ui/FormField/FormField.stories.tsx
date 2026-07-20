import type { Meta, StoryObj } from '@storybook/react-vite'

import { TextInput } from '../TextInput'
import { FormField } from './FormField'
import { getFormFieldDescription } from './fieldDescription'

const meta = {
    title: 'WordDash/Foundation/FormField',
    component: FormField,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    args: {
        id: 'example-field',
        label: 'Example field',
        children: <TextInput id="example-field" />,
    },
} satisfies Meta<typeof FormField>

export default meta
type Story = StoryObj<typeof meta>

export const Hint: Story = {
    render: () => (
        <div style={{ width: '22rem' }}>
            <FormField id="player-name" label="Player name" hint="Shown to other players in the room." required>
                <TextInput
                    id="player-name"
                    aria-describedby={getFormFieldDescription('player-name', true)}
                    placeholder="Riley"
                />
            </FormField>
        </div>
    ),
}

export const Error: Story = {
    render: () => (
        <div style={{ width: '22rem' }}>
            <FormField id="room-code" label="Room code" error="Enter a valid room code.">
                <TextInput
                    id="room-code"
                    invalid
                    aria-describedby={getFormFieldDescription('room-code', false, true)}
                    value="A"
                    readOnly
                />
            </FormField>
        </div>
    ),
}

export const Disabled: Story = {
    render: () => (
        <div style={{ width: '22rem' }}>
            <FormField id="locked-setting" label="Locked setting" hint="Only the host can edit this." disabled>
                <TextInput
                    id="locked-setting"
                    aria-describedby={getFormFieldDescription('locked-setting', true)}
                    value="Classic"
                    disabled
                    readOnly
                />
            </FormField>
        </div>
    ),
}
