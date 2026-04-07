import React, { useState } from 'react'
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
    /** Called when a card is dropped into this slot. */
    onPlace?: (cardId: string, rowIndex: number, slotIndex: number) => void
    /** Called when the card in this slot begins being dragged away. */
    onUnplace?: (rowIndex: number, slotIndex: number) => void
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
    onPlace,
    onUnplace: _onUnplace,
    onCardDragStart,
    onCardDragEnd,
    onCardSelected,
}: WordSlotProps) {
    const [isDragOver, setIsDragOver] = useState(false)

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        // Only clear if we're actually leaving the slot boundary
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false)
        }
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragOver(false)
        const cardId = e.dataTransfer.getData('text/plain')
        if (cardId) {
            onPlace?.(cardId, rowIndex, slotIndex)
        }
    }

    const handleCardDragStart = (cardId: string) => {
        onCardDragStart?.(cardId, rowIndex, slotIndex)
        // Pass cardId through dataTransfer so other slots can receive it
        // (handled by Card's own onDragStart + HTML5 drag API)
        void cardId
    }

    const handleCardDragEnd = () => {
        onCardDragEnd?.()
    }

    const handleCardClick = () => {
        if (card) {
            onCardSelected?.(card, rowIndex, slotIndex)
        }
    }

    const className = [
        'word-slot',
        card ? 'word-slot--filled' : 'word-slot--empty',
        isDragOver && 'word-slot--drag-over',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div
            className={className}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-label={
                card
                    ? `Slot ${slotIndex + 1}, contains letter ${card.letter}`
                    : `Slot ${slotIndex + 1}, empty`
            }
            data-slot-index={slotIndex}
            data-row-index={rowIndex}
        >
            {card ? (
                <Card
                    card={card}
                    draggable={true}
                    readOnly={false}
                    onClick={handleCardClick}
                    onDragStart={handleCardDragStart}
                    onDragEnd={handleCardDragEnd}
                />
            ) : (
                <div className="word-slot__placeholder" aria-hidden="true" />
            )}
        </div>
    )
}
