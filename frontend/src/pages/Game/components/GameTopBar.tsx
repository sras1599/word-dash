import { BrandLogo } from '../../../components/BrandLogo/BrandLogo'

type GameTopBarProps = {
    onHome: () => void
}

export function GameTopBar({ onHome }: GameTopBarProps) {
    return (
        <nav className="page-game__nav" aria-label="Game navigation">
            <button className="page-game__nav-brand" type="button" onClick={onHome} aria-label="Return home">
                <BrandLogo className="page-game__nav-logo" />
            </button>
        </nav>
    )
}
