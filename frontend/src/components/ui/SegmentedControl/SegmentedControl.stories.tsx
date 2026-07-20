import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { SegmentedControl } from './SegmentedControl'

const OPTIONS = [
    { value: 'classic', label: 'Classic' },
    { value: 'speed', label: 'Speed' },
    { value: 'custom', label: 'Custom' },
    { value: 'locked', label: 'Locked', disabled: true },
]

function SegmentedControlDemo() {
    const [value, setValue] = useState('classic')

    return (
        <div style={{ width: '32rem' }}>
            <SegmentedControl label="Variation" options={OPTIONS} value={value} onChange={setValue} />
        </div>
    )
}

const meta = {
    title: 'WordDash/Foundation/SegmentedControl',
    component: SegmentedControl,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    args: {
        label: 'Variation',
        options: OPTIONS,
        value: 'classic',
        onChange: fn(),
    },
    argTypes: {
        disabled: { control: 'boolean' },
    },
} satisfies Meta<typeof SegmentedControl>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
    render: () => <SegmentedControlDemo />,
}

export const Disabled: Story = {
    args: {
        disabled: true,
    },
}

export const NarrowContainer: Story = {
    render: () => (
        <div style={{ width: '13rem' }}>
            <SegmentedControl
                label="Compact variation"
                options={[
                    { value: 'long', label: 'Very Long Label' },
                    { value: 'short', label: 'Short' },
                ]}
                value="long"
                onChange={fn()}
            />
        </div>
    ),
}
