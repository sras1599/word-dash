import { useNavigate, useParams } from 'react-router-dom'
import { GameBoard } from '../../components/GameBoard/GameBoard'
import { PageShell, type FloatingLetter } from '../../components/PageShell/PageShell'
import type { GamePlayer, GameState } from '../../lib/gameTypes'
import { session } from '../../lib/session'
import { GameOverDialog } from './components/GameOverDialog'
import { GameStateScreen } from './components/GameStateScreen'
import { GameTopBar } from './components/GameTopBar'
import { useGameRoom } from './hooks/useGameRoom'
import './Game.css'

const URGENCY_THRESHOLD_MS = 15_000

const FLOATING_LETTERS: FloatingLetter[] = [
    { key: 'a', letter: 'A', className: 'page-game__floating-letter--a' },
    { key: 'w', letter: 'W', className: 'page-game__floating-letter--w' },
    { key: 's', letter: 'S', className: 'page-game__floating-letter--s' },
]

function getBoardSubtitle(
    gameState: GameState,
    isLocalTurn: boolean,
    currentTurnPlayer: GamePlayer | null,
): string {
    if (gameState.phase === 'finished') {
        return 'Round complete.'
    }

    if (gameState.phase === 'waiting') {
        return 'Preparing the board.'
    }

    if (isLocalTurn) {
        return gameState.turn.phase === 'draw'
            ? 'Draw a card, then build or discard.'
            : 'Arrange your cards before the timer expires.'
    }

    return `Waiting for ${currentTurnPlayer?.name ?? 'the next player'}.`
}

export function Game() {
    const { roomCode } = useParams<{ roomCode: string }>()
    const navigate = useNavigate()
    const localPlayerId = session.getPlayerId() ?? ''
    const { gameState, draw, place, unplace, discard, restartLobby, close } = useGameRoom(roomCode, localPlayerId)

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
        gameState.turn.timeRemainingMs <= URGENCY_THRESHOLD_MS
    const drawnCardId = gameState.turn.drawnCard?.id ?? null
    const localHand = localPlayerData?.hand ?? []
    const handCount = localPlayerData?.handCount ?? localHand.length
    const currentTurnPlayer = gameState.players.find((player) => player.id === gameState.turn.currentPlayerId) ?? null

    return (
        <PageShell
            pageClassName="page-game"
            floatingBgClassName="page-game__floating-bg"
            floatingLetterClassName="page-game__floating-letter"
            floatingLetters={FLOATING_LETTERS}
        >
            <GameTopBar
                timeRemainingMs={gameState.turn.timeRemainingMs}
                timerIsUrgent={timerIsUrgent}
                onHome={handleHome}
            />

            <main className="wd-content-layer page-game__main">
                <GameBoard
                    phase={gameState.phase}
                    localPlayerId={localPlayerId}
                    winnerId={gameState.winnerId}
                    localPlayer={localPlayerData ? { ...localPlayerData, hand: localHand } : null}
                    opponents={opponents}
                    turn={gameState.turn}
                    variation={gameState.variation}
                    discardTopCard={gameState.discardPileTop}
                    drawPileCount={gameState.drawPileCount}
                    boardSubtitle={getBoardSubtitle(gameState, isLocalTurn, currentTurnPlayer)}
                    handCount={handCount}
                    drawnCardId={drawnCardId}
                    willAutoDiscardCardId={isArrangePhase && timerIsUrgent ? drawnCardId : null}
                    onDraw={draw}
                    onPlace={place}
                    onUnplace={unplace}
                    onDiscard={discard}
                />
            </main>

            {gameState.phase === 'finished' && winner && (
                <GameOverDialog winner={winner} isHost={isHost} onPlayAgain={handlePlayAgain} onHome={handleHome} />
            )}
        </PageShell>
    )
}
