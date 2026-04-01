import React from 'react'
import './CardPile.css'
import { Card, type CardData } from '../Card/Card'

export interface CardPileProps {
    /** Which pile this component represents. */
    type: 'draw' | 'discard'
    /** The top card to display face-up in the discard pile. Irrelevant for the draw pile (always shown face-down). */
    topCard: CardData | null
    /** Total cards in the pile. Drives the badge on the draw pile and empty-state rendering. */
    cardCount: number
    /** True when it is the local player's draw phase — enables click interaction. */
    isActive?: boolean
    /** True during arrange phase — the discard pile can accept card drops. */
    isDropTarget?: boolean
    /** Called when the pile is clicked during the draw phase. */
    onDraw?: (type: 'draw' | 'discard') => void
    /** Called when a card is dropped onto the discard pile during the arrange phase. */
    onDiscard?: (cardId: string) => void
}

export function CardPile({
    type,
    topCard,
    cardCount,
    isActive = false,
    isDropTarget = false,
    onDraw,
    onDiscard,
}: CardPileProps) {
    const [isDragOver, setIsDragOver] = React.useState(false)

    const isInteractive = isActive && !!onDraw
    const canDrop = isDropTarget && type === 'discard'
    const isEmpty = cardCount === 0

    const handleClick = () => {
        if (isInteractive) onDraw?.(type)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!isInteractive) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onDraw?.(type)
        }
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!canDrop) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setIsDragOver(true)
    }

    const handleDragLeave = () => {
        setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (!canDrop) return
        e.preventDefault()
        setIsDragOver(false)
        const cardId = e.dataTransfer.getData('text/plain')
        if (cardId) onDiscard?.(cardId)
    }

    const className = [
        'card-pile',
        `card-pile--${type}`,
        isActive && 'card-pile--active',
        canDrop && 'card-pile--drop-target',
        isDragOver && 'card-pile--drag-over',
        isInteractive && 'card-pile--interactive',
        isEmpty && 'card-pile--empty',
    ]
        .filter(Boolean)
        .join(' ')

    const ariaLabel =
        type === 'draw'
            ? `Draw pile, ${cardCount} card${cardCount !== 1 ? 's' : ''}`
            : topCard
                ? `Discard pile, top card is ${topCard.letter}`
                : 'Discard pile, empty'

    return (
        <div
            className={className}
            onClick={isInteractive ? handleClick : undefined}
            onKeyDown={isInteractive ? handleKeyDown : undefined}
            onDragOver={canDrop ? handleDragOver : undefined}
            onDragLeave={canDrop ? handleDragLeave : undefined}
            onDrop={canDrop ? handleDrop : undefined}
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            aria-label={ariaLabel}
        >
            <div className="card-pile__stack">
                {/* Stack illusion: ghost cards peek out from behind the top card */}
                {!isEmpty && cardCount > 2 && (
                    <div className="card-pile__ghost card-pile__ghost--2" aria-hidden="true" />
                )}
                {!isEmpty && cardCount > 1 && (
                    <div className="card-pile__ghost card-pile__ghost--1" aria-hidden="true" />
                )}
                <Card
                    card={type === 'discard' ? topCard : null}
                    faceDown={type === 'draw' && !isEmpty}
                />
            </div>
            {type === 'draw' && (
                <span className="card-pile__badge" aria-hidden="true">
                    {cardCount} {cardCount === 1 ? 'card' : 'cards'}
                </span>
            )}
        </div>
    )
}
