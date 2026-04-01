import React from 'react'
import './Card.css'
import worditLogo from '../../assets/wordit-logo.svg'

export interface CardData {
    id: string
    letter: string
}

export interface CardProps {
    /** The card to display. `null` renders an empty placeholder slot. */
    card: CardData | null
    /** If true, shows the card back (no letter visible). Default: false. */
    faceDown?: boolean
    /** Whether HTML5 drag-and-drop is enabled. Default: false. */
    draggable?: boolean
    /** Highlights the card as selected (e.g. chosen for discard). */
    selected?: boolean
    /** Marks the card drawn this turn with a teal border. */
    isDrawn?: boolean
    /** Disables all interactions (e.g. results screen). Default: false. */
    readOnly?: boolean
    /** Called when the card is clicked (ignored when readOnly). */
    onClick?: () => void
    /** Called when a drag starts, receives the card id. */
    onDragStart?: (cardId: string) => void
    /** Called when a drag ends (success or failure). */
    onDragEnd?: () => void
}

export function Card({
    card,
    faceDown = false,
    draggable: isDraggable = false,
    selected = false,
    isDrawn = false,
    readOnly = false,
    onClick,
    onDragStart,
    onDragEnd,
}: CardProps) {
    const isInteractive = !readOnly && !!onClick

    const handleClick = () => {
        if (isInteractive) onClick?.()
    }

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isDraggable || readOnly || !card) return
        e.dataTransfer.setData('text/plain', card.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(card.id)
    }

    const handleDragEnd = () => {
        onDragEnd?.()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!isInteractive) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
        }
    }

    const isVowel = !faceDown && !!card && 'AEIOU'.includes(card.letter.toUpperCase())

    const className = [
        'card',
        faceDown ? 'card--face-down' : 'card--face-up',
        !card && !faceDown && 'card--empty',
        isVowel && 'card--vowel',
        selected && 'card--selected',
        isDrawn && 'card--drawn',
        readOnly && 'card--readonly',
        isDraggable && !readOnly && card && 'card--draggable',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div
            className={className}
            draggable={isDraggable && !readOnly && !!card}
            onClick={isInteractive ? handleClick : undefined}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onKeyDown={handleKeyDown}
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            aria-pressed={isInteractive ? selected : undefined}
            aria-label={
                faceDown
                    ? 'Face-down card'
                    : card
                        ? `Letter ${card.letter}`
                        : 'Empty card slot'
            }
        >
            {faceDown ? (
                <div className="card__back" aria-hidden="true">
                    {/* Wave background: red top, black middle, teal bottom */}
                    <svg
                        className="card__back-waves"
                        viewBox="0 0 80 120"
                        xmlns="http://www.w3.org/2000/svg"
                        preserveAspectRatio="none"
                    >
                        <rect width="80" height="120" fill="#111111" />
                        {/* Red top section with organic wave bottom edge */}
                        <path
                            d="M0,0 H80 V18 C60,18 55,28 40,24 C25,20 20,30 0,24 Z"
                            fill="#E8231A"
                        />
                        {/* Teal bottom section with organic wave top edge */}
                        <path
                            d="M0,96 C20,90 25,100 40,96 C55,92 60,102 80,96 V120 H0 Z"
                            fill="#2DB89C"
                        />
                    </svg>
                    {/* Scrambled letters in the black middle band */}
                    <div className="card__back-pattern" />
                    {/* WordIt! logo – top right */}
                    <img src={worditLogo} alt="" className="card__back-logo" />
                    {/* WordIt! logo – bottom left, rotated 180° */}
                    <img src={worditLogo} alt="" className="card__back-logo card__back-logo--inverted" />
                </div>
            ) : card ? (
                <>
                    <span className="card__letter card__letter--top" aria-hidden="true">
                        {card.letter}
                    </span>
                    <span className="card__letter card__letter--center">
                        {card.letter}
                    </span>
                    <span className="card__letter card__letter--bottom" aria-hidden="true">
                        {card.letter}
                    </span>
                </>
            ) : (
                <div className="card__placeholder" />
            )}
        </div>
    )
}
