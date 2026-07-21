import { useEffect, useId, useRef, useState } from 'react'
import {
    closestCenter,
    DragOverlay,
    DndContext,
    KeyboardSensor,
    pointerWithin,
    PointerSensor,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import './GameBoard.css'
import { CardPile, type CardPileProps } from '../CardPile/CardPile'
import { PlayerHand } from '../PlayerHand/PlayerHand'
import { WordBoard, type WordBoardState } from '../WordBoard/WordBoard'
import { Card, type CardData } from '../Card/Card'
import type { TurnPhase } from '../../lib/gameTypes'
import { Icon } from '../Icon/Icon'
import { getGameBoardDropAction } from './dnd'
import { getShortcutAction, shouldIgnoreShortcutTarget, type BoardSelection } from './shortcuts'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import { PlayerStatusStrip, type PlayerStatusStripPlayer } from '../PlayerStatusStrip/PlayerStatusStrip'

export interface GameBoardLocalPlayer {
    id: string
    name: string
    isConnected: boolean
    hand: CardData[]
    wordBoard: WordBoardState
}

export interface GameBoardOpponentPlayer {
    id: string
    name: string
    isConnected: boolean
    handCount: number
    wordBoard: WordBoardState
}

export interface GameBoardTurn {
    currentPlayerId: string
    phase: TurnPhase
}

export interface GameBoardVariation {
    wordLengths: number[]
}

type BoardDragSource = {
    cardId: string
    rowIndex: number
    slotIndex: number
}

const gameBoardCollisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args)
}

export interface GameBoardProps {
    /** Current game phase. */
    phase: 'waiting' | 'playing' | 'finished'
    /** Player IDs in authoritative server turn order. */
    playerOrder?: string[]
    /** The local player's ID, used for status labels. */
    localPlayerId: string
    /** Winning player ID, if the round is finished. */
    winnerId: string | null
    /** The local (human) player. Null while the game state is loading. */
    localPlayer: GameBoardLocalPlayer | null
    /** All opponent players. */
    opponents: GameBoardOpponentPlayer[]
    /** Current turn state. */
    turn: GameBoardTurn
    /** Game variation (word lengths). */
    variation: GameBoardVariation
    /** Top card visible in the discard pile. */
    discardTopCard: CardData | null
    /** Total cards remaining in the draw pile. */
    drawPileCount: number
    /** Local hand count from the server. */
    handCount: number
    /** ID of the drawn card when it is already present in localPlayer.hand. */
    drawnCardId: string | null
    /** ID of the card that should flash before automatic discard. */
    willAutoDiscardCardId: string | null
    /** Called when the local player draws from a pile. */
    onDraw?: (source: 'draw' | 'discard') => void
    /** Called when a card is placed into a word slot. */
    onPlace?: (cardId: string, rowIndex: number, slotIndex: number) => void
    /** Called when a card is removed from a word slot. */
    onUnplace?: (rowIndex: number, slotIndex: number) => void
    /** Called when all cards in a word row should be returned to hand. */
    onClearWord?: (rowIndex: number) => void
    /** Called when all cards on the word board should be returned to hand. */
    onClearBoard?: () => void
    /** Called when a card is discarded. */
    onDiscard?: (cardId: string) => void
}

export function GameBoard({
    phase,
    playerOrder,
    localPlayerId,
    winnerId,
    localPlayer,
    opponents,
    turn,
    variation,
    discardTopCard,
    drawPileCount,
    handCount,
    drawnCardId,
    willAutoDiscardCardId,
    onDraw,
    onPlace,
    onUnplace,
    onClearWord,
    onClearBoard,
    onDiscard,
}: GameBoardProps) {
    const boardDragSourceRef = useRef<BoardDragSource | null>(null)
    const shortcutsTitleId = useId()
    const [activeDragCard, setActiveDragCard] = useState<CardData | null>(null)
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
    const [selectedBoardSlot, setSelectedBoardSlot] = useState<BoardSelection | null>(null)
    const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null)
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor))

    const isActiveTurn = localPlayer !== null && turn.currentPlayerId === localPlayer.id
    const canEditBoard = localPlayer !== null && phase === 'playing' && (turn.phase === 'draw' || turn.phase === 'arrange')
    const canDiscard = isActiveTurn && phase === 'playing' && turn.phase === 'arrange'
    const isDrawPhase = isActiveTurn && turn.phase === 'draw'
    const visibleSelectedBoardSlot = selectedHandCardId ? null : selectedBoardSlot

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.isComposing || shouldIgnoreShortcutTarget(event.target)) return

            if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && event.key === '?') {
                event.preventDefault()
                setIsShortcutsOpen(true)
                return
            }

            if (isShortcutsOpen) {
                if (event.key === 'Escape') {
                    event.preventDefault()
                    setIsShortcutsOpen(false)
                }
                return
            }

            const action = getShortcutAction(
                {
                    key: event.key,
                    shiftKey: event.shiftKey,
                    altKey: event.altKey,
                    ctrlKey: event.ctrlKey,
                    metaKey: event.metaKey,
                },
                {
                    canDraw: isDrawPhase,
                    canDiscard,
                    canEditBoard,
                    canDrawFromDiscard: discardTopCard !== null,
                    drawPileCount,
                    hand: localPlayer?.hand ?? [],
                    isBoardSelected: selectedHandCardId === null,
                    selectedHandCardId,
                    selection: selectedBoardSlot,
                    wordBoard: localPlayer?.wordBoard ?? null,
                },
            )

            if (action.type === 'none') return

            event.preventDefault()

            switch (action.type) {
                case 'select-board':
                    setSelectedBoardSlot(action.selection)
                    setSelectedHandCardId(null)
                    break
                case 'select-hand':
                    setSelectedHandCardId(action.cardId)
                    break
                case 'draw':
                    onDraw?.(action.source)
                    break
                case 'place':
                    onPlace?.(action.cardId, action.rowIndex, action.slotIndex)
                    setSelectedHandCardId(null)
                    if (action.selection) {
                        setSelectedBoardSlot(action.selection)
                    }
                    break
                case 'unplace':
                    onUnplace?.(action.rowIndex, action.slotIndex)
                    setSelectedHandCardId(null)
                    break
                case 'discard':
                    onDiscard?.(action.cardId)
                    if (action.source === 'hand') {
                        setSelectedHandCardId(null)
                    } else {
                        setSelectedBoardSlot(null)
                    }
                    break
                case 'clear-word':
                    onClearWord?.(action.rowIndex)
                    break
                case 'clear-board':
                    onClearBoard?.()
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [
        canEditBoard,
        canDiscard,
        discardTopCard,
        drawPileCount,
        isDrawPhase,
        isShortcutsOpen,
        localPlayer,
        onClearBoard,
        onClearWord,
        onDraw,
        onDiscard,
        onPlace,
        onUnplace,
        selectedBoardSlot,
        selectedHandCardId,
    ])

    const handleBoardCardDragStart = (cardId: string, rowIndex: number, slotIndex: number) => {
        boardDragSourceRef.current = { cardId, rowIndex, slotIndex }
    }

    const handleBoardCardDragEnd = () => {
        boardDragSourceRef.current = null
    }

    const handleSlotSelected = (rowIndex: number, slotIndex: number) => {
        if (!canEditBoard) return
        setSelectedBoardSlot({ rowIndex, slotIndex })
        setSelectedHandCardId(null)
    }

    const handleBoardCardSelected = (_card: CardData, rowIndex: number, slotIndex: number) => {
        handleSlotSelected(rowIndex, slotIndex)
    }

    const handleHandCardSelected = (cardId: string) => {
        if (!canEditBoard) return
        setSelectedHandCardId(cardId)
    }

    const handleDiscard = (cardId: string) => {
        onDiscard?.(cardId)

        if (selectedHandCardId === cardId) {
            setSelectedHandCardId(null)
        }

        const selectedBoardCard = selectedBoardSlot
            ? localPlayer?.wordBoard.rows[selectedBoardSlot.rowIndex]?.slots[selectedBoardSlot.slotIndex]?.card
            : null

        if (selectedBoardCard?.id === cardId) {
            setSelectedBoardSlot(null)
        }
    }

    const enableDropOnHand = () => undefined

    const findLocalCard = (cardId: string): CardData | null => {
        if (!localPlayer) return null

        const handCard = localPlayer.hand.find((card) => card.id === cardId)
        if (handCard) return handCard

        for (const row of localPlayer.wordBoard.rows) {
            for (const slot of row.slots) {
                if (slot.card?.id === cardId) {
                    return slot.card
                }
            }
        }

        return null
    }

    const handleDndDragStart = (event: DragStartEvent) => {
        const data = event.active.data.current
        const cardId = String(data?.cardId ?? event.active.id)
        setActiveDragCard(findLocalCard(cardId))

        if (data?.source !== 'board') {
            return
        }

        boardDragSourceRef.current = {
            cardId: String(data.cardId),
            rowIndex: Number(data.rowIndex),
            slotIndex: Number(data.slotIndex),
        }
    }

    const handleDndDragEnd = (event: DragEndEvent) => {
        const source = boardDragSourceRef.current
        boardDragSourceRef.current = null
        setActiveDragCard(null)

        const cardId = String(event.active.data.current?.cardId ?? event.active.id)
        const action = getGameBoardDropAction(cardId, event.over ? String(event.over.id) : null, source, { canDiscard })
        if (!action) return

        switch (action.type) {
            case 'place':
                onPlace?.(action.cardId, action.rowIndex, action.slotIndex)
                break
            case 'unplace':
                onUnplace?.(action.rowIndex, action.slotIndex)
                break
            case 'discard':
                onDiscard?.(action.cardId)
                break
        }
    }

    const handleDndDragCancel = () => {
        boardDragSourceRef.current = null
        setActiveDragCard(null)
    }

    const selectedBoardCard = selectedBoardSlot
        ? localPlayer?.wordBoard.rows[selectedBoardSlot.rowIndex]?.slots[selectedBoardSlot.slotIndex]?.card
        : null
    const selectedDiscardCardId = selectedHandCardId ?? selectedBoardCard?.id ?? null

    const drawPileProps: CardPileProps = {
        type: 'draw',
        topCard: null,
        cardCount: drawPileCount,
        isActive: isDrawPhase,
        onDraw,
    }

    const discardPileProps: CardPileProps = {
        type: 'discard',
        topCard: discardTopCard,
        cardCount: discardTopCard ? 1 : 0,
        isActive: isDrawPhase,
        isDropTarget: canDiscard,
        onDraw,
        onDiscard: handleDiscard,
        onDiscardSelected: canDiscard && selectedDiscardCardId
            ? () => handleDiscard(selectedDiscardCardId)
            : undefined,
    }

    const unorderedStatusPlayers: PlayerStatusStripPlayer[] = [
        ...(localPlayer
            ? [
                {
                    id: localPlayer.id,
                    name: localPlayer.name,
                    isLocal: localPlayer.id === localPlayerId,
                    isConnected: localPlayer.isConnected,
                    cardCount: handCount,
                    validWordCount: localPlayer.wordBoard.rows.filter((row) => row.isComplete).length,
                    totalWordCount: localPlayer.wordBoard.rows.length,
                },
            ]
            : []),
        ...opponents.map((opponent) => ({
            id: opponent.id,
            name: opponent.name,
            isLocal: opponent.id === localPlayerId,
            isConnected: opponent.isConnected,
            cardCount: opponent.handCount,
            validWordCount: opponent.wordBoard.rows.filter((row) => row.isComplete).length,
            totalWordCount: opponent.wordBoard.rows.length,
        })),
    ]
    const statusPlayersById = new Map(unorderedStatusPlayers.map((player) => [player.id, player]))
    const statusPlayers: PlayerStatusStripPlayer[] = playerOrder
        ? [
            ...playerOrder.flatMap((playerId) => {
                const player = statusPlayersById.get(playerId)
                return player ? [player] : []
            }),
            ...unorderedStatusPlayers.filter((player) => !playerOrder.includes(player.id)),
        ]
        : unorderedStatusPlayers

    function hasPlacedBoardCards(wordBoard: WordBoardState): boolean {
        return wordBoard.rows.some((row) => row.slots.some((slot) => slot.card !== null))
    }

    const totalBoardSlots = variation.wordLengths.reduce((sum, length) => sum + length, 0)
    const canClearBoard = canEditBoard && localPlayer !== null && hasPlacedBoardCards(localPlayer.wordBoard)

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={gameBoardCollisionDetection}
            onDragStart={handleDndDragStart}
            onDragEnd={handleDndDragEnd}
            onDragCancel={handleDndDragCancel}
        >
            <div
                className="game-board"
                aria-label={`Game board, ${totalBoardSlots} word slots`}
                data-game-phase={phase}
                data-turn-phase={turn.phase}
                data-turn-owner={isActiveTurn ? 'local' : 'opponent'}
            >
                <div
                    className="game-board__players"
                    tabIndex={0}
                    aria-label="Scrollable player statuses"
                >
                    <PlayerStatusStrip
                        players={statusPlayers}
                        phase={phase}
                        currentPlayerId={turn.currentPlayerId}
                        turnPhase={turn.phase}
                        winnerId={winnerId}
                    />
                </div>

                {localPlayer && (
                    <section
                        className="game-board__board-section"
                        aria-labelledby="game-board-title"
                    >
                        <div className="game-board__board-header">
                            <div className="game-board__board-copy">
                                <h1 className="game-board__board-title" id="game-board-title">
                                    Build Your Words
                                </h1>
                            </div>

                            <div className="game-board__board-actions">
                                {canClearBoard && onClearBoard && (
                                    <button
                                        className="game-board__clear-board-btn"
                                        type="button"
                                        onClick={onClearBoard}
                                        aria-label="Clear word board"
                                        title="Clear board"
                                    >
                                        <Icon name="clear" className="game-board__clear-icon" />
                                        <span>Clear Board</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <WordBoard
                            wordBoard={localPlayer.wordBoard}
                            drawnCardId={drawnCardId}
                            willAutoDiscardCardId={willAutoDiscardCardId}
                            selectedSlot={visibleSelectedBoardSlot}
                            onPlace={canEditBoard ? onPlace : undefined}
                            onClearWord={canEditBoard ? onClearWord : undefined}
                            onSlotSelected={canEditBoard ? handleSlotSelected : undefined}
                            onCardDragStart={canEditBoard ? handleBoardCardDragStart : undefined}
                            onCardDragEnd={canEditBoard ? handleBoardCardDragEnd : undefined}
                            onCardSelected={canEditBoard ? handleBoardCardSelected : undefined}
                        />
                    </section>
                )}

                <section
                    className="game-board__piles"
                    aria-label="Card piles"
                >
                    <div className="game-board__pile">
                        <p className="game-board__pile-label">Draw pile</p>
                        <CardPile {...drawPileProps} />
                    </div>

                    <div className="game-board__pile">
                        <p className="game-board__pile-label">Discard pile</p>
                        <CardPile {...discardPileProps} />
                    </div>
                </section>

                {localPlayer && (
                    <footer className="game-board__hand-footer">
                        <div className="game-board__hand-shell">
                            <div className="game-board__hand-content">
                                <div className="game-board__hand-header">
                                    <div className="game-board__hand-heading">
                                        <h2 className="game-board__hand-title">Your Hand</h2>
                                    </div>
                                </div>

                                <PlayerHand
                                    hand={localPlayer.hand}
                                    drawnCardId={drawnCardId}
                                    willAutoDiscardCardId={willAutoDiscardCardId}
                                    isDraggable={canEditBoard}
                                    selectedCardId={selectedHandCardId}
                                    onCardClick={handleHandCardSelected}
                                    onDropOnHand={canEditBoard && onUnplace ? enableDropOnHand : undefined}
                                />
                            </div>
                        </div>
                    </footer>
                )}

                <button
                    className="game-board__shortcuts-btn"
                    type="button"
                    onClick={() => setIsShortcutsOpen(true)}
                    aria-label="Open keyboard shortcuts"
                    title="Keyboard shortcuts"
                >
                    <Icon name="keyboard" className="game-board__shortcuts-btn-icon" />
                </button>
            </div>
            <DragOverlay>
                {activeDragCard ? (
                    <div className="game-board__drag-overlay">
                        <Card
                            card={{ ...activeDragCard, id: `${activeDragCard.id}:overlay` }}
                            isDrawn={activeDragCard.id === drawnCardId}
                            willAutoDiscard={activeDragCard.id === willAutoDiscardCardId}
                            readOnly
                        />
                    </div>
                ) : null}
            </DragOverlay>
            {isShortcutsOpen && (
                <KeyboardShortcutsModal titleId={shortcutsTitleId} onClose={() => setIsShortcutsOpen(false)} />
            )}
        </DndContext>
    )
}
