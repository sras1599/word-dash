import { produce } from 'immer'
import type { Card, GameState, TurnPhase, WordBoardState } from '../../../lib/gameTypes'
import { applyBoardOperation, projectGameState, type PendingBoardOperation } from './boardProjection'

export type GameAction =
    | { type: 'game/state'; state: GameState; localPlayerId?: string }
    | {
        type: 'game/cardDrawn'
        localPlayerId: string
        playerId: string
        card: Card | null
        drawPileCount: number
        discardPileTop: Card | null
    }
    | {
        type: 'game/boardUpdated'
        localPlayerId: string
        playerId: string
        wordBoard: WordBoardState
        handCount: number
        hand?: Card[]
        boardRevision: number
        clientActionId?: string
    }
    | { type: 'game/turnEnded'; nextPlayerId: string; discardPileTop: Card }
    | { type: 'game/turnSkipped'; playerId: string; nextPlayerId?: string }
    | { type: 'game/playerWon'; winnerId: string }
    | { type: 'game/playerConnectionChanged'; playerId: string; isConnected: boolean }
    | { type: 'local/cardPlacedOptimistically'; localPlayerId: string; clientActionId?: string; cardId: string; rowIndex: number; slotIndex: number }
    | { type: 'local/cardUnplacedOptimistically'; localPlayerId: string; clientActionId?: string; rowIndex: number; slotIndex: number }
    | { type: 'local/wordClearedOptimistically'; localPlayerId: string; clientActionId?: string; rowIndex: number }
    | { type: 'local/boardClearedOptimistically'; localPlayerId: string; clientActionId?: string }
    | { type: 'local/cardDiscardedOptimistically'; localPlayerId: string; clientActionId?: string; cardId: string }
    | { type: 'local/discardPileDrawnOptimistically'; localPlayerId: string }
    | { type: 'game/actionRejected'; clientActionId?: string; message: string }

export function canPlaceCard(state: GameState | null): boolean {
    if (!state) return false
    if (state.phase !== 'playing') return false
    return state.turn.phase === 'draw' || state.turn.phase === 'arrange'
}

export function canDrawCard(state: GameState | null, localPlayerId: string): boolean {
    if (!state) return false
    if (state.phase !== 'playing') return false
    if (state.turn.currentPlayerId !== localPlayerId) return false
    return state.turn.phase === 'draw'
}

export function canDiscardCard(state: GameState | null, localPlayerId: string): boolean {
    if (!state) return false
    if (state.phase !== 'playing') return false
    if (state.turn.currentPlayerId !== localPlayerId) return false
    return state.turn.phase === 'arrange'
}

function pendingOperationFor(action: GameAction): PendingBoardOperation | null {
    const clientActionId = 'clientActionId' in action ? action.clientActionId ?? 'legacy-local-action' : ''
    switch (action.type) {
        case 'local/cardPlacedOptimistically':
            return { type: 'place', clientActionId, cardId: action.cardId, rowIndex: action.rowIndex, slotIndex: action.slotIndex }
        case 'local/cardUnplacedOptimistically':
            return { type: 'unplace', clientActionId, rowIndex: action.rowIndex, slotIndex: action.slotIndex }
        case 'local/wordClearedOptimistically':
            return { type: 'clear-word', clientActionId, rowIndex: action.rowIndex }
        case 'local/boardClearedOptimistically':
            return { type: 'clear-board', clientActionId }
        case 'local/cardDiscardedOptimistically':
            return { type: 'discard', clientActionId, cardId: action.cardId }
        default:
            return null
    }
}

export function gameReducer(state: GameState | null, action: GameAction): GameState | null {
    if (action.type === 'game/state') return action.state
    if (!state) return state
    const pendingOperation = pendingOperationFor(action)
    if (pendingOperation) {
        const localPlayerId = 'localPlayerId' in action ? action.localPlayerId : ''
        if (pendingOperation.type === 'discard') {
            return canDiscardCard(state, localPlayerId) ? applyBoardOperation(state, localPlayerId, pendingOperation) : state
        }
        return canPlaceCard(state) ? applyBoardOperation(state, localPlayerId, pendingOperation) : state
    }

    return produce(state, (draft) => {
        switch (action.type) {
            case 'game/cardDrawn': {
                const player = draft.players.find((p) => p.id === action.playerId)
                if (player) {
                    if (player.id === action.localPlayerId) {
                        const newCard = action.card ?? { id: `unknown-${Date.now()}`, letter: '?' }
                        const hand = player.hand ?? []
                        if (!hand.some((card) => card.id === newCard.id)) {
                            hand.push(newCard)
                        }
                        player.hand = hand
                        player.handCount = hand.length
                    } else {
                        player.handCount += 1
                    }
                }
                draft.drawPileCount = action.drawPileCount
                draft.discardPileTop = action.discardPileTop
                draft.turn.phase = 'arrange' as TurnPhase
                draft.turn.drawnCard = action.playerId === action.localPlayerId ? action.card : draft.turn.drawnCard
                break
            }
            case 'game/boardUpdated': {
                const player = draft.players.find((p) => p.id === action.playerId)
                if (player) {
                    player.wordBoard = action.wordBoard
                    player.handCount = action.handCount
                    player.boardRevision = action.boardRevision
                    if (player.id === action.localPlayerId && action.hand) {
                        player.hand = action.hand
                    }
                }
                break
            }
            case 'game/turnEnded':
                draft.discardPileTop = action.discardPileTop
                draft.turn.currentPlayerId = action.nextPlayerId
                draft.turn.phase = 'draw' as TurnPhase
                draft.turn.drawnCard = null
                break
            case 'game/turnSkipped': {
                const idx = draft.players.findIndex((player) => player.id === action.playerId)
                const nextIdx = idx === -1 ? 0 : (idx + 1) % draft.players.length
                draft.turn.currentPlayerId = action.nextPlayerId ?? draft.players[nextIdx].id
                draft.turn.phase = 'draw' as TurnPhase
                draft.turn.drawnCard = null
                break
            }
            case 'game/playerWon':
                draft.phase = 'finished'
                draft.winnerId = action.winnerId
                break
            case 'game/playerConnectionChanged': {
                const player = draft.players.find((p) => p.id === action.playerId)
                if (player) player.isConnected = action.isConnected
                break
            }
            case 'local/discardPileDrawnOptimistically': {
                if (!canDrawCard(draft, action.localPlayerId)) break
                const player = draft.players.find((p) => p.id === action.localPlayerId)
                const drawnCard = draft.discardPileTop
                if (!player || !drawnCard) break

                const hand = player.hand ?? []
                if (!hand.some((card) => card.id === drawnCard.id)) hand.push(drawnCard)
                player.hand = hand
                player.handCount = hand.length
                draft.discardPileTop = null
                draft.turn.phase = 'arrange' as TurnPhase
                draft.turn.drawnCard = drawnCard
                break
            }
            case 'game/actionRejected':
                break
        }
    })
}

export type GameRejection = {
    clientActionId?: string
    message: string
}

export type GameReconciliationState = {
    authoritativeGameState: GameState | null
    pendingBoardOperations: PendingBoardOperation[]
    gameState: GameState | null
    localPlayerId: string
    rejection: GameRejection | null
}

export const initialGameReconciliationState: GameReconciliationState = {
    authoritativeGameState: null,
    pendingBoardOperations: [],
    gameState: null,
    localPlayerId: '',
    rejection: null,
}

function actionLocalPlayerId(action: GameAction, fallback: string): string {
    return 'localPlayerId' in action ? action.localPlayerId ?? fallback : fallback
}

function authoritativeRevision(state: GameState, playerId: string): number {
    const revision = state.players.find((player) => player.id === playerId)?.boardRevision
    return revision ?? -1
}

export function gameReconciliationReducer(
    state: GameReconciliationState,
    action: GameAction,
): GameReconciliationState {
    const localPlayerId = actionLocalPlayerId(action, state.localPlayerId)

    if (action.type === 'game/state') {
        return {
            authoritativeGameState: action.state,
            pendingBoardOperations: [],
            gameState: action.state,
            localPlayerId,
            rejection: null,
        }
    }

    if (action.type === 'game/actionRejected') {
        const pendingBoardOperations = action.clientActionId
            ? state.pendingBoardOperations.filter((operation) => operation.clientActionId !== action.clientActionId)
            : state.pendingBoardOperations
        return {
            ...state,
            pendingBoardOperations,
            gameState: projectGameState(state.authoritativeGameState, localPlayerId, pendingBoardOperations),
            localPlayerId,
            rejection: { clientActionId: action.clientActionId, message: action.message },
        }
    }

    const pendingOperation = pendingOperationFor(action)
    if (pendingOperation && state.gameState) {
        const projected = applyBoardOperation(state.gameState, localPlayerId, pendingOperation)
        if (projected === state.gameState) return { ...state, localPlayerId }
        const pendingBoardOperations = [...state.pendingBoardOperations, pendingOperation]
        return {
            ...state,
            pendingBoardOperations,
            gameState: projectGameState(state.authoritativeGameState, localPlayerId, pendingBoardOperations),
            localPlayerId,
            rejection: null,
        }
    }

    if (!state.authoritativeGameState) return { ...state, localPlayerId }

    if (action.type === 'game/boardUpdated') {
        const isNewer = action.boardRevision > authoritativeRevision(state.authoritativeGameState, action.playerId)
        const authoritativeGameState = isNewer
            ? gameReducer(state.authoritativeGameState, action)
            : state.authoritativeGameState
        const pendingBoardOperations =
            action.playerId === localPlayerId && action.clientActionId
                ? state.pendingBoardOperations.filter((operation) => operation.clientActionId !== action.clientActionId)
                : state.pendingBoardOperations
        return {
            ...state,
            authoritativeGameState,
            pendingBoardOperations,
            gameState: projectGameState(authoritativeGameState, localPlayerId, pendingBoardOperations),
            localPlayerId,
        }
    }

    const authoritativeGameState = gameReducer(state.authoritativeGameState, action)
    return {
        ...state,
        authoritativeGameState,
        gameState: projectGameState(authoritativeGameState, localPlayerId, state.pendingBoardOperations),
        localPlayerId,
    }
}
