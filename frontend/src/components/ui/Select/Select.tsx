import type { SelectHTMLAttributes } from 'react'

import { cx } from '../../../lib/cx'
import './Select.css'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
    invalid?: boolean
}

export function Select({ invalid = false, className, ...props }: SelectProps) {
    return (
        <select
            className={cx('wd-select', invalid && 'wd-select--invalid', className)}
            aria-invalid={invalid || undefined}
            {...props}
        />
    )
}
