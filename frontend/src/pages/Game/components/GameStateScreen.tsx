import { BrandLogo } from '../../../components/BrandLogo/BrandLogo'
import { Button, Panel } from '../../../components/ui'

type GameStateScreenProps = {
    title?: string
    copy?: string
    actionLabel?: string
    onAction?: () => void
}

export function GameStateScreen({ title, copy, actionLabel, onAction }: GameStateScreenProps) {
    return (
        <main className="page-game__state-shell">
            <BrandLogo className="page-game__state-logo" />
            {title ? (
                <Panel className="page-game__state-panel" elevation="elevated">
                    <h1 className="page-game__state-title">{title}</h1>
                    {copy && <p className="page-game__state-copy">{copy}</p>}
                    {actionLabel && onAction && (
                        <Button className="page-game__state-btn" type="button" onClick={onAction}>
                            {actionLabel}
                        </Button>
                    )}
                </Panel>
            ) : (
                <p className="page-game__loading-text">Connecting…</p>
            )}
        </main>
    )
}
