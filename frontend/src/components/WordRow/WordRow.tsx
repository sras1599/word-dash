import './WordRow.css'
import { WordSlot } from '../WordSlot/WordSlot'
import type { CardData } from '../Card/Card'

export interface WordSlotState {
    slotIndex: number
    card: CardData | null
}

export interface WordRowState {
    targetLength: number
    slots: WordSlotState[]
    isComplete: boolean
}

export interface WordRowProps {
    /** Full row state from GameState (slots, targetLength, isComplete). */
    rowState: WordRowState
    /** The row's index within the player's word board. */
    rowIndex: number
    /** Called when a card is dropped into a slot. */
    onPlace?: (cardId: string, rowIndex: number, slotIndex: number) => void
    /** Called when a card is dragged out of a slot. */
    onUnplace?: (rowIndex: number, slotIndex: number) => void
    /** Called when a placed card is clicked (keyboard-based move support). */
    onCardSelected?: (card: CardData, rowIndex: number, slotIndex: number) => void
}

function deriveIsValid(rowState: WordRowState): boolean | null {
    if (rowState.isComplete) return true
    const allFilled = rowState.slots.every((s) => s.card !== null)
    if (allFilled) return false
    return null
}

export function WordRow({
    rowState,
    rowIndex,
    onPlace,
    onUnplace,
    onCardSelected,
}: WordRowProps) {
    const isValid = deriveIsValid(rowState)

    const className = [
        'word-row',
        isValid === true && 'word-row--valid',
        isValid === false && 'word-row--invalid',
    ]
        .filter(Boolean)
        .join(' ')

    const sortedSlots = [...rowState.slots].sort((a, b) => a.slotIndex - b.slotIndex)

    return (
        <div
            className={className}
            aria-label={`Word row ${rowIndex + 1}, ${rowState.targetLength} letters`}
        >
            {sortedSlots.map((slot) => (
                <WordSlot
                    key={slot.slotIndex}
                    slotIndex={slot.slotIndex}
                    rowIndex={rowIndex}
                    card={slot.card}
                    onPlace={onPlace}
                    onUnplace={onUnplace}
                    onCardSelected={onCardSelected}
                />
            ))}
        </div>
    )
}
