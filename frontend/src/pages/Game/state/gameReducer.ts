import { produce } from 'immer'
import type { Card, GameState, TurnPhase, WordBoardState } from '../../../lib/gameTypes'

export const LOCAL_COUNTDOWN_STEP_MS = 1000

export type GameAction =
    | { type: 'game/state'; state: GameState }
    | { type: 'game/turnStarted'; currentPlayerId: string; timeRemainingMs: number }
    | {
          type: 'game/cardDrawn'
          localPlayerId: string
          playerId: string
          card: Card | null
          drawPileCount: number
          discardPileTop: Card | null
          timeRemainingMs?: number
      }
    | {
          type: 'game/boardUpdated'
          localPlayerId: string
          playerId: string
          wordBoard: WordBoardState
          handCount: number
          hand?: Card[]
      }
    | { type: 'game/timerWarning'; currentPlayerId?: string; timeRemainingMs: number }
    | { type: 'game/turnEnded'; nextPlayerId: string; discardPileTop: Card; timeRemainingMs?: number }
    | { type: 'game/turnSkipped'; playerId: string; nextPlayerId?: string; timeRemainingMs?: number }
    | { type: 'game/playerWon'; winnerId: string }
    | { type: 'game/playerConnectionChanged'; playerId: string; isConnected: boolean }
    | { type: 'local/timerTick' }
    | { type: 'local/cardPlacedOptimistically'; localPlayerId: string; cardId: string; rowIndex: number; slotIndex: number }

export function canPlaceCard(state: GameState | null): boolean {
    if (!state) return false
    if (state.phase !== 'playing') return false
    return state.turn.phase === 'draw' || state.turn.phase === 'arrange'
}

export function gameReducer(state: GameState | null, action: GameAction): GameState | null {
    if (action.type === 'game/state') return action.state
    if (!state) return state

    return produce(state, (draft) => {
        switch (action.type) {
            case 'game/turnStarted':
                draft.turn.currentPlayerId = action.currentPlayerId
                draft.turn.phase = 'draw'
                draft.turn.timeRemainingMs = action.timeRemainingMs
                draft.turn.drawnCard = null
                break
            case 'game/cardDrawn': {
                const player = draft.players.find((p) => p.id === action.playerId)
                if (player) {
                    player.handCount += 1
                    if (player.id === action.localPlayerId) {
                        const newCard = action.card ?? { id: `unknown-${Date.now()}`, letter: '?' }
                        player.hand = [...(player.hand ?? []), newCard]
                    }
                }
                draft.drawPileCount = action.drawPileCount
                draft.discardPileTop = action.discardPileTop
                draft.turn.phase = 'arrange' as TurnPhase
                draft.turn.timeRemainingMs =
                    typeof action.timeRemainingMs === 'number'
                        ? Math.max(0, action.timeRemainingMs)
                        : draft.turn.timeRemainingMs
                draft.turn.drawnCard = action.playerId === action.localPlayerId ? action.card : draft.turn.drawnCard
                break
            }
            case 'game/boardUpdated': {
                const player = draft.players.find((p) => p.id === action.playerId)
                if (player) {
                    player.wordBoard = action.wordBoard
                    player.handCount = action.handCount
                    if (player.id === action.localPlayerId && action.hand) {
                        player.hand = action.hand
                    }
                }
                break
            }
            case 'game/timerWarning':
                draft.turn.currentPlayerId = action.currentPlayerId ?? draft.turn.currentPlayerId
                draft.turn.timeRemainingMs = Math.max(0, action.timeRemainingMs)
                break
            case 'game/turnEnded':
                draft.discardPileTop = action.discardPileTop
                draft.turn.currentPlayerId = action.nextPlayerId
                draft.turn.phase = 'draw' as TurnPhase
                draft.turn.timeRemainingMs =
                    typeof action.timeRemainingMs === 'number' ? action.timeRemainingMs : draft.turn.timeRemainingMs
                draft.turn.drawnCard = null
                break
            case 'game/turnSkipped': {
                const idx = draft.players.findIndex((player) => player.id === action.playerId)
                const nextIdx = idx === -1 ? 0 : (idx + 1) % draft.players.length
                draft.turn.currentPlayerId = action.nextPlayerId ?? draft.players[nextIdx].id
                draft.turn.phase = 'draw' as TurnPhase
                draft.turn.timeRemainingMs =
                    typeof action.timeRemainingMs === 'number' ? action.timeRemainingMs : draft.turn.timeRemainingMs
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
            case 'local/timerTick':
                if (draft.phase !== 'playing') break
                if (draft.turn.phase === 'idle') break
                if (draft.turn.timeRemainingMs <= 0) break
                draft.turn.timeRemainingMs = Math.max(0, draft.turn.timeRemainingMs - LOCAL_COUNTDOWN_STEP_MS)
                break
            case 'local/cardPlacedOptimistically': {
                if (!canPlaceCard(draft)) break
                const player = draft.players.find((p) => p.id === action.localPlayerId)
                const hand = player?.hand ?? []
                const cardIndex = hand.findIndex((card) => card.id === action.cardId)
                if (!player || cardIndex === -1) break

                const swappedCard = player.wordBoard.rows[action.rowIndex]?.slots[action.slotIndex]?.card ?? null
                if (swappedCard) {
                    hand[cardIndex] = swappedCard
                } else {
                    hand.splice(cardIndex, 1)
                }
                player.hand = hand
                player.handCount = hand.length
                break
            }
        }
    })
}
