import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Icon } from '../../Icon/Icon'
import { IconButton } from './IconButton'

const meta = {
    title: 'WordDash/Foundation/IconButton',
    component: IconButton,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    args: {
        label: 'Adjust setting',
        icon: <Icon name="settings" />,
        onClick: fn(),
    },
    argTypes: {
        variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
        size: { control: 'select', options: ['sm', 'md', 'lg'] },
        disabled: { control: 'boolean' },
    },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <IconButton label="Primary settings" icon={<Icon name="settings" />} variant="primary" />
            <IconButton label="Secondary timer" icon={<Icon name="timer" />} variant="secondary" />
            <IconButton label="Ghost help" icon={<Icon name="help" />} variant="ghost" />
            <IconButton label="Danger clear" icon={<Icon name="clear" />} variant="danger" />
        </div>
    ),
}

export const Sizes: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <IconButton label="Small minus" icon={<Icon name="minus" />} size="sm" />
            <IconButton label="Medium plus" icon={<Icon name="plus" />} size="md" />
            <IconButton label="Large check" icon={<Icon name="check" />} size="lg" />
        </div>
    ),
}

export const Disabled: Story = {
    args: {
        disabled: true,
    },
}
