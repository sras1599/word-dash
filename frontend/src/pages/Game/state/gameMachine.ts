import { assign, setup } from 'xstate'
import type { Card, GameState, WordBoardState } from '../../../lib/gameTypes'
import {
    gameReconciliationReducer,
    initialGameReconciliationState,
    type GameAction,
    type GameReconciliationState,
} from './gameReducer'

export type GameMachineContext = GameReconciliationState

export type GameMachineEvent =
    | { type: 'INVALID_SESSION' }
    | { type: 'CONNECTING' }
    | { type: 'GAME_STATE'; state: GameState; localPlayerId?: string }
    | {
          type: 'CARD_DRAWN'
          localPlayerId: string
          playerId: string
          card: Card | null
          drawPileCount: number
          discardPileTop: Card | null
      }
    | {
          type: 'BOARD_UPDATED'
          localPlayerId: string
          playerId: string
          wordBoard: WordBoardState
          handCount: number
          hand?: Card[]
          boardRevision: number
          clientActionId?: string
      }
    | { type: 'TURN_ENDED'; nextPlayerId: string; discardPileTop: Card }
    | { type: 'TURN_SKIPPED'; playerId: string; nextPlayerId?: string }
    | { type: 'PLAYER_WON'; winnerId: string }
    | { type: 'PLAYER_CONNECTION_CHANGED'; playerId: string; isConnected: boolean }
    | { type: 'LOCAL_CARD_PLACED_OPTIMISTICALLY'; localPlayerId: string; clientActionId: string; cardId: string; rowIndex: number; slotIndex: number }
    | { type: 'LOCAL_CARD_UNPLACED_OPTIMISTICALLY'; localPlayerId: string; clientActionId: string; rowIndex: number; slotIndex: number }
    | { type: 'LOCAL_WORD_CLEARED_OPTIMISTICALLY'; localPlayerId: string; clientActionId: string; rowIndex: number }
    | { type: 'LOCAL_BOARD_CLEARED_OPTIMISTICALLY'; localPlayerId: string; clientActionId: string }
    | { type: 'LOCAL_CARD_DISCARDED_OPTIMISTICALLY'; localPlayerId: string; clientActionId: string; cardId: string }
    | { type: 'LOCAL_DISCARD_PILE_DRAWN_OPTIMISTICALLY'; localPlayerId: string }
    | { type: 'ACTION_REJECTED'; clientActionId?: string; message: string }

function reduceGameEvent(context: GameMachineContext, event: GameMachineEvent): GameMachineContext {
    let action: GameAction | null = null
    switch (event.type) {
        case 'GAME_STATE':
            action = { type: 'game/state', state: event.state, localPlayerId: event.localPlayerId }
            break
        case 'CARD_DRAWN':
            action = {
                type: 'game/cardDrawn',
                localPlayerId: event.localPlayerId,
                playerId: event.playerId,
                card: event.card,
                drawPileCount: event.drawPileCount,
                discardPileTop: event.discardPileTop,
            }
            break
        case 'BOARD_UPDATED':
            action = {
                type: 'game/boardUpdated',
                localPlayerId: event.localPlayerId,
                playerId: event.playerId,
                wordBoard: event.wordBoard,
                handCount: event.handCount,
                hand: event.hand,
                boardRevision: event.boardRevision,
                clientActionId: event.clientActionId,
            }
            break
        case 'TURN_ENDED':
            action = {
                type: 'game/turnEnded',
                nextPlayerId: event.nextPlayerId,
                discardPileTop: event.discardPileTop,
            }
            break
        case 'TURN_SKIPPED':
            action = {
                type: 'game/turnSkipped',
                playerId: event.playerId,
                nextPlayerId: event.nextPlayerId,
            }
            break
        case 'PLAYER_WON':
            action = { type: 'game/playerWon', winnerId: event.winnerId }
            break
        case 'PLAYER_CONNECTION_CHANGED':
            action = {
                type: 'game/playerConnectionChanged',
                playerId: event.playerId,
                isConnected: event.isConnected,
            }
            break
        case 'LOCAL_CARD_PLACED_OPTIMISTICALLY':
            action = {
                type: 'local/cardPlacedOptimistically',
                localPlayerId: event.localPlayerId,
                cardId: event.cardId,
                rowIndex: event.rowIndex,
                slotIndex: event.slotIndex,
                clientActionId: event.clientActionId,
            }
            break
        case 'LOCAL_CARD_UNPLACED_OPTIMISTICALLY':
            action = {
                type: 'local/cardUnplacedOptimistically',
                localPlayerId: event.localPlayerId,
                rowIndex: event.rowIndex,
                slotIndex: event.slotIndex,
                clientActionId: event.clientActionId,
            }
            break
        case 'LOCAL_WORD_CLEARED_OPTIMISTICALLY':
            action = {
                type: 'local/wordClearedOptimistically',
                localPlayerId: event.localPlayerId,
                rowIndex: event.rowIndex,
                clientActionId: event.clientActionId,
            }
            break
        case 'LOCAL_BOARD_CLEARED_OPTIMISTICALLY':
            action = {
                type: 'local/boardClearedOptimistically',
                localPlayerId: event.localPlayerId,
                clientActionId: event.clientActionId,
            }
            break
        case 'LOCAL_CARD_DISCARDED_OPTIMISTICALLY':
            action = {
                type: 'local/cardDiscardedOptimistically',
                localPlayerId: event.localPlayerId,
                cardId: event.cardId,
                clientActionId: event.clientActionId,
            }
            break
        case 'LOCAL_DISCARD_PILE_DRAWN_OPTIMISTICALLY':
            action = {
                type: 'local/discardPileDrawnOptimistically',
                localPlayerId: event.localPlayerId,
            }
            break
        case 'ACTION_REJECTED':
            action = { type: 'game/actionRejected', clientActionId: event.clientActionId, message: event.message }
            break
        default:
            return context
    }
    return action ? gameReconciliationReducer(context, action) : context
}

function isFinished({ event }: { event: GameMachineEvent }) {
    return event.type === 'GAME_STATE' && event.state.phase === 'finished'
}

function isWaiting({ event }: { event: GameMachineEvent }) {
    return event.type === 'GAME_STATE' && event.state.phase === 'waiting'
}

function isArrange({ event }: { event: GameMachineEvent }) {
    return event.type === 'GAME_STATE' && event.state.phase === 'playing' && event.state.turn.phase === 'arrange'
}

function isIdle({ event }: { event: GameMachineEvent }) {
    return event.type === 'GAME_STATE' && event.state.phase === 'playing' && event.state.turn.phase === 'idle'
}

export const gameMachine = setup({
    types: {
        context: {} as GameMachineContext,
        events: {} as GameMachineEvent,
    },
    guards: {
        isFinished,
        isWaiting,
        isArrange,
        isIdle,
    },
    actions: {
        clearGame: assign(() => initialGameReconciliationState),
        reduceGame: assign(({ context, event }) => reduceGameEvent(context, event)),
    },
}).createMachine({
    id: 'game',
    initial: 'connecting',
    context: initialGameReconciliationState,
    on: {
        INVALID_SESSION: { target: '.invalidSession', actions: 'clearGame' },
        CONNECTING: { target: '.connecting', actions: 'clearGame' },
    },
    states: {
        invalidSession: {},
        connecting: {
            on: {
                GAME_STATE: [
                    { guard: 'isFinished', target: 'finished', actions: 'reduceGame' },
                    { guard: 'isWaiting', target: 'waiting', actions: 'reduceGame' },
                    { guard: 'isArrange', target: 'playing.arrange', actions: 'reduceGame' },
                    { guard: 'isIdle', target: 'playing.idle', actions: 'reduceGame' },
                    { target: 'playing.draw', actions: 'reduceGame' },
                ],
            },
        },
        waiting: {
            on: {
                GAME_STATE: [
                    { guard: 'isFinished', target: 'finished', actions: 'reduceGame' },
                    { guard: 'isArrange', target: 'playing.arrange', actions: 'reduceGame' },
                    { target: 'playing.draw', actions: 'reduceGame' },
                ],
            },
        },
        playing: {
            initial: 'draw',
            states: {
                draw: {},
                arrange: {},
                idle: {},
            },
            on: {
                GAME_STATE: [
                    { guard: 'isFinished', target: 'finished', actions: 'reduceGame' },
                    { guard: 'isWaiting', target: 'waiting', actions: 'reduceGame' },
                    { guard: 'isArrange', target: '.arrange', actions: 'reduceGame' },
                    { guard: 'isIdle', target: '.idle', actions: 'reduceGame' },
                    { target: '.draw', actions: 'reduceGame' },
                ],
                CARD_DRAWN: { target: '.arrange', actions: 'reduceGame' },
                TURN_ENDED: { target: '.draw', actions: 'reduceGame' },
                TURN_SKIPPED: { target: '.draw', actions: 'reduceGame' },
                PLAYER_WON: { target: 'finished', actions: 'reduceGame' },
                BOARD_UPDATED: { actions: 'reduceGame' },
                PLAYER_CONNECTION_CHANGED: { actions: 'reduceGame' },
                LOCAL_CARD_PLACED_OPTIMISTICALLY: { actions: 'reduceGame' },
                LOCAL_CARD_UNPLACED_OPTIMISTICALLY: { actions: 'reduceGame' },
                LOCAL_WORD_CLEARED_OPTIMISTICALLY: { actions: 'reduceGame' },
                LOCAL_BOARD_CLEARED_OPTIMISTICALLY: { actions: 'reduceGame' },
                LOCAL_CARD_DISCARDED_OPTIMISTICALLY: { target: '.draw', actions: 'reduceGame' },
                LOCAL_DISCARD_PILE_DRAWN_OPTIMISTICALLY: { target: '.arrange', actions: 'reduceGame' },
                ACTION_REJECTED: { actions: 'reduceGame' },
            },
        },
        finished: {
            on: {
                GAME_STATE: [
                    { guard: 'isFinished', actions: 'reduceGame' },
                    { guard: 'isWaiting', target: 'waiting', actions: 'reduceGame' },
                    { target: 'playing.draw', actions: 'reduceGame' },
                ],
                BOARD_UPDATED: { actions: 'reduceGame' },
                ACTION_REJECTED: { actions: 'reduceGame' },
                PLAYER_CONNECTION_CHANGED: { actions: 'reduceGame' },
            },
        },
    },
})
