import type { Meta, StoryObj } from '@storybook/react-vite'

import { TextInput } from './TextInput'

const meta = {
    title: 'WordDash/Foundation/TextInput',
    component: TextInput,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    args: {
        placeholder: 'Enter name',
    },
    argTypes: {
        size: { control: 'select', options: ['sm', 'md', 'lg'] },
        invalid: { control: 'boolean' },
        disabled: { control: 'boolean' },
    },
} satisfies Meta<typeof TextInput>

export default meta
type Story = StoryObj<typeof meta>

export const Sizes: Story = {
    render: () => (
        <div style={{ display: 'grid', gap: '0.75rem', width: '22rem' }}>
            <TextInput size="sm" placeholder="Small" />
            <TextInput size="md" placeholder="Medium" />
            <TextInput size="lg" placeholder="Large" />
        </div>
    ),
}

export const Invalid: Story = {
    args: {
        invalid: true,
        value: 'X',
        readOnly: true,
    },
}

export const Disabled: Story = {
    args: {
        disabled: true,
        value: 'Locked',
        readOnly: true,
    },
}

export const NarrowContainer: Story = {
    render: () => (
        <div style={{ width: '9rem' }}>
            <TextInput value="VeryLongRoomCode" readOnly />
        </div>
    ),
}
