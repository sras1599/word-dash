import type { Meta, StoryObj } from '@storybook/react-vite'

import { Select } from './Select'

const meta = {
    title: 'WordDash/Foundation/Select',
    component: Select,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        invalid: { control: 'boolean' },
        disabled: { control: 'boolean' },
    },
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: (args) => (
        <div style={{ width: '18rem' }}>
            <Select {...args} defaultValue="classic">
                <option value="classic">Classic</option>
                <option value="quick">Quick round</option>
                <option value="custom">Custom</option>
            </Select>
        </div>
    ),
}

export const Invalid: Story = {
    args: {
        invalid: true,
    },
    render: (args) => (
        <div style={{ width: '18rem' }}>
            <Select {...args} defaultValue="">
                <option value="">Choose a mode</option>
                <option value="classic">Classic</option>
            </Select>
        </div>
    ),
}
