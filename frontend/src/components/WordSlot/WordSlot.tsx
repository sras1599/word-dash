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
    /** True during the local player's arrange phase — accepts drops. */
    isActive: boolean
    /** `true` = valid word; `false` = invalid word; `null` = not yet checked. */
    isValid: boolean | null
    /** Called when a card is dropped into this slot. */
    onPlace?: (cardId: string, rowIndex: number, slotIndex: number) => void
    /** Called when the card in this slot begins being dragged away. */
    onUnplace?: (rowIndex: number, slotIndex: number) => void
    /** Called when the placed card is clicked (keyboard-based move support). */
    onCardSelected?: (card: CardData, rowIndex: number, slotIndex: number) => void
}

export function WordSlot({
    slotIndex,
    rowIndex,
    card,
    isActive,
    isValid,
    onPlace,
    onUnplace,
    onCardSelected,
}: WordSlotProps) {
    const [isDragOver, setIsDragOver] = useState(false)

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isActive) return
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
        if (!isActive) return
        const cardId = e.dataTransfer.getData('text/plain')
        if (cardId) {
            onPlace?.(cardId, rowIndex, slotIndex)
        }
    }

    const handleCardDragStart = (cardId: string) => {
        onUnplace?.(rowIndex, slotIndex)
        // Pass cardId through dataTransfer so other slots can receive it
        // (handled by Card's own onDragStart + HTML5 drag API)
        void cardId
    }

    const handleCardClick = () => {
        if (card) {
            onCardSelected?.(card, rowIndex, slotIndex)
        }
    }

    const className = [
        'word-slot',
        card ? 'word-slot--filled' : 'word-slot--empty',
        isActive && 'word-slot--active',
        isActive && isDragOver && 'word-slot--drag-over',
        !isActive && 'word-slot--locked',
        isValid === true && 'word-slot--valid',
        isValid === false && 'word-slot--invalid',
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
                    draggable={isActive}
                    readOnly={!isActive}
                    onClick={isActive ? handleCardClick : undefined}
                    onDragStart={isActive ? handleCardDragStart : undefined}
                />
            ) : (
                <div className="word-slot__placeholder" aria-hidden="true" />
            )}
        </div>
    )
}
