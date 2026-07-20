import type { InputHTMLAttributes } from 'react'

import { cx } from '../../../lib/cx'
import type { ButtonSize } from '../Button'
import './TextInput.css'

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
    invalid?: boolean
    size?: ButtonSize
}

export function TextInput({
    invalid = false,
    size = 'md',
    className,
    type = 'text',
    ...props
}: TextInputProps) {
    return (
        <input
            className={cx('wd-text-input', `wd-text-input--${size}`, invalid && 'wd-text-input--invalid', className)}
            type={type}
            aria-invalid={invalid || undefined}
            {...props}
        />
    )
}
