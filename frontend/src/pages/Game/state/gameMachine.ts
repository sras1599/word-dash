import { assign, setup } from 'xstate'
import type { Card, GameState, WordBoardState } from '../../../lib/gameTypes'
import { gameReducer } from './gameReducer'

export type GameMachineContext = {
    gameState: GameState | null
}

export type GameMachineEvent =
    | { type: 'INVALID_SESSION' }
    | { type: 'CONNECTING' }
    | { type: 'GAME_STATE'; state: GameState }
    | { type: 'TURN_STARTED'; currentPlayerId: string; timeRemainingMs: number }
    | {
          type: 'CARD_DRAWN'
          localPlayerId: string
          playerId: string
          card: Card | null
          drawPileCount: number
          discardPileTop: Card | null
          timeRemainingMs?: number
      }
    | {
          type: 'BOARD_UPDATED'
          localPlayerId: string
          playerId: string
          wordBoard: WordBoardState
          handCount: number
          hand?: Card[]
      }
    | { type: 'TIMER_WARNING'; currentPlayerId?: string; timeRemainingMs: number }
    | { type: 'TURN_ENDED'; nextPlayerId: string; discardPileTop: Card; timeRemainingMs?: number }
    | { type: 'TURN_SKIPPED'; playerId: string; nextPlayerId?: string; timeRemainingMs?: number }
    | { type: 'PLAYER_WON'; winnerId: string }
    | { type: 'PLAYER_CONNECTION_CHANGED'; playerId: string; isConnected: boolean }
    | { type: 'LOCAL_TIMER_TICK' }
    | { type: 'LOCAL_CARD_PLACED_OPTIMISTICALLY'; localPlayerId: string; cardId: string; rowIndex: number; slotIndex: number }

function reduceGameEvent(context: GameMachineContext, event: GameMachineEvent): GameState | null {
    switch (event.type) {
        case 'GAME_STATE':
            return gameReducer(context.gameState, { type: 'game/state', state: event.state })
        case 'TURN_STARTED':
            return gameReducer(context.gameState, {
                type: 'game/turnStarted',
                currentPlayerId: event.currentPlayerId,
                timeRemainingMs: event.timeRemainingMs,
            })
        case 'CARD_DRAWN':
            return gameReducer(context.gameState, {
                type: 'game/cardDrawn',
                localPlayerId: event.localPlayerId,
                playerId: event.playerId,
                card: event.card,
                drawPileCount: event.drawPileCount,
                discardPileTop: event.discardPileTop,
                timeRemainingMs: event.timeRemainingMs,
            })
        case 'BOARD_UPDATED':
            return gameReducer(context.gameState, {
                type: 'game/boardUpdated',
                localPlayerId: event.localPlayerId,
                playerId: event.playerId,
                wordBoard: event.wordBoard,
                handCount: event.handCount,
                hand: event.hand,
            })
        case 'TIMER_WARNING':
            return gameReducer(context.gameState, {
                type: 'game/timerWarning',
                currentPlayerId: event.currentPlayerId,
                timeRemainingMs: event.timeRemainingMs,
            })
        case 'TURN_ENDED':
            return gameReducer(context.gameState, {
                type: 'game/turnEnded',
                nextPlayerId: event.nextPlayerId,
                discardPileTop: event.discardPileTop,
                timeRemainingMs: event.timeRemainingMs,
            })
        case 'TURN_SKIPPED':
            return gameReducer(context.gameState, {
                type: 'game/turnSkipped',
                playerId: event.playerId,
                nextPlayerId: event.nextPlayerId,
                timeRemainingMs: event.timeRemainingMs,
            })
        case 'PLAYER_WON':
            return gameReducer(context.gameState, { type: 'game/playerWon', winnerId: event.winnerId })
        case 'PLAYER_CONNECTION_CHANGED':
            return gameReducer(context.gameState, {
                type: 'game/playerConnectionChanged',
                playerId: event.playerId,
                isConnected: event.isConnected,
            })
        case 'LOCAL_TIMER_TICK':
            return gameReducer(context.gameState, { type: 'local/timerTick' })
        case 'LOCAL_CARD_PLACED_OPTIMISTICALLY':
            return gameReducer(context.gameState, {
                type: 'local/cardPlacedOptimistically',
                localPlayerId: event.localPlayerId,
                cardId: event.cardId,
                rowIndex: event.rowIndex,
                slotIndex: event.slotIndex,
            })
        default:
            return context.gameState
    }
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
        clearGame: assign({ gameState: null }),
        reduceGame: assign({
            gameState: ({ context, event }) => reduceGameEvent(context, event),
        }),
    },
}).createMachine({
    id: 'game',
    initial: 'connecting',
    context: {
        gameState: null,
    },
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
                TURN_STARTED: { target: '.draw', actions: 'reduceGame' },
                CARD_DRAWN: { target: '.arrange', actions: 'reduceGame' },
                TURN_ENDED: { target: '.draw', actions: 'reduceGame' },
                TURN_SKIPPED: { target: '.draw', actions: 'reduceGame' },
                PLAYER_WON: { target: 'finished', actions: 'reduceGame' },
                BOARD_UPDATED: { actions: 'reduceGame' },
                TIMER_WARNING: { actions: 'reduceGame' },
                PLAYER_CONNECTION_CHANGED: { actions: 'reduceGame' },
                LOCAL_TIMER_TICK: { actions: 'reduceGame' },
                LOCAL_CARD_PLACED_OPTIMISTICALLY: { actions: 'reduceGame' },
            },
        },
        finished: {
            on: {
                GAME_STATE: [
                    { guard: 'isFinished', actions: 'reduceGame' },
                    { guard: 'isWaiting', target: 'waiting', actions: 'reduceGame' },
                    { target: 'playing.draw', actions: 'reduceGame' },
                ],
                PLAYER_CONNECTION_CHANGED: { actions: 'reduceGame' },
            },
        },
    },
})
