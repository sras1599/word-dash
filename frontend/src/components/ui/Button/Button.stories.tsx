import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowRight, Check } from 'lucide-react'
import { fn } from 'storybook/test'

import { Button } from './Button'

const meta = {
    title: 'WordDash/Foundation/Button',
    component: Button,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    args: {
        children: 'Create Game',
        onClick: fn(),
    },
    argTypes: {
        variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
        size: { control: 'select', options: ['sm', 'md', 'lg'] },
        pending: { control: 'boolean' },
        disabled: { control: 'boolean' },
    },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
        </div>
    ),
}

export const Sizes: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
        </div>
    ),
}

export const WithIcons: Story = {
    args: {
        leadingIcon: <Check />,
        trailingIcon: <ArrowRight />,
        children: 'Ready',
    },
}

export const Pending: Story = {
    args: {
        pending: true,
        children: 'Creating...',
    },
}

export const Disabled: Story = {
    args: {
        disabled: true,
        children: 'Start Game',
    },
}

export const NarrowContainer: Story = {
    render: () => (
        <div style={{ width: '10rem' }}>
            <Button size="lg">A Very Long Button Label</Button>
        </div>
    ),
}
