import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Button } from '../Button'
import { Dialog } from './Dialog'

function DialogDemo({ initiallyOpen = true }: { initiallyOpen?: boolean }) {
    const [open, setOpen] = useState(initiallyOpen)

    return (
        <>
            <Button onClick={() => setOpen(true)}>Open dialog</Button>
            <Dialog
                open={open}
                title="Round Complete"
                description="Review the winning words before starting another match."
                onOpenChange={setOpen}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                        <Button onClick={() => setOpen(false)}>Play Again</Button>
                    </>
                }
            >
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <strong>Winner: Riley</strong>
                    <p style={{ margin: 0, color: 'var(--wd-text-muted)' }}>Best word: DASH</p>
                </div>
            </Dialog>
        </>
    )
}

const meta = {
    title: 'WordDash/Foundation/Dialog',
    component: Dialog,
    parameters: {
        layout: 'fullscreen',
    },
    tags: ['autodocs'],
    args: {
        open: true,
        title: 'Dialog',
        onOpenChange: fn(),
    },
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
    render: () => <DialogDemo />,
}

export const ClosedTrigger: Story = {
    render: () => (
        <div style={{ padding: '2rem' }}>
            <DialogDemo initiallyOpen={false} />
        </div>
    ),
}

export const NarrowContent: Story = {
    render: () => (
        <div style={{ '--wd-dialog-width': '18rem' } as CSSProperties}>
            <DialogDemo />
        </div>
    ),
}
