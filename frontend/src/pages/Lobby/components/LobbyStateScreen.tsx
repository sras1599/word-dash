import { BrandLogo } from '../../../components/BrandLogo/BrandLogo'

type LobbyStateScreenProps = {
    pageStatus: 'connecting' | 'ready' | 'room-not-found' | 'connection-error'
    onHome: () => void
}

export function LobbyStateScreen({ pageStatus, onHome }: LobbyStateScreenProps) {
    const isRoomNotFound = pageStatus === 'room-not-found'
    const isConnectionError = pageStatus === 'connection-error'

    return (
        <main className="page-lobby__loading-shell">
            <BrandLogo className="page-lobby__loading-logo" />
            {isRoomNotFound || isConnectionError ? (
                <div className="page-lobby__error" role="alert">
                    <h1 className="page-lobby__error-title">
                        {isRoomNotFound ? 'Room not found' : 'Unable to connect'}
                    </h1>
                    <p className="page-lobby__error-message">
                        {isRoomNotFound
                            ? 'This room no longer exists. Go back home to create or join another game.'
                            : 'We could not reach the server. Please try again from the home page.'}
                    </p>
                    <button type="button" className="page-lobby__home-button" onClick={onHome}>
                        Go to home
                    </button>
                </div>
            ) : (
                <p className="page-lobby__loading-text">Connecting…</p>
            )}
        </main>
    )
}
