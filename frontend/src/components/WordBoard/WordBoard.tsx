import './WordBoard.css'
import { WordRow } from '../WordRow/WordRow'
import type { WordRowState } from '../WordRow/WordRow'
import type { CardData } from '../Card/Card'
import { Icon } from '../Icon/Icon'
import type { BoardSelection } from '../GameBoard/shortcuts'

export interface WordBoardState {
    rows: WordRowState[]
    allComplete: boolean
}

export interface WordBoardProps {
    /** Full word board state from GameState for the local player. */
    wordBoard: WordBoardState
    /** ID of the drawn card, even if it has been placed on the board. */
    drawnCardId?: string | null
    /** ID of the card that should flash before automatic discard. */
    willAutoDiscardCardId?: string | null
    /** Called when a card is dropped into a slot. */
    onPlace?: (cardId: string, rowIndex: number, slotIndex: number) => void
    /** Called when a card is dragged out of a slot. */
    onUnplace?: (rowIndex: number, slotIndex: number) => void
    /** Called when all cards in a row should be returned to hand. */
    onClearWord?: (rowIndex: number) => void
    /** Currently selected board slot for keyboard shortcuts. */
    selectedSlot?: BoardSelection | null
    /** Called when a word slot is selected. */
    onSlotSelected?: (rowIndex: number, slotIndex: number) => void
    /** Called when drag starts from a slot, with source coordinates. */
    onCardDragStart?: (cardId: string, rowIndex: number, slotIndex: number) => void
    /** Called when a drag operation from a slot ends. */
    onCardDragEnd?: () => void
    /** Called when a placed card is clicked (keyboard-based move support). */
    onCardSelected?: (card: CardData, rowIndex: number, slotIndex: number) => void
}

export function WordBoard({
    wordBoard,
    drawnCardId = null,
    willAutoDiscardCardId = null,
    onPlace,
    onUnplace,
    onClearWord,
    selectedSlot = null,
    onSlotSelected,
    onCardDragStart,
    onCardDragEnd,
    onCardSelected,
}: WordBoardProps) {
    const className = [
        'word-board',
        wordBoard.allComplete && 'word-board--complete',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={className} aria-label="Your word board">
            {wordBoard.rows.map((rowState, index) => (
                <div key={index} className="word-board__row-wrapper">
                    <span className="word-board__row-label" aria-hidden="true">
                        Word {index + 1} ({rowState.targetLength})
                    </span>
                    <WordRow
                        rowState={rowState}
                        rowIndex={index}
                        drawnCardId={drawnCardId}
                        willAutoDiscardCardId={willAutoDiscardCardId}
                        isSelected={selectedSlot?.rowIndex === index}
                        selectedSlotIndex={selectedSlot?.rowIndex === index ? selectedSlot.slotIndex : null}
                        onPlace={onPlace}
                        onUnplace={onUnplace}
                        onSlotSelected={onSlotSelected}
                        onCardDragStart={onCardDragStart}
                        onCardDragEnd={onCardDragEnd}
                        onCardSelected={onCardSelected}
                    />
                    {onClearWord && (
                        <button
                            className="word-board__clear-row-btn"
                            type="button"
                            onClick={() => onClearWord(index)}
                            disabled={!rowState.slots.some((slot) => slot.card !== null)}
                            aria-label={`Clear word row ${index + 1}`}
                            title={`Clear word ${index + 1}`}
                        >
                            <Icon name="clear" className="word-board__clear-row-icon" />
                        </button>
                    )}
                </div>
            ))}
        </div>
    )
}
