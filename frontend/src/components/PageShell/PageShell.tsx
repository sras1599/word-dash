import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

export type FloatingLetter = {
    key: string
    letter: string
    className: string
}

type PageShellProps = {
    pageClassName: string
    modifierClassName?: string
    floatingBgClassName: string
    floatingLetterClassName: string
    floatingLetters: FloatingLetter[]
    children: ReactNode
    tileLetters?: boolean
    animatedLetters?: boolean
    renderLetter?: (letter: string) => ReactNode
}

export function PageShell({
    pageClassName,
    modifierClassName,
    floatingBgClassName,
    floatingLetterClassName,
    floatingLetters,
    children,
    tileLetters = false,
    animatedLetters = false,
    renderLetter,
}: PageShellProps) {
    return (
        <div className={cx('wd-page', pageClassName, modifierClassName)}>
            <div className={cx('wd-floating-bg', floatingBgClassName)} aria-hidden="true">
                {floatingLetters.map(({ key, letter, className }) => (
                    <div
                        key={key}
                        className={cx(
                            'wd-floating-letter',
                            tileLetters && 'wd-floating-letter--tile',
                            floatingLetterClassName,
                            className,
                            animatedLetters && 'float-animation',
                        )}
                    >
                        {renderLetter ? renderLetter(letter) : letter}
                    </div>
                ))}
            </div>

            {children}
        </div>
    )
}
