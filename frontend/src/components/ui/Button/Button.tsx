import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cx } from '../../../lib/cx'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    size?: ButtonSize
    pending?: boolean
    leadingIcon?: ReactNode
    trailingIcon?: ReactNode
}

export function Button({
    variant = 'primary',
    size = 'md',
    pending = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...props
}: ButtonProps) {
    return (
        <button
            className={cx(
                'wd-button',
                `wd-button--${variant}`,
                `wd-button--${size}`,
                pending && 'wd-button--pending',
                className,
            )}
            type={type}
            disabled={disabled || pending}
            aria-busy={pending || undefined}
            {...props}
        >
            {leadingIcon && <span className="wd-button__icon wd-button__icon--leading">{leadingIcon}</span>}
            <span className="wd-button__label">{children}</span>
            {trailingIcon && <span className="wd-button__icon wd-button__icon--trailing">{trailingIcon}</span>}
        </button>
    )
}
