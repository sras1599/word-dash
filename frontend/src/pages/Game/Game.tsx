import { useNavigate, useParams } from 'react-router-dom'
import { GameBoard } from '../../components/GameBoard/GameBoard'
import { PageShell, type FloatingLetter } from '../../components/PageShell/PageShell'
import type { GameState } from '../../lib/gameTypes'
import { session } from '../../lib/session'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { isTurnTimerUrgent } from '../../lib/turnTimer'
import { GameHud } from './components/GameHud'
import { GameOverDialog } from './components/GameOverDialog'
import { GameStateScreen } from './components/GameStateScreen'
import { GameTopBar } from './components/GameTopBar'
import { useGameRoom } from './hooks/useGameRoom'
import './Game.css'

const FLOATING_LETTERS: FloatingLetter[] = [
    { key: 'a', letter: 'A', className: 'page-game__floating-letter--a' },
    { key: 'w', letter: 'W', className: 'page-game__floating-letter--w' },
    { key: 's', letter: 'S', className: 'page-game__floating-letter--s' },
]

function getGameTitle(
    roomCode: string | undefined,
    gameState: GameState | null,
    localPlayerId: string,
): string {
    const roomLabel = roomCode ? roomCode.toUpperCase() : 'Game'

    if (!gameState) {
        return `${roomLabel} - Loading`
    }

    if (gameState.phase === 'finished') {
        const winner = gameState.winnerId
            ? gameState.players.find((player) => player.id === gameState.winnerId)
            : null

        return winner ? `${winner.name} won ${roomLabel}` : `${roomLabel} - Game Over`
    }

    if (gameState.phase === 'waiting') {
        return `${roomLabel} - Preparing`
    }

    if (gameState.turn.currentPlayerId === localPlayerId) {
        return `Your Turn - ${roomLabel}`
    }

    const currentPlayer = gameState.players.find((player) => player.id === gameState.turn.currentPlayerId)
    return currentPlayer ? `${currentPlayer.name}'s Turn - ${roomLabel}` : `${roomLabel} - Playing`
}

export function Game() {
    const { roomCode } = useParams<{ roomCode: string }>()
    const navigate = useNavigate()
    const localPlayerId = session.getPlayerId() ?? ''
    const { gameState, rejectionFeedback, timeRemainingMs, turnDurationMs, draw, place, unplace, clearWord, clearBoard, discard, restartLobby, close } = useGameRoom(roomCode, localPlayerId)
    useDocumentTitle(getGameTitle(roomCode, gameState, localPlayerId))

    function handlePlayAgain() {
        restartLobby()
        navigate(`/lobby/${roomCode}`)
    }

    function handleHome() {
        close()
        navigate('/')
    }

    if (!roomCode || !localPlayerId) {
        return (
            <PageShell
                pageClassName="page-game"
                modifierClassName="page-game--error"
                floatingBgClassName="page-game__floating-bg"
                floatingLetterClassName="page-game__floating-letter"
                floatingLetters={FLOATING_LETTERS}
            >
                <GameStateScreen
                    title="Invalid session"
                    copy="Please rejoin from the home page."
                    actionLabel="Return Home"
                    onAction={handleHome}
                />
            </PageShell>
        )
    }

    if (!gameState) {
        return (
            <PageShell
                pageClassName="page-game"
                modifierClassName="page-game--loading"
                floatingBgClassName="page-game__floating-bg"
                floatingLetterClassName="page-game__floating-letter"
                floatingLetters={FLOATING_LETTERS}
            >
                <GameStateScreen />
            </PageShell>
        )
    }

    const localPlayerData = gameState.players.find((player) => player.id === localPlayerId) ?? null
    const opponents = gameState.players.filter((player) => player.id !== localPlayerId)
    const winner = gameState.winnerId
        ? gameState.players.find((player) => player.id === gameState.winnerId) ?? null
        : null
    const isHost = gameState.hostPlayerId === localPlayerId
    const isLocalTurn = gameState.turn.currentPlayerId === localPlayerId
    const isArrangePhase = gameState.phase === 'playing' && isLocalTurn && gameState.turn.phase === 'arrange'
    const timerIsUrgent =
        gameState.phase === 'playing' &&
        gameState.turn.phase !== 'idle' &&
        isTurnTimerUrgent(timeRemainingMs, turnDurationMs)
    const drawnCardId = gameState.turn.drawnCard?.id ?? null
    const localHand = localPlayerData?.hand ?? []
    const handCount = localPlayerData?.handCount ?? localHand.length
    return (
        <PageShell
            pageClassName="page-game"
            floatingBgClassName="page-game__floating-bg"
            floatingLetterClassName="page-game__floating-letter"
            floatingLetters={FLOATING_LETTERS}
        >
            <GameTopBar onHome={handleHome} />

            <div className="page-game__hud-layer">
                <div className="page-game__hud-grid">
                    <div className="page-game__hud">
                        <GameHud
                            gameState={gameState}
                            localPlayerId={localPlayerId}
                            timeRemainingMs={timeRemainingMs}
                            turnDurationMs={turnDurationMs}
                            timerIsUrgent={timerIsUrgent}
                        />
                    </div>
                </div>
            </div>

            {rejectionFeedback && (
                <div className="page-game__rejection" role="alert">
                    {rejectionFeedback}
                </div>
            )}

            <main className="wd-content-layer page-game__main">
                <GameBoard
                    phase={gameState.phase}
                    playerOrder={gameState.players.map((player) => player.id)}
                    localPlayerId={localPlayerId}
                    winnerId={gameState.winnerId}
                    localPlayer={localPlayerData ? { ...localPlayerData, hand: localHand } : null}
                    opponents={opponents}
                    turn={gameState.turn}
                    variation={gameState.variation}
                    discardTopCard={gameState.discardPileTop}
                    drawPileCount={gameState.drawPileCount}
                    handCount={handCount}
                    drawnCardId={drawnCardId}
                    willAutoDiscardCardId={isArrangePhase && timerIsUrgent ? drawnCardId : null}
                    onDraw={draw}
                    onPlace={place}
                    onUnplace={unplace}
                    onClearWord={clearWord}
                    onClearBoard={clearBoard}
                    onDiscard={discard}
                />
            </main>

            {gameState.phase === 'finished' && winner && (
                <GameOverDialog winner={winner} isHost={isHost} onPlayAgain={handlePlayAgain} onHome={handleHome} />
            )}
        </PageShell>
    )
}
