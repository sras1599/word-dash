import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '../Button'
import { Panel } from './Panel'

const meta = {
    title: 'WordDash/Foundation/Panel',
    component: Panel,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        density: { control: 'select', options: ['compact', 'comfortable'] },
        elevation: { control: 'select', options: ['flat', 'raised', 'elevated'] },
    },
} satisfies Meta<typeof Panel>

export default meta
type Story = StoryObj<typeof meta>

export const Densities: Story = {
    render: () => (
        <div style={{ display: 'grid', gap: '1rem', width: '26rem' }}>
            <Panel density="compact">
                <strong>Compact panel</strong>
                <p style={{ marginTop: '0.5rem' }}>Useful for repeated items and dense settings.</p>
            </Panel>
            <Panel density="comfortable">
                <strong>Comfortable panel</strong>
                <p style={{ marginTop: '0.5rem' }}>Useful for focused tools and form shells.</p>
            </Panel>
        </div>
    ),
}

export const Elevations: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Panel elevation="flat">Flat</Panel>
            <Panel elevation="raised">Raised</Panel>
            <Panel elevation="elevated">Elevated</Panel>
        </div>
    ),
}

export const FramedTool: Story = {
    render: () => (
        <Panel style={{ width: '22rem' }}>
            <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                    <strong>Room Settings</strong>
                    <p style={{ marginTop: '0.35rem', color: 'var(--wd-text-muted)' }}>Round timing and word lengths.</p>
                </div>
                <Button>Apply</Button>
            </div>
        </Panel>
    ),
}

export const NarrowContainer: Story = {
    render: () => (
        <div style={{ width: '12rem' }}>
            <Panel density="compact">
                <strong>Long Player Name That Wraps</strong>
            </Panel>
        </div>
    ),
}
