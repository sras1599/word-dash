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
      }
    | { type: 'TURN_ENDED'; nextPlayerId: string; discardPileTop: Card }
    | { type: 'TURN_SKIPPED'; playerId: string; nextPlayerId?: string }
    | { type: 'PLAYER_WON'; winnerId: string }
    | { type: 'PLAYER_CONNECTION_CHANGED'; playerId: string; isConnected: boolean }
    | { type: 'LOCAL_CARD_PLACED_OPTIMISTICALLY'; localPlayerId: string; cardId: string; rowIndex: number; slotIndex: number }
    | { type: 'LOCAL_CARD_UNPLACED_OPTIMISTICALLY'; localPlayerId: string; rowIndex: number; slotIndex: number }
    | { type: 'LOCAL_WORD_CLEARED_OPTIMISTICALLY'; localPlayerId: string; rowIndex: number }
    | { type: 'LOCAL_BOARD_CLEARED_OPTIMISTICALLY'; localPlayerId: string }
    | { type: 'LOCAL_CARD_DISCARDED_OPTIMISTICALLY'; localPlayerId: string; cardId: string }
    | { type: 'LOCAL_DISCARD_PILE_DRAWN_OPTIMISTICALLY'; localPlayerId: string }

function reduceGameEvent(context: GameMachineContext, event: GameMachineEvent): GameState | null {
    switch (event.type) {
        case 'GAME_STATE':
            return gameReducer(context.gameState, { type: 'game/state', state: event.state })
        case 'CARD_DRAWN':
            return gameReducer(context.gameState, {
                type: 'game/cardDrawn',
                localPlayerId: event.localPlayerId,
                playerId: event.playerId,
                card: event.card,
                drawPileCount: event.drawPileCount,
                discardPileTop: event.discardPileTop,
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
        case 'TURN_ENDED':
            return gameReducer(context.gameState, {
                type: 'game/turnEnded',
                nextPlayerId: event.nextPlayerId,
                discardPileTop: event.discardPileTop,
            })
        case 'TURN_SKIPPED':
            return gameReducer(context.gameState, {
                type: 'game/turnSkipped',
                playerId: event.playerId,
                nextPlayerId: event.nextPlayerId,
            })
        case 'PLAYER_WON':
            return gameReducer(context.gameState, { type: 'game/playerWon', winnerId: event.winnerId })
        case 'PLAYER_CONNECTION_CHANGED':
            return gameReducer(context.gameState, {
                type: 'game/playerConnectionChanged',
                playerId: event.playerId,
                isConnected: event.isConnected,
            })
        case 'LOCAL_CARD_PLACED_OPTIMISTICALLY':
            return gameReducer(context.gameState, {
                type: 'local/cardPlacedOptimistically',
                localPlayerId: event.localPlayerId,
                cardId: event.cardId,
                rowIndex: event.rowIndex,
                slotIndex: event.slotIndex,
            })
        case 'LOCAL_CARD_UNPLACED_OPTIMISTICALLY':
            return gameReducer(context.gameState, {
                type: 'local/cardUnplacedOptimistically',
                localPlayerId: event.localPlayerId,
                rowIndex: event.rowIndex,
                slotIndex: event.slotIndex,
            })
        case 'LOCAL_WORD_CLEARED_OPTIMISTICALLY':
            return gameReducer(context.gameState, {
                type: 'local/wordClearedOptimistically',
                localPlayerId: event.localPlayerId,
                rowIndex: event.rowIndex,
            })
        case 'LOCAL_BOARD_CLEARED_OPTIMISTICALLY':
            return gameReducer(context.gameState, {
                type: 'local/boardClearedOptimistically',
                localPlayerId: event.localPlayerId,
            })
        case 'LOCAL_CARD_DISCARDED_OPTIMISTICALLY':
            return gameReducer(context.gameState, {
                type: 'local/cardDiscardedOptimistically',
                localPlayerId: event.localPlayerId,
                cardId: event.cardId,
            })
        case 'LOCAL_DISCARD_PILE_DRAWN_OPTIMISTICALLY':
            return gameReducer(context.gameState, {
                type: 'local/discardPileDrawnOptimistically',
                localPlayerId: event.localPlayerId,
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
