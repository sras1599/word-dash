import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cx } from '../../../lib/cx'
import type { ButtonSize, ButtonVariant } from '../Button'
import './IconButton.css'

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
    label: string
    icon: ReactNode
    variant?: ButtonVariant
    size?: ButtonSize
}

export function IconButton({
    label,
    icon,
    variant = 'ghost',
    size = 'md',
    className,
    type = 'button',
    ...props
}: IconButtonProps) {
    return (
        <button
            className={cx('wd-icon-button', `wd-icon-button--${variant}`, `wd-icon-button--${size}`, className)}
            type={type}
            aria-label={label}
            title={props.title ?? label}
            {...props}
        >
            {icon}
        </button>
    )
}
