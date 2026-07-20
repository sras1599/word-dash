import { produce } from 'immer'
import type { Card, GamePlayer, GameState, WordBoardState } from '../../../lib/gameTypes'

export type PendingBoardOperation =
    | { type: 'place'; clientActionId: string; cardId: string; rowIndex: number; slotIndex: number }
    | { type: 'unplace'; clientActionId: string; rowIndex: number; slotIndex: number }
    | { type: 'clear-word'; clientActionId: string; rowIndex: number }
    | { type: 'clear-board'; clientActionId: string }
    | { type: 'discard'; clientActionId: string; cardId: string }

type BoardLocation = { rowIndex: number; slotIndex: number }
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

function findCardLocation(player: GamePlayer, cardId: string): CardLocation | null {
    const handIndex = (player.hand ?? []).findIndex((card) => card.id === cardId)
    if (handIndex !== -1) return { type: 'hand', index: handIndex }

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

function removeCardAtLocation(player: GamePlayer, location: CardLocation): Card | null {
    if (location.type === 'hand') {
        const hand = player.hand ?? []
        const [card] = hand.splice(location.index, 1)
        player.hand = hand
        player.handCount = hand.length
        return card ?? null
    }

    const slot = getSlot(player.wordBoard, location.rowIndex, location.slotIndex)
    const card = slot?.card ?? null
    if (!slot || !card) return null
    slot.card = null
    markCardRemovedFromBoard(player.wordBoard, location.rowIndex)
    return card
}

function addCardToHand(player: GamePlayer, card: Card) {
    const hand = player.hand ?? []
    if (!hand.some((candidate) => candidate.id === card.id)) hand.push(card)
    player.hand = hand
    player.handCount = hand.length
}

function clearWordRow(player: GamePlayer, rowIndex: number) {
    const row = player.wordBoard.rows[rowIndex]
    if (!row) return
    for (const slot of row.slots) {
        if (!slot.card) continue
        addCardToHand(player, slot.card)
        slot.card = null
    }
    row.isComplete = false
    player.wordBoard.allComplete = false
}

function getNextPlayerId(state: GameState, currentPlayerId: string): string {
    const currentIndex = state.players.findIndex((player) => player.id === currentPlayerId)
    if (currentIndex === -1) return state.players[0]?.id ?? currentPlayerId
    return state.players[(currentIndex + 1) % state.players.length]?.id ?? currentPlayerId
}

export function applyBoardOperation(
    state: GameState,
    localPlayerId: string,
    operation: PendingBoardOperation,
): GameState {
    return produce(state, (draft) => {
        const player = draft.players.find((candidate) => candidate.id === localPlayerId)
        if (!player) return

        switch (operation.type) {
            case 'place': {
                const source = findCardLocation(player, operation.cardId)
                const target = getSlot(player.wordBoard, operation.rowIndex, operation.slotIndex)
                if (!source || !target) return
                if (source.type === 'board' && source.rowIndex === operation.rowIndex && source.slotIndex === operation.slotIndex) return

                if (source.type === 'board' && target.card) {
                    const sourceSlot = getSlot(player.wordBoard, source.rowIndex, source.slotIndex)
                    if (!sourceSlot?.card) return
                    const moving = sourceSlot.card
                    sourceSlot.card = target.card
                    target.card = moving
                    markCardRemovedFromBoard(player.wordBoard, source.rowIndex)
                    markCardRemovedFromBoard(player.wordBoard, operation.rowIndex)
                    return
                }

                const moving = removeCardAtLocation(player, source)
                if (!moving) return
                const displaced = target.card
                target.card = moving
                if (displaced) addCardToHand(player, displaced)
                return
            }
            case 'unplace': {
                const source = getSlot(player.wordBoard, operation.rowIndex, operation.slotIndex)
                if (!source?.card) return
                const card = source.card
                source.card = null
                markCardRemovedFromBoard(player.wordBoard, operation.rowIndex)
                addCardToHand(player, card)
                return
            }
            case 'clear-word':
                clearWordRow(player, operation.rowIndex)
                return
            case 'clear-board':
                for (let rowIndex = 0; rowIndex < player.wordBoard.rows.length; rowIndex += 1) {
                    clearWordRow(player, rowIndex)
                }
                return
            case 'discard': {
                const source = findCardLocation(player, operation.cardId)
                if (!source) return
                const discarded = removeCardAtLocation(player, source)
                if (!discarded) return
                draft.discardPileTop = discarded
                draft.turn.currentPlayerId = getNextPlayerId(draft, draft.turn.currentPlayerId)
                draft.turn.phase = 'draw'
                draft.turn.drawnCard = null
            }
        }
    })
}

export function projectGameState(
    authoritativeGameState: GameState | null,
    localPlayerId: string,
    pendingBoardOperations: PendingBoardOperation[],
): GameState | null {
    return pendingBoardOperations.reduce<GameState | null>(
        (projected, operation) => projected ? applyBoardOperation(projected, localPlayerId, operation) : null,
        authoritativeGameState,
    )
}
