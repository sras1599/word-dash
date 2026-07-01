import React from 'react'
import { useDraggable, type Data } from '@dnd-kit/core'
import './Card.css'

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
    /** Flashes a drawn card that will be auto-discarded when the timer expires. */
    willAutoDiscard?: boolean
    /** Disables all interactions (e.g. results screen). Default: false. */
    readOnly?: boolean
    /** Called when the card is clicked (ignored when readOnly). */
    onClick?: () => void
    /** Called when a drag starts, receives the card id. */
    onDragStart?: (cardId: string) => void
    /** Called when a drag ends (success or failure). */
    onDragEnd?: () => void
    /** Metadata consumed by dnd-kit drop handlers. */
    dragData?: Data
}

export function Card({
    card,
    faceDown = false,
    draggable: isDraggable = false,
    selected = false,
    isDrawn = false,
    willAutoDiscard = false,
    readOnly = false,
    onClick,
    onDragStart,
    onDragEnd,
    dragData,
}: CardProps) {
    const isInteractive = !readOnly && !!onClick
    const canDrag = isDraggable && !readOnly && !!card
    const wasDraggingRef = React.useRef(false)
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: card?.id ?? 'empty-card',
        data: dragData,
        disabled: !canDrag,
    })

    React.useEffect(() => {
        if (!card) return

        if (isDragging && !wasDraggingRef.current) {
            onDragStart?.(card.id)
        }

        if (!isDragging && wasDraggingRef.current) {
            onDragEnd?.()
        }

        wasDraggingRef.current = isDragging
    }, [card, isDragging, onDragEnd, onDragStart])

    const handleClick = () => {
        if (isInteractive) onClick?.()
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
        willAutoDiscard && 'card--will-auto-discard',
        readOnly && 'card--readonly',
        canDrag && 'card--draggable',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div
            ref={setNodeRef}
            className={className}
            style={{
                transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
                opacity: isDragging ? 0.72 : undefined,
            }}
            onClick={isInteractive ? handleClick : undefined}
            onKeyDown={handleKeyDown}
            {...attributes}
            {...listeners}
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
                    <span className="card__back-letter card__back-letter--w">W</span>
                    <span className="card__back-letter card__back-letter--d">D</span>
                    <span className="card__back-letter card__back-letter--a">A</span>
                    <span className="card__back-letter card__back-letter--s">S</span>
                    <span className="card__back-letter card__back-letter--h">H</span>
                    <span className="card__back-letter card__back-letter--k">K</span>
                    <span className="card__back-letter card__back-letter--z">Z</span>
                    <span className="card__back-letter card__back-letter--x">X</span>
                    <span className="card__back-letter card__back-letter--d2">D</span>
                    <span className="card__back-letter card__back-letter--w2">W</span>
                    <span className="card__back-letter card__back-letter--s2">S</span>
                    <span className="card__back-letter card__back-letter--a2">A</span>
                    <span className="card__back-letter card__back-letter--x2">X</span>
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
