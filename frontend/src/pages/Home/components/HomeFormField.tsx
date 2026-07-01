import type { InputHTMLAttributes } from 'react'
import { cx } from '../../../lib/cx'

type HomeFormFieldProps = {
    id: string
    label: string
    error: string
    inputProps: InputHTMLAttributes<HTMLInputElement>
    autoComplete?: string
    autoCapitalize?: string
}

export function HomeFormField({
    id,
    label,
    error,
    inputProps,
    autoComplete,
    autoCapitalize,
}: HomeFormFieldProps) {
    const errorId = `${id}-error`

    return (
        <div className="page-home__field">
            <label className="page-home__label" htmlFor={id}>
                {label}
            </label>
            <input
                id={id}
                className={cx('page-home__input', error && 'page-home__input--error')}
                type="text"
                autoComplete={autoComplete}
                autoCapitalize={autoCapitalize}
                aria-describedby={error ? errorId : undefined}
                aria-invalid={!!error}
                {...inputProps}
            />
            {error && (
                <p id={errorId} className="page-home__error" role="alert">
                    {error}
                </p>
            )}
        </div>
    )
}
