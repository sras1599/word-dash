import { type ReactNode, useEffect, useRef } from 'react'

import { Icon } from '../../Icon/Icon'
import { IconButton } from '../IconButton'
import { Panel } from '../Panel'
import './Dialog.css'

type DialogProps = {
    open: boolean
    title: ReactNode
    description?: ReactNode
    children?: ReactNode
    footer?: ReactNode
    closeLabel?: string
    onOpenChange: (open: boolean) => void
}

export function Dialog({
    open,
    title,
    description,
    children,
    footer,
    closeLabel = 'Close dialog',
    onOpenChange,
}: DialogProps) {
    const panelRef = useRef<HTMLDivElement>(null)
    const titleId = 'wd-dialog-title'
    const descriptionId = description ? 'wd-dialog-description' : undefined

    useEffect(() => {
        if (!open) {
            return
        }

        const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
        panelRef.current?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onOpenChange(false)
            }
        }

        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            previousActiveElement?.focus()
        }
    }, [onOpenChange, open])

    if (!open) {
        return null
    }

    return (
        <div className="wd-dialog" role="presentation" onMouseDown={() => onOpenChange(false)}>
            <Panel
                className="wd-dialog__panel"
                elevation="elevated"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                ref={panelRef}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="wd-dialog__header">
                    <div className="wd-dialog__heading">
                        <h2 className="wd-dialog__title" id={titleId}>
                            {title}
                        </h2>
                        {description && (
                            <p className="wd-dialog__description" id={descriptionId}>
                                {description}
                            </p>
                        )}
                    </div>
                    <IconButton label={closeLabel} icon={<Icon name="clear" />} onClick={() => onOpenChange(false)} />
                </div>
                {children && <div className="wd-dialog__body">{children}</div>}
                {footer && <div className="wd-dialog__footer">{footer}</div>}
            </Panel>
        </div>
    )
}
