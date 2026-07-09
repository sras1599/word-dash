import type { CardData } from '../Card/Card'
import type { WordBoardState } from '../WordBoard/WordBoard'

export type BoardSelection = {
    rowIndex: number
    slotIndex: number
}

export type ShortcutAction =
    | { type: 'none' }
    | { type: 'select-board'; selection: BoardSelection | null }
    | { type: 'select-hand'; cardId: string | null }
    | { type: 'draw' }
    | { type: 'place'; cardId: string; rowIndex: number; slotIndex: number; selection?: BoardSelection }
    | { type: 'unplace'; rowIndex: number; slotIndex: number }
    | { type: 'discard'; cardId: string; source: 'hand' | 'board' }
    | { type: 'clear-word'; rowIndex: number }
    | { type: 'clear-board' }

export type ShortcutKey = {
    key: string
    shiftKey?: boolean
    altKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
}

export type ShortcutOptions = {
    canDraw: boolean
    canDiscard: boolean
    canEditBoard: boolean
    drawPileCount: number
    hand: CardData[]
    selectedHandCardId: string | null
    selection: BoardSelection | null
    wordBoard: WordBoardState | null
}

const LETTER_PATTERN = /^[a-z]$/i

export function getShortcutAction(keyInfo: ShortcutKey, options: ShortcutOptions): ShortcutAction {
    const { key, shiftKey = false, altKey = false, ctrlKey = false, metaKey = false } = keyInfo
    const hasPrimaryModifier = ctrlKey || metaKey

    if (!hasPrimaryModifier && !altKey && shiftKey && key.toLowerCase() === 'd') {
        return options.canDraw && options.drawPileCount > 0 ? { type: 'draw' } : { type: 'none' }
    }

    if (!options.canEditBoard || !options.wordBoard) {
        return { type: 'none' }
    }

    if (!hasPrimaryModifier && shiftKey && !altKey && key.toLowerCase() === 'h') {
        return options.hand[0] ? { type: 'select-hand', cardId: options.hand[0].id } : { type: 'none' }
    }

    if (!hasPrimaryModifier && shiftKey && !altKey && key.toLowerCase() === 'b') {
        return { type: 'select-board', selection: getBoardSelection(options.wordBoard, options.selection) }
    }

    if (!hasPrimaryModifier && shiftKey && altKey && key === 'Delete') {
        return boardHasCards(options.wordBoard) ? { type: 'clear-board' } : { type: 'none' }
    }

    if (!hasPrimaryModifier && shiftKey && !altKey && key === 'Delete') {
        return getDiscardAction(options)
    }

    if (!hasPrimaryModifier && !altKey && !shiftKey && /^[1-9]$/.test(key)) {
        const rowIndex = Number(key) - 1
        const row = options.wordBoard.rows[rowIndex]
        if (!row) return { type: 'none' }

        return { type: 'select-board', selection: { rowIndex, slotIndex: getFirstEmptySlotIndex(row.slots) } }
    }

    if (!hasPrimaryModifier && !altKey && !shiftKey && key === 'Escape') {
        return { type: 'select-board', selection: null }
    }

    const selection = normalizeSelection(options.wordBoard, options.selection)
    if (!selection) return { type: 'none' }

    if (!hasPrimaryModifier && !altKey && !shiftKey && (key === 'ArrowLeft' || key === 'ArrowRight')) {
        return moveSelectionWithinRow(options.wordBoard, selection, key === 'ArrowLeft' ? -1 : 1)
    }

    if (!hasPrimaryModifier && !altKey && !shiftKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
        return moveSelectionAcrossRows(options.wordBoard, selection, key === 'ArrowUp' ? -1 : 1)
    }

    if (!hasPrimaryModifier && !altKey && shiftKey && (key === 'ArrowLeft' || key === 'ArrowRight')) {
        return moveCardWithinRow(options.wordBoard, selection, key === 'ArrowLeft' ? -1 : 1)
    }

    if (!hasPrimaryModifier && !altKey && key === 'Backspace') {
        if (shiftKey) {
            return { type: 'clear-word', rowIndex: selection.rowIndex }
        }

        const slot = getSlot(options.wordBoard, selection)
        return slot?.card ? { type: 'unplace', rowIndex: selection.rowIndex, slotIndex: selection.slotIndex } : { type: 'none' }
    }

    if (!hasPrimaryModifier && !altKey && !shiftKey && LETTER_PATTERN.test(key)) {
        return placeTypedLetter(options.wordBoard, options.hand, selection, key)
    }

    return { type: 'none' }
}

export function shouldIgnoreShortcutTarget(target: EventTarget | null): boolean {
    if (typeof Element === 'undefined' || !(target instanceof Element)) return false

    const editable = target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
    return editable !== null
}

function getFirstEmptySlotIndex(slots: WordBoardState['rows'][number]['slots']): number {
    return Math.max(0, slots.find((slot) => slot.card === null)?.slotIndex ?? 0)
}

function getBoardSelection(wordBoard: WordBoardState, selection: BoardSelection | null): BoardSelection {
    return normalizeSelection(wordBoard, selection) ?? {
        rowIndex: 0,
        slotIndex: getFirstEmptySlotIndex(wordBoard.rows[0]?.slots ?? []),
    }
}

function normalizeSelection(wordBoard: WordBoardState, selection: BoardSelection | null): BoardSelection | null {
    if (!selection) return null

    const row = wordBoard.rows[selection.rowIndex]
    if (!row) return null

    const slot = row.slots[selection.slotIndex]
    if (!slot) return null

    return selection
}

function getSlot(wordBoard: WordBoardState, selection: BoardSelection) {
    return wordBoard.rows[selection.rowIndex]?.slots[selection.slotIndex] ?? null
}

function moveSelectionWithinRow(wordBoard: WordBoardState, selection: BoardSelection, direction: -1 | 1): ShortcutAction {
    const row = wordBoard.rows[selection.rowIndex]
    const nextSlotIndex = clamp(selection.slotIndex + direction, 0, row.slots.length - 1)

    return { type: 'select-board', selection: { rowIndex: selection.rowIndex, slotIndex: nextSlotIndex } }
}

function moveSelectionAcrossRows(wordBoard: WordBoardState, selection: BoardSelection, direction: -1 | 1): ShortcutAction {
    const nextRowIndex = clamp(selection.rowIndex + direction, 0, wordBoard.rows.length - 1)
    const nextRow = wordBoard.rows[nextRowIndex]
    const nextSlotIndex = clamp(selection.slotIndex, 0, nextRow.slots.length - 1)

    return { type: 'select-board', selection: { rowIndex: nextRowIndex, slotIndex: nextSlotIndex } }
}

function moveCardWithinRow(wordBoard: WordBoardState, selection: BoardSelection, direction: -1 | 1): ShortcutAction {
    const row = wordBoard.rows[selection.rowIndex]
    const sourceSlot = row.slots[selection.slotIndex]
    const targetSlotIndex = selection.slotIndex + direction

    if (!sourceSlot?.card || targetSlotIndex < 0 || targetSlotIndex >= row.slots.length) {
        return { type: 'none' }
    }

    return {
        type: 'place',
        cardId: sourceSlot.card.id,
        rowIndex: selection.rowIndex,
        slotIndex: targetSlotIndex,
        selection: { rowIndex: selection.rowIndex, slotIndex: targetSlotIndex },
    }
}

function placeTypedLetter(
    wordBoard: WordBoardState,
    hand: CardData[],
    selection: BoardSelection,
    typedKey: string,
): ShortcutAction {
    const typedLetter = typedKey.toUpperCase()
    const selectedSlot = getSlot(wordBoard, selection)

    if (!selectedSlot || selectedSlot.card?.letter.toUpperCase() === typedLetter) {
        return { type: 'none' }
    }

    const matchingHandCard = hand.find((card) => card.letter.toUpperCase() === typedLetter)
    if (!matchingHandCard) {
        return { type: 'none' }
    }

    return {
        type: 'place',
        cardId: matchingHandCard.id,
        rowIndex: selection.rowIndex,
        slotIndex: selection.slotIndex,
        selection: getNextEmptySlotSelection(wordBoard, selection),
    }
}

function getNextEmptySlotSelection(wordBoard: WordBoardState, selection: BoardSelection): BoardSelection {
    const row = wordBoard.rows[selection.rowIndex]
    const nextEmptySlot = row.slots.find((slot) => slot.slotIndex > selection.slotIndex && slot.card === null)

    return nextEmptySlot
        ? { rowIndex: selection.rowIndex, slotIndex: nextEmptySlot.slotIndex }
        : selection
}

function getDiscardAction(options: ShortcutOptions): ShortcutAction {
    if (!options.canDiscard || !options.wordBoard) return { type: 'none' }

    if (options.selectedHandCardId && options.hand.some((card) => card.id === options.selectedHandCardId)) {
        return { type: 'discard', cardId: options.selectedHandCardId, source: 'hand' }
    }

    const selection = normalizeSelection(options.wordBoard, options.selection)
    if (!selection) return { type: 'none' }

    const selectedSlot = getSlot(options.wordBoard, selection)
    return selectedSlot?.card
        ? { type: 'discard', cardId: selectedSlot.card.id, source: 'board' }
        : { type: 'none' }
}

function boardHasCards(wordBoard: WordBoardState): boolean {
    return wordBoard.rows.some((row) => row.slots.some((slot) => slot.card !== null))
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}
