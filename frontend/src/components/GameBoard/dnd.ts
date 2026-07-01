type BoardDragSource = {
    cardId: string
    rowIndex: number
    slotIndex: number
}

export type GameBoardDropAction =
    | { type: 'place'; cardId: string; rowIndex: number; slotIndex: number }
    | { type: 'unplace'; rowIndex: number; slotIndex: number }
    | { type: 'discard'; cardId: string }

export function getGameBoardDropAction(
    cardId: string,
    overId: string | null,
    boardSource: BoardDragSource | null,
    options: { canDiscard?: boolean } = {},
): GameBoardDropAction | null {
    if (!overId) return null

    if (overId.startsWith('word-slot:')) {
        const [, rowIndex, slotIndex] = overId.split(':')
        return { type: 'place', cardId, rowIndex: Number(rowIndex), slotIndex: Number(slotIndex) }
    }

    if (overId === 'player-hand' && boardSource?.cardId === cardId) {
        return { type: 'unplace', rowIndex: boardSource.rowIndex, slotIndex: boardSource.slotIndex }
    }

    if (overId === 'discard-pile') {
        if (!options.canDiscard) return null
        return { type: 'discard', cardId }
    }

    return null
}
