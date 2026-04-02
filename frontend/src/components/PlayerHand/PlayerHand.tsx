import './PlayerHand.css'
import { Card, type CardData } from '../Card/Card'

export interface PlayerHandProps {
    /** The player's normal hand cards. */
    hand: CardData[]
    /** The extra card drawn this turn. Null if not in arrange phase. */
    drawnCard?: CardData | null
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
    /** Called when the selected card should be discarded. */
    onDiscard?: (cardId: string) => void
}

export function PlayerHand({
    hand,
    drawnCard = null,
    isDraggable = false,
    selectedCardId = null,
    onCardClick,
    onDragStart,
    onDragEnd,
    onDiscard,
}: PlayerHandProps) {
    const handleCardClick = (cardId: string) => {
        onCardClick?.(cardId)
    }

    const handleDiscardClick = () => {
        if (selectedCardId) onDiscard?.(selectedCardId)
    }

    return (
        <div className="player-hand" role="region" aria-label="Your hand">
            <div className="player-hand__cards">
                {hand.map((card) => (
                    <Card
                        key={card.id}
                        card={card}
                        draggable={isDraggable}
                        selected={selectedCardId === card.id}
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
