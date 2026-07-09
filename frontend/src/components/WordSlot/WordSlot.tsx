import { useDroppable } from '@dnd-kit/core'
import './WordSlot.css'
import { Card } from '../Card/Card'
import type { CardData } from '../Card/Card'

export interface WordSlotProps {
    /** 0-based position of this slot within its word row. */
    slotIndex: number
    /** Which word row this slot belongs to. */
    rowIndex: number
    /** Card currently placed here. `null` means the slot is empty. */
    card: CardData | null
    /** ID of the card that should flash before automatic discard. */
    willAutoDiscardCardId?: string | null
    /** Whether this slot is selected for keyboard shortcuts. */
    isSelected?: boolean
    /** Called when a card is dropped into this slot. */
    onPlace?: (cardId: string, rowIndex: number, slotIndex: number) => void
    /** Called when the card in this slot begins being dragged away. */
    onUnplace?: (rowIndex: number, slotIndex: number) => void
    /** Called when this slot is selected. */
    onSlotSelected?: (rowIndex: number, slotIndex: number) => void
    /** Called when drag starts from this slot, with source coordinates. */
    onCardDragStart?: (cardId: string, rowIndex: number, slotIndex: number) => void
    /** Called when a drag operation from this slot ends. */
    onCardDragEnd?: () => void
    /** Called when the placed card is clicked (keyboard-based move support). */
    onCardSelected?: (card: CardData, rowIndex: number, slotIndex: number) => void
}

export function WordSlot({
    slotIndex,
    rowIndex,
    card,
    willAutoDiscardCardId = null,
    isSelected = false,
    onPlace,
    onSlotSelected,
    onCardDragStart,
    onCardDragEnd,
    onCardSelected,
}: WordSlotProps) {
    const canPlace = !!onPlace
    const canDragCard = !!onCardDragStart
    const { isOver, setNodeRef } = useDroppable({
        id: `word-slot:${rowIndex}:${slotIndex}`,
        disabled: !canPlace,
        data: { type: 'word-slot', rowIndex, slotIndex },
    })

    const handleCardDragStart = (cardId: string) => {
        onCardDragStart?.(cardId, rowIndex, slotIndex)
    }

    const handleCardDragEnd = () => {
        onCardDragEnd?.()
    }

    const handleCardClick = () => {
        if (card) {
            onCardSelected?.(card, rowIndex, slotIndex)
        }
    }

    const handleSlotClick = () => {
        onSlotSelected?.(rowIndex, slotIndex)
    }

    const className = [
        'word-slot',
        card ? 'word-slot--filled' : 'word-slot--empty',
        isOver && 'word-slot--drag-over',
        isSelected && 'word-slot--selected',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div
            ref={setNodeRef}
            className={className}
            onClick={onSlotSelected ? handleSlotClick : undefined}
            aria-label={
                card
                    ? `Slot ${slotIndex + 1}, contains letter ${card.letter}`
                    : `Slot ${slotIndex + 1}, empty`
            }
            aria-current={isSelected ? 'true' : undefined}
            data-slot-index={slotIndex}
            data-row-index={rowIndex}
        >
            {card ? (
                <Card
                    card={card}
                    draggable={canDragCard}
                    readOnly={!canDragCard && !onCardSelected}
                    selected={isSelected}
                    willAutoDiscard={card.id === willAutoDiscardCardId}
                    onClick={handleCardClick}
                    onDragStart={handleCardDragStart}
                    onDragEnd={handleCardDragEnd}
                    dragData={{ source: 'board', cardId: card.id, rowIndex, slotIndex }}
                />
            ) : (
                <div className="word-slot__placeholder" aria-hidden="true" />
            )}
        </div>
    )
}
