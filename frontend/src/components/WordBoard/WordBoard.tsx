import './WordBoard.css'
import { WordRow } from '../WordRow/WordRow'
import type { WordRowState } from '../WordRow/WordRow'
import type { CardData } from '../Card/Card'

export interface WordBoardState {
    rows: WordRowState[]
    allComplete: boolean
}

export interface WordBoardProps {
    /** Full word board state from GameState for the local player. */
    wordBoard: WordBoardState
    /** Called when a card is dropped into a slot. */
    onPlace?: (cardId: string, rowIndex: number, slotIndex: number) => void
    /** Called when a card is dragged out of a slot. */
    onUnplace?: (rowIndex: number, slotIndex: number) => void
    /** Called when a placed card is clicked (keyboard-based move support). */
    onCardSelected?: (card: CardData, rowIndex: number, slotIndex: number) => void
}

export function WordBoard({ wordBoard, onPlace, onUnplace, onCardSelected }: WordBoardProps) {
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
                        onPlace={onPlace}
                        onUnplace={onUnplace}
                        onCardSelected={onCardSelected}
                    />
                </div>
            ))}
        </div>
    )
}
