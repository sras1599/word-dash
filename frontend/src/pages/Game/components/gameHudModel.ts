import type { GameState } from '../../../lib/gameTypes'
import { formatTime } from '../../../lib/turnTimer'

export type GameHudViewModel = {
    ownerLabel: string
    title: string
    detail: string
    primaryLabel: string
    announcement: string
    timerLabel: string
    timerAriaLabel: string
    progress: number
    isActive: boolean
    isUrgent: boolean
    isVisible: boolean
}

export type CreateGameHudModelOptions = {
    gameState: GameState
    localPlayerId: string
    timeRemainingMs: number
    turnDurationMs: number
    timerIsUrgent: boolean
}

export function createGameHudModel({
    gameState,
    localPlayerId,
    timeRemainingMs,
    turnDurationMs,
    timerIsUrgent,
}: CreateGameHudModelOptions): GameHudViewModel {
    const activePlayer = gameState.players.find(
        (player) => player.id === gameState.turn.currentPlayerId,
    )
    const activePlayerName = activePlayer?.name ?? 'Next player'
    const isLocalTurn = activePlayer?.id === localPlayerId
    const isActive = gameState.phase === 'playing' && gameState.turn.phase !== 'idle'
    const timerLabel = isActive ? formatTime(timeRemainingMs) : '—'
    const progress = isActive && turnDurationMs > 0
        ? Math.max(0, Math.min(1, timeRemainingMs / turnDurationMs))
        : 0

    let ownerLabel = isLocalTurn ? 'Your turn' : 'Opponent turn'
    let title = isLocalTurn ? ownerLabel : `${activePlayerName}'s turn`
    let detail = 'You can continue arranging your words.'

    if (gameState.phase === 'waiting') {
        ownerLabel = 'Getting ready'
        title = 'Preparing the board'
        detail = 'The round will begin shortly.'
    } else if (isLocalTurn && gameState.turn.phase === 'draw') {
        title = 'Draw a card'
        detail = 'Choose the deck or discard pile.'
    } else if (isLocalTurn && gameState.turn.phase === 'arrange' && timerIsUrgent) {
        title = 'Discard now'
        detail = 'Your drawn card will be discarded when time expires.'
    } else if (isLocalTurn && gameState.turn.phase === 'arrange') {
        title = 'Build words or discard'
        detail = 'Discard one card to end your turn.'
    }

    const primaryLabel = gameState.phase === 'waiting'
        ? title
        : isLocalTurn
            ? `${ownerLabel} · ${title}`
            : title

    return {
        ownerLabel,
        title,
        detail,
        primaryLabel,
        announcement: detail ? `${primaryLabel}. ${detail}` : primaryLabel,
        timerLabel,
        timerAriaLabel: isActive ? `Time remaining ${timerLabel}` : 'Turn timer inactive',
        progress,
        isActive,
        isUrgent: isActive && timerIsUrgent,
        isVisible: gameState.phase !== 'finished',
    }
}
