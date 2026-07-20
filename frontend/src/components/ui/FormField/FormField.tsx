import type { ReactNode } from 'react'

import { cx } from '../../../lib/cx'
import './FormField.css'

type FormFieldProps = {
    id: string
    label: ReactNode
    children: ReactNode
    hint?: ReactNode
    error?: ReactNode
    required?: boolean
    disabled?: boolean
    className?: string
}

export function FormField({
    id,
    label,
    children,
    hint,
    error,
    required = false,
    disabled = false,
    className,
}: FormFieldProps) {
    const hintId = hint ? `${id}-hint` : undefined
    const errorId = error ? `${id}-error` : undefined

    return (
        <div className={cx('wd-form-field', disabled && 'wd-form-field--disabled', className)}>
            <label className="wd-form-field__label" htmlFor={id}>
                {label}
                {required && (
                    <span className="wd-form-field__required" aria-hidden="true">
                        {' '}
                        *
                    </span>
                )}
            </label>
            {children}
            {hint && !error && (
                <p className="wd-form-field__hint" id={hintId}>
                    {hint}
                </p>
            )}
            {error && (
                <p className="wd-form-field__error" id={errorId} role="alert">
                    {error}
                </p>
            )}
        </div>
    )
}
