import { BrandLogo } from '../../../components/BrandLogo/BrandLogo'
import { Button } from '../../../components/ui'

type LobbyTopBarProps = {
    roomCode: string
    onCopyRoomCode: () => void
    copyStatus?: 'idle' | 'copied' | 'failed'
}

export function LobbyTopBar({ roomCode, onCopyRoomCode, copyStatus = 'idle' }: LobbyTopBarProps) {
    const copyMessage = copyStatus === 'copied' ? 'Copied!' : copyStatus === 'failed' ? 'Copy failed' : ''

    return (
        <nav className="page-lobby__topbar" aria-label="Lobby navigation">
            <div className="page-lobby__topbar-brand">
                <BrandLogo className="page-lobby__nav-logo" />
                <div className="page-lobby__room-pill">
                    <span className="page-lobby__room-pill-label">Room Code</span>
                    <span className="page-lobby__room-pill-value">{roomCode}</span>
                </div>
            </div>

            <div className="page-lobby__topbar-actions">
                <Button className="page-lobby__copy-btn" type="button" onClick={onCopyRoomCode}>
                    Copy Room Code
                </Button>
                <span
                    className={`page-lobby__copy-status page-lobby__copy-status--${copyStatus}`}
                    aria-live="polite"
                >
                    {copyMessage}
                </span>
            </div>
        </nav>
    )
}
