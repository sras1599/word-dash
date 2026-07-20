import type { Card, GamePhase, GameState, TurnPhase } from '../../lib/gameTypes'
import { applyBoardOperation } from '../../pages/Game/state/boardProjection'
import {
    gameReconciliationReducer,
    initialGameReconciliationState,
    type GameAction,
    type GameReconciliationState,
} from '../../pages/Game/state/gameReducer'
import {
    createSimulationFixture,
    DEFAULT_TURN_DURATION_MS,
    LOCAL_PLAYER_ID,
    type SimulationFixture,
    type SimulationFixtureOptions,
} from './fixtures'

export type SimulationEvent = {
    id: number
    label: string
}

export type GameSimulationState = {
    gameState: GameState
    reconciliation: GameReconciliationState
    drawDeck: Card[]
    eventLog: SimulationEvent[]
    nextEventId: number
}

export type SimulationScenario =
    | 'draw'
    | 'arrange-draw'
    | 'arrange-discard'
    | 'opponent'
    | 'urgent'
    | 'invalid-word'
    | 'disconnected'
    | 'slow-network'
    | 'finished'

function record(state: GameSimulationState, label: string): GameSimulationState {
    return {
        ...state,
        eventLog: [...state.eventLog, { id: state.nextEventId, label }],
        nextEventId: state.nextEventId + 1,
    }
}

export function recordSimulationEvent(
    state: GameSimulationState,
    label: string,
): GameSimulationState {
    return record(state, label)
}

function applyGameAction(
    state: GameSimulationState,
    action: GameAction,
    label: string,
): GameSimulationState {
    const reconciliation = gameReconciliationReducer(state.reconciliation, action)
    return record({
        ...state,
        reconciliation,
        gameState: reconciliation.gameState ?? state.gameState,
    }, label)
}

function nextPlayerId(gameState: GameState): string {
    const currentIndex = gameState.players.findIndex(
        (player) => player.id === gameState.turn.currentPlayerId,
    )
    return gameState.players[(currentIndex + 1) % gameState.players.length]?.id
        ?? LOCAL_PLAYER_ID
}

function replaceGameState(
    state: GameSimulationState,
    gameState: GameState,
    label: string,
): GameSimulationState {
    return applyGameAction(state, { type: 'game/state', state: gameState }, label)
}

export function createSimulationState(
    options?: SimulationFixtureOptions,
    fixture: SimulationFixture = createSimulationFixture(options),
): GameSimulationState {
    const reconciliation = gameReconciliationReducer(initialGameReconciliationState, {
        type: 'game/state',
        state: fixture.gameState,
        localPlayerId: LOCAL_PLAYER_ID,
    })
    return {
        gameState: fixture.gameState,
        reconciliation,
        drawDeck: fixture.drawDeck,
        eventLog: [],
        nextEventId: 1,
    }
}

export function drawCard(
    state: GameSimulationState,
    source: 'draw' | 'discard',
): GameSimulationState {
    if (source === 'discard') {
        return applyGameAction(
            state,
            { type: 'local/discardPileDrawnOptimistically', localPlayerId: LOCAL_PLAYER_ID },
            'draw(discard)',
        )
    }

    const [card, ...drawDeck] = state.drawDeck
    if (!card) return record(state, 'draw(draw) ignored: pile empty')

    const nextState = applyGameAction(
        { ...state, drawDeck },
        {
            type: 'game/cardDrawn',
            localPlayerId: LOCAL_PLAYER_ID,
            playerId: LOCAL_PLAYER_ID,
            card,
            drawPileCount: drawDeck.length,
            discardPileTop: state.gameState.discardPileTop,
        },
        `draw(draw): ${card.letter}`,
    )
    return nextState
}

export function placeCard(
    state: GameSimulationState,
    cardId: string,
    rowIndex: number,
    slotIndex: number,
): GameSimulationState {
    return applyGameAction(state, {
        type: 'local/cardPlacedOptimistically',
        localPlayerId: LOCAL_PLAYER_ID,
        clientActionId: `simulation-${state.nextEventId}`,
        cardId,
        rowIndex,
        slotIndex,
    }, `place(${cardId}, ${rowIndex}, ${slotIndex})`)
}

export function unplaceCard(
    state: GameSimulationState,
    rowIndex: number,
    slotIndex: number,
): GameSimulationState {
    return applyGameAction(state, {
        type: 'local/cardUnplacedOptimistically',
        localPlayerId: LOCAL_PLAYER_ID,
        clientActionId: `simulation-${state.nextEventId}`,
        rowIndex,
        slotIndex,
    }, `unplace(${rowIndex}, ${slotIndex})`)
}

export function clearWord(state: GameSimulationState, rowIndex: number): GameSimulationState {
    return applyGameAction(state, {
        type: 'local/wordClearedOptimistically',
        localPlayerId: LOCAL_PLAYER_ID,
        clientActionId: `simulation-${state.nextEventId}`,
        rowIndex,
    }, `clearWord(${rowIndex})`)
}

export function clearBoard(state: GameSimulationState): GameSimulationState {
    return applyGameAction(state, {
        type: 'local/boardClearedOptimistically',
        localPlayerId: LOCAL_PLAYER_ID,
        clientActionId: `simulation-${state.nextEventId}`,
    }, 'clearBoard()')
}

export function discardCard(state: GameSimulationState, cardId: string): GameSimulationState {
    const clientActionId = `simulation-${state.nextEventId}`
    const optimistic = applyGameAction(state, {
        type: 'local/cardDiscardedOptimistically',
        localPlayerId: LOCAL_PLAYER_ID,
        clientActionId,
        cardId,
    }, `discard(${cardId})`)
    const localPlayer = optimistic.gameState.players.find(({ id }) => id === LOCAL_PLAYER_ID)!
    let reconciliation = gameReconciliationReducer(optimistic.reconciliation, {
        type: 'game/boardUpdated',
        localPlayerId: LOCAL_PLAYER_ID,
        playerId: LOCAL_PLAYER_ID,
        wordBoard: localPlayer.wordBoard,
        hand: localPlayer.hand,
        handCount: localPlayer.handCount,
        boardRevision: (optimistic.reconciliation.authoritativeGameState?.players[0].boardRevision ?? 0) + 1,
        clientActionId,
    })
    reconciliation = gameReconciliationReducer(reconciliation, {
        type: 'game/turnEnded',
        nextPlayerId: optimistic.gameState.turn.currentPlayerId,
        discardPileTop: optimistic.gameState.discardPileTop!,
    })
    return {
        ...optimistic,
        reconciliation,
        gameState: reconciliation.gameState ?? optimistic.gameState,
    }
}

export function advanceTurn(state: GameSimulationState): GameSimulationState {
    const currentPlayerId = state.gameState.turn.currentPlayerId
    const nextId = nextPlayerId(state.gameState)
    return applyGameAction(state, {
        type: 'game/turnSkipped',
        playerId: currentPlayerId,
        nextPlayerId: nextId,
    }, `advanceTurn(${currentPlayerId} → ${nextId})`)
}

export function setActivePlayer(
    state: GameSimulationState,
    playerId: string,
): GameSimulationState {
    return replaceGameState(state, {
        ...state.gameState,
        turn: {
            ...state.gameState.turn,
            currentPlayerId: playerId,
            phase: 'draw',
            drawnCard: null,
        },
    }, `setActivePlayer(${playerId})`)
}

export function setTurnPhase(
    state: GameSimulationState,
    phase: TurnPhase,
): GameSimulationState {
    return replaceGameState(state, {
        ...state.gameState,
        phase: 'playing',
        winnerId: null,
        turn: { ...state.gameState.turn, phase },
    }, `setTurnPhase(${phase})`)
}

export function setGamePhase(
    state: GameSimulationState,
    phase: GamePhase,
): GameSimulationState {
    return replaceGameState(state, {
        ...state.gameState,
        phase,
        turn: {
            ...state.gameState.turn,
            phase: phase === 'playing' ? 'draw' : 'idle',
        },
    }, `setGamePhase(${phase})`)
}

export function setPlayerConnected(
    state: GameSimulationState,
    playerId: string,
    isConnected: boolean,
): GameSimulationState {
    return applyGameAction(state, {
        type: 'game/playerConnectionChanged',
        playerId,
        isConnected,
    }, `setPlayerConnected(${playerId}, ${isConnected})`)
}

export function fillWord(
    state: GameSimulationState,
    valid: boolean,
    rowIndex = 0,
): GameSimulationState {
    const player = state.gameState.players.find(({ id }) => id === LOCAL_PLAYER_ID)
    const row = player?.wordBoard.rows[rowIndex]
    if (!player || !row) return record(state, `fillWord(${valid}) ignored`)

    const letters = valid ? 'CAT' : 'QZX'
    const slots = row.slots.map((slot, index) => ({
        ...slot,
        card: {
            id: `filled-${rowIndex}-${index}`,
            letter: letters[index % letters.length],
        },
    }))
    const players = state.gameState.players.map((candidate) => candidate.id === player.id
        ? {
            ...candidate,
            wordBoard: {
                ...candidate.wordBoard,
                allComplete: valid && candidate.wordBoard.rows.length === 1,
                rows: candidate.wordBoard.rows.map((candidateRow, index) => index === rowIndex
                    ? { ...candidateRow, slots, isComplete: valid }
                    : candidateRow),
            },
        }
        : candidate)

    return replaceGameState(state, { ...state.gameState, players }, `fillWord(${valid ? 'valid' : 'invalid'})`)
}

export function finishGame(
    state: GameSimulationState,
    winnerId: string,
): GameSimulationState {
    return applyGameAction(state, {
        type: 'game/playerWon',
        winnerId,
    }, `finishGame(${winnerId})`)
}

export function expireTurn(state: GameSimulationState): GameSimulationState {
    const { gameState } = state
    if (gameState.phase !== 'playing') return record(state, 'expireTurn() ignored')

    if (
        gameState.turn.currentPlayerId === LOCAL_PLAYER_ID
        && gameState.turn.phase === 'arrange'
        && gameState.turn.drawnCard
    ) {
        return discardCard(record(state, 'expireTurn(): automatic discard'), gameState.turn.drawnCard.id)
    }

    return advanceTurn(record(state, 'expireTurn()'))
}

export function createScenarioState(
    scenario: SimulationScenario,
    fixtureOptions?: SimulationFixtureOptions,
): GameSimulationState {
    let state = createSimulationState(fixtureOptions)

    switch (scenario) {
        case 'draw':
            return state
        case 'arrange-draw':
            return drawCard(state, 'draw')
        case 'arrange-discard':
            return drawCard(state, 'discard')
        case 'opponent':
            return setActivePlayer(state, state.gameState.players[1].id)
        case 'urgent':
            return drawCard(state, 'draw')
        case 'invalid-word':
            state = drawCard(state, 'draw')
            return fillWord(state, false)
        case 'disconnected':
            return setPlayerConnected(state, state.gameState.players[1].id, false)
        case 'slow-network': {
            const authoritativeBase = state.gameState
            state = placeCard(state, 'hand-1', 0, 0)
            state = placeCard(state, 'hand-2', 0, 1)
            state = placeCard(state, 'hand-3', 0, 2)
            const afterFirst = applyBoardOperation(authoritativeBase, LOCAL_PLAYER_ID, {
                type: 'place',
                clientActionId: 'simulation-1',
                cardId: 'hand-1',
                rowIndex: 0,
                slotIndex: 0,
            })
            const localPlayer = afterFirst.players.find(({ id }) => id === LOCAL_PLAYER_ID)!
            return applyGameAction(state, {
                type: 'game/boardUpdated',
                localPlayerId: LOCAL_PLAYER_ID,
                playerId: LOCAL_PLAYER_ID,
                wordBoard: localPlayer.wordBoard,
                hand: localPlayer.hand,
                handCount: localPlayer.handCount,
                boardRevision: 1,
                clientActionId: 'simulation-1',
            }, 'delayed board_updated(revision 1, ack simulation-1)')
        }
        case 'finished':
            return finishGame(state, LOCAL_PLAYER_ID)
    }
}

export { DEFAULT_TURN_DURATION_MS, LOCAL_PLAYER_ID }
