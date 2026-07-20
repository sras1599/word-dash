import { forwardRef, type HTMLAttributes } from 'react'

import { cx } from '../../../lib/cx'
import './Panel.css'

type PanelDensity = 'compact' | 'comfortable'
type PanelElevation = 'flat' | 'raised' | 'elevated'

type PanelProps = HTMLAttributes<HTMLDivElement> & {
    density?: PanelDensity
    elevation?: PanelElevation
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
    {
        density = 'comfortable',
        elevation = 'raised',
        className,
        children,
        ...props
    },
    ref,
) {
    return (
        <div
            ref={ref}
            className={cx(
                'wd-panel',
                `wd-panel--${density}`,
                elevation !== 'raised' && `wd-panel--${elevation}`,
                className,
            )}
            {...props}
        >
            {children}
        </div>
    )
})

export type { PanelDensity, PanelElevation }
