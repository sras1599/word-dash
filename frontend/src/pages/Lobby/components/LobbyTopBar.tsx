import { BrandLogo } from '../../../components/BrandLogo/BrandLogo'

type LobbyTopBarProps = {
    roomCode: string
    onCopyRoomCode: () => void
}

export function LobbyTopBar({ roomCode, onCopyRoomCode }: LobbyTopBarProps) {
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
                <button className="wd-btn wd-btn--lift page-lobby__copy-btn" type="button" onClick={onCopyRoomCode}>
                    Copy Room Code
                </button>
            </div>
        </nav>
    )
}
