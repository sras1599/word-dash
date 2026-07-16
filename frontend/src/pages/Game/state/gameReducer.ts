import { produce } from 'immer'
import type { Card, GameState, TurnPhase, WordBoardState, GamePlayer } from '../../../lib/gameTypes'

export type GameAction =
    | { type: 'game/state'; state: GameState }
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
    }
    | { type: 'game/turnEnded'; nextPlayerId: string; discardPileTop: Card }
    | { type: 'game/turnSkipped'; playerId: string; nextPlayerId?: string }
    | { type: 'game/playerWon'; winnerId: string }
    | { type: 'game/playerConnectionChanged'; playerId: string; isConnected: boolean }
    | { type: 'local/cardPlacedOptimistically'; localPlayerId: string; cardId: string; rowIndex: number; slotIndex: number }
    | { type: 'local/cardUnplacedOptimistically'; localPlayerId: string; rowIndex: number; slotIndex: number }
    | { type: 'local/wordClearedOptimistically'; localPlayerId: string; rowIndex: number }
    | { type: 'local/boardClearedOptimistically'; localPlayerId: string }
    | { type: 'local/cardDiscardedOptimistically'; localPlayerId: string; cardId: string }
    | { type: 'local/discardPileDrawnOptimistically'; localPlayerId: string }

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

type BoardLocation = {
    rowIndex: number
    slotIndex: number
}

type CardLocation = { type: 'hand'; index: number } | ({ type: 'board' } & BoardLocation)

function getSlot(wordBoard: WordBoardState, rowIndex: number, slotIndex: number) {
    return wordBoard.rows[rowIndex]?.slots[slotIndex] ?? null
}

function markCardRemovedFromBoard(wordBoard: WordBoardState, rowIndex: number) {
    const row = wordBoard.rows[rowIndex]
    if (!row) return

    row.isComplete = false
    wordBoard.allComplete = false
}

function findCardLocation(player: NonNullable<GamePlayer>, cardId: string): CardLocation | null {
    const hand = player.hand ?? []
    const handIndex = hand.findIndex((card) => card.id === cardId)
    if (handIndex !== -1) {
        return { type: 'hand', index: handIndex }
    }

    for (let rowIndex = 0; rowIndex < player.wordBoard.rows.length; rowIndex += 1) {
        const row = player.wordBoard.rows[rowIndex]
        for (let slotIndex = 0; slotIndex < row.slots.length; slotIndex += 1) {
            if (row.slots[slotIndex].card?.id === cardId) {
                return { type: 'board', rowIndex, slotIndex }
            }
        }
    }

    return null
}

function removeCardAtLocation(
    player: NonNullable<GamePlayer>,
    location: CardLocation,
): Card | null {
    if (location.type === 'hand') {
        const hand = player.hand ?? []
        const [card] = hand.splice(location.index, 1)
        player.hand = hand
        player.handCount = hand.length
        return card ?? null
    }

    const sourceSlot = getSlot(player.wordBoard, location.rowIndex, location.slotIndex)
    const card = sourceSlot?.card ?? null
    if (!sourceSlot || !card) return null

    sourceSlot.card = null
    markCardRemovedFromBoard(player.wordBoard, location.rowIndex)
    return card
}

function addCardToHand(player: NonNullable<GamePlayer>, card: Card) {
    const hand = player.hand ?? []
    hand.push(card)
    player.hand = hand
    player.handCount = hand.length
}

function clearWordRow(player: NonNullable<GamePlayer>, rowIndex: number) {
    const row = player.wordBoard.rows[rowIndex]
    if (!row) return

    let cleared = false
    for (const slot of row.slots) {
        if (!slot.card) continue
        addCardToHand(player, slot.card)
        slot.card = null
        cleared = true
    }

    row.isComplete = false
    if (cleared || player.wordBoard.allComplete) {
        player.wordBoard.allComplete = false
    }
}

function clearWordBoard(player: NonNullable<GamePlayer>) {
    for (let rowIndex = 0; rowIndex < player.wordBoard.rows.length; rowIndex += 1) {
        clearWordRow(player, rowIndex)
    }
}

function getNextPlayerId(state: GameState, currentPlayerId: string): string {
    const currentIndex = state.players.findIndex((player) => player.id === currentPlayerId)
    if (currentIndex === -1) return state.players[0]?.id ?? currentPlayerId
    return state.players[(currentIndex + 1) % state.players.length]?.id ?? currentPlayerId
}

export function gameReducer(state: GameState | null, action: GameAction): GameState | null {
    if (action.type === 'game/state') return action.state
    if (!state) return state

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
            case 'local/cardPlacedOptimistically': {
                if (!canPlaceCard(draft)) break
                const player = draft.players.find((p) => p.id === action.localPlayerId)
                if (!player) break

                const source = findCardLocation(player, action.cardId)
                const targetSlot = getSlot(player.wordBoard, action.rowIndex, action.slotIndex)
                if (!source || !targetSlot) break
                if (source.type === 'board' && source.rowIndex === action.rowIndex && source.slotIndex === action.slotIndex) {
                    break
                }

                if (source.type === 'board' && targetSlot.card) {
                    const sourceSlot = getSlot(player.wordBoard, source.rowIndex, source.slotIndex)
                    if (!sourceSlot?.card) break

                    const movingCard = sourceSlot.card
                    sourceSlot.card = targetSlot.card
                    targetSlot.card = movingCard
                    markCardRemovedFromBoard(player.wordBoard, source.rowIndex)
                    markCardRemovedFromBoard(player.wordBoard, action.rowIndex)
                    break
                }

                const movingCard = removeCardAtLocation(player, source)
                if (!movingCard) break

                const displacedCard = targetSlot.card
                targetSlot.card = movingCard
                if (displacedCard) {
                    addCardToHand(player, displacedCard)
                }
                break
            }
            case 'local/cardUnplacedOptimistically': {
                if (!canPlaceCard(draft)) break
                const player = draft.players.find((p) => p.id === action.localPlayerId)
                const sourceSlot = player ? getSlot(player.wordBoard, action.rowIndex, action.slotIndex) : null
                const card = sourceSlot?.card ?? null
                if (!player || !sourceSlot || !card) break

                sourceSlot.card = null
                markCardRemovedFromBoard(player.wordBoard, action.rowIndex)
                addCardToHand(player, card)
                break
            }
            case 'local/wordClearedOptimistically': {
                if (!canPlaceCard(draft)) break
                const player = draft.players.find((p) => p.id === action.localPlayerId)
                if (!player) break

                clearWordRow(player, action.rowIndex)
                break
            }
            case 'local/boardClearedOptimistically': {
                if (!canPlaceCard(draft)) break
                const player = draft.players.find((p) => p.id === action.localPlayerId)
                if (!player) break

                clearWordBoard(player)
                break
            }
            case 'local/cardDiscardedOptimistically': {
                if (!canDiscardCard(draft, action.localPlayerId)) break
                const player = draft.players.find((p) => p.id === action.localPlayerId)
                if (!player) break

                const source = findCardLocation(player, action.cardId)
                if (!source) break

                const discardedCard = removeCardAtLocation(player, source)
                if (!discardedCard) break

                draft.discardPileTop = discardedCard
                draft.turn.currentPlayerId = getNextPlayerId(draft, draft.turn.currentPlayerId)
                draft.turn.phase = 'draw' as TurnPhase
                draft.turn.drawnCard = null
                break
            }
            case 'local/discardPileDrawnOptimistically': {
                if (!canDrawCard(draft, action.localPlayerId)) break
                const player = draft.players.find((p) => p.id === action.localPlayerId)
                const drawnCard = draft.discardPileTop
                if (!player || !drawnCard) break

                addCardToHand(player, drawnCard)
                draft.discardPileTop = null
                draft.turn.phase = 'arrange' as TurnPhase
                draft.turn.drawnCard = drawnCard
                break
            }
        }
    })
}
