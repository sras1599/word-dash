import type { CSSProperties, ReactNode } from 'react'

import { cx } from '../../../lib/cx'
import './SegmentedControl.css'

export type SegmentedControlOption = {
    value: string
    label: ReactNode
    disabled?: boolean
}

type SegmentedControlProps = {
    label: string
    options: SegmentedControlOption[]
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    className?: string
}

export function SegmentedControl({
    label,
    options,
    value,
    onChange,
    disabled = false,
    className,
}: SegmentedControlProps) {
    return (
        <div
            className={cx('wd-segmented-control', className)}
            role="group"
            aria-label={label}
            style={{ '--wd-segment-count': options.length } as CSSProperties}
        >
            {options.map((option) => {
                const selected = option.value === value
                const optionDisabled = disabled || option.disabled

                return (
                    <button
                        key={option.value}
                        className={cx(
                            'wd-segmented-control__button',
                            selected && 'wd-segmented-control__button--selected',
                        )}
                        type="button"
                        disabled={optionDisabled}
                        aria-pressed={selected}
                        onClick={() => onChange(option.value)}
                    >
                        <span className="wd-segmented-control__button-label">{option.label}</span>
                    </button>
                )
            })}
        </div>
    )
}
