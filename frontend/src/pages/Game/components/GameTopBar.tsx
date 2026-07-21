import { BrandLogo } from '../../../components/BrandLogo/BrandLogo'
import type { ReactNode } from 'react'

type GameTopBarProps = {
    onHome: () => void
    hud?: ReactNode
}

export function GameTopBar({ onHome, hud }: GameTopBarProps) {
    return (
        <header className="page-game__nav">
            <button className="page-game__nav-brand" type="button" onClick={onHome} aria-label="Return home">
                <BrandLogo className="page-game__nav-logo" />
            </button>

            <div className="page-game__nav-hud">{hud}</div>
            <div className="page-game__nav-utilities" aria-hidden="true" />
        </header>
    )
}
