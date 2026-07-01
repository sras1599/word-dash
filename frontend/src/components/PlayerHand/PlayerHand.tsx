import { useState } from 'react'
import './PlayerHand.css'
import { Card, type CardData } from '../Card/Card'

export interface PlayerHandProps {
    /** The player's normal hand cards. */
    hand: CardData[]
    /** The extra card drawn this turn. Null if not in arrange phase. */
    drawnCard?: CardData | null
    /** ID of the drawn card when it is already present in the hand array. */
    drawnCardId?: string | null
    /** ID of the card that should flash before automatic discard. */
    willAutoDiscardCardId?: string | null
    /** Whether cards can be dragged. Only true during local player's own turn. */
    isDraggable?: boolean
    /** The currently selected card id, for keyboard or click-based discard flow. */
    selectedCardId?: string | null
    /** Called when a card is clicked. */
    onCardClick?: (cardId: string) => void
    /** Called when a drag starts, receives the card id. */
    onDragStart?: (cardId: string) => void
    /** Called when a drag ends (success or failure). */
    onDragEnd?: () => void
    /** Called when a card is dropped onto the hand area. */
    onDropOnHand?: (cardId: string) => void
    /** Called when the selected card should be discarded. */
    onDiscard?: (cardId: string) => void
}

export function PlayerHand({
    hand,
    drawnCard = null,
    drawnCardId = null,
    willAutoDiscardCardId = null,
    isDraggable = false,
    selectedCardId = null,
    onCardClick,
    onDragStart,
    onDragEnd,
    onDropOnHand,
    onDiscard,
}: PlayerHandProps) {
    const [isDragOver, setIsDragOver] = useState(false)

    const handleCardClick = (cardId: string) => {
        onCardClick?.(cardId)
    }

    const canDropOnHand = isDraggable && !!onDropOnHand

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!canDropOnHand) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false)
        }
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (!canDropOnHand) return
        e.preventDefault()
        setIsDragOver(false)
        const cardId = e.dataTransfer.getData('text/plain')
        if (cardId) {
            onDropOnHand?.(cardId)
        }
    }

    const handleDiscardClick = () => {
        if (selectedCardId) onDiscard?.(selectedCardId)
    }

    const className = [
        'player-hand',
        canDropOnHand && 'player-hand--drop-target',
        isDragOver && 'player-hand--drag-over',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div
            className={className}
            role="region"
            aria-label="Your hand"
            onDragOver={canDropOnHand ? handleDragOver : undefined}
            onDragLeave={canDropOnHand ? handleDragLeave : undefined}
            onDrop={canDropOnHand ? handleDrop : undefined}
        >
            <div className="player-hand__cards">
                {hand.map((card) => (
                    <Card
                        key={card.id}
                        card={card}
                        draggable={isDraggable}
                        selected={selectedCardId === card.id}
                        isDrawn={drawnCardId === card.id}
                        willAutoDiscard={willAutoDiscardCardId === card.id}
                        onClick={() => handleCardClick(card.id)}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                    />
                ))}

                {drawnCard && (
                    <>
                        <div className="player-hand__divider" aria-hidden="true" />
                        <div className="player-hand__drawn-wrapper">
                            <Card
                                card={drawnCard}
                                draggable={isDraggable}
                                isDrawn
                                willAutoDiscard={willAutoDiscardCardId === drawnCard.id}
                                selected={selectedCardId === drawnCard.id}
                                onClick={() => handleCardClick(drawnCard.id)}
                                onDragStart={onDragStart}
                                onDragEnd={onDragEnd}
                            />
                        </div>
                    </>
                )}
            </div>

            {selectedCardId && onDiscard && (
                <button
                    className="player-hand__discard-btn"
                    onClick={handleDiscardClick}
                    aria-label="Discard selected card"
                >
                    Discard
                </button>
            )}
        </div>
    )
}
