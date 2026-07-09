import { useEffect, useRef, useState } from 'react'
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
import type { TurnPhase } from '../TurnIndicator/TurnIndicator'
import { WordBoard, type WordBoardState } from '../WordBoard/WordBoard'
import { Card, type CardData } from '../Card/Card'
import { cx } from '../../lib/cx'
import { Icon } from '../Icon/Icon'
import { getGameBoardDropAction } from './dnd'
import { getShortcutAction, shouldIgnoreShortcutTarget, type BoardSelection } from './shortcuts'

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
    timeRemainingMs: number
    totalDurationMs?: number
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
    /** Subtitle shown above the local word board. */
    boardSubtitle: string
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
    localPlayerId,
    winnerId,
    localPlayer,
    opponents,
    turn,
    variation,
    discardTopCard,
    drawPileCount,
    boardSubtitle,
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
    const [activeDragCard, setActiveDragCard] = useState<CardData | null>(null)
    const [selectedBoardSlot, setSelectedBoardSlot] = useState<BoardSelection | null>(null)
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor))

    const isActiveTurn = localPlayer !== null && turn.currentPlayerId === localPlayer.id
    const canEditBoard = localPlayer !== null && phase === 'playing' && (turn.phase === 'draw' || turn.phase === 'arrange')
    const canDiscard = isActiveTurn && phase === 'playing' && turn.phase === 'arrange'
    const isDrawPhase = isActiveTurn && turn.phase === 'draw'

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.isComposing || shouldIgnoreShortcutTarget(event.target)) return

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
                    canEditBoard,
                    drawPileCount,
                    hand: localPlayer?.hand ?? [],
                    selection: selectedBoardSlot,
                    wordBoard: localPlayer?.wordBoard ?? null,
                },
            )

            if (action.type === 'none') return

            event.preventDefault()

            switch (action.type) {
                case 'select':
                    setSelectedBoardSlot(action.selection)
                    break
                case 'draw':
                    onDraw?.('draw')
                    break
                case 'place':
                    onPlace?.(action.cardId, action.rowIndex, action.slotIndex)
                    if (action.selection) {
                        setSelectedBoardSlot(action.selection)
                    }
                    break
                case 'unplace':
                    onUnplace?.(action.rowIndex, action.slotIndex)
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
        drawPileCount,
        isDrawPhase,
        localPlayer,
        onClearBoard,
        onClearWord,
        onDraw,
        onPlace,
        onUnplace,
        selectedBoardSlot,
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
    }

    const handleBoardCardSelected = (_card: CardData, rowIndex: number, slotIndex: number) => {
        handleSlotSelected(rowIndex, slotIndex)
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
        onDiscard,
    }

    const displayPlayers = localPlayer
        ? opponents.length > 0
            ? [localPlayer, ...opponents]
            : [localPlayer]
        : opponents

    function getInitials(name: string): string {
        const parts = name.trim().split(/\s+/).filter(Boolean)

        if (parts.length === 0) {
            return '?'
        }

        return parts
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join('')
    }

    function getPlayerStatus(player: GameBoardLocalPlayer | GameBoardOpponentPlayer): string {
        if (!player.isConnected) {
            return 'Disconnected'
        }

        if (phase === 'finished') {
            return player.id === winnerId ? 'Winner' : player.id === localPlayerId ? 'You' : 'Opponent'
        }

        if (phase === 'waiting') {
            return 'Waiting'
        }

        if (player.id === turn.currentPlayerId) {
            return turn.phase === 'draw'
                ? player.id === localPlayerId
                    ? 'Draw a card'
                    : 'Drawing...'
                : 'Playing...'
        }

        return player.id === localPlayerId ? 'You' : 'Opponent'
    }

    function getStatusCount(player: GameBoardLocalPlayer | GameBoardOpponentPlayer): number {
        return player.id === localPlayerId ? handCount : 'handCount' in player ? player.handCount : player.hand.length
    }

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
            <div className="game-board" aria-label={`Game board, ${totalBoardSlots} word slots`}>
                <section className="game-board__status-strip" aria-label="Player status">
                    {displayPlayers.map((player) => {
                        const isLocal = player.id === localPlayerId
                        const isCurrent = player.id === turn.currentPlayerId

                        return (
                            <article
                                key={player.id}
                                className={cx(
                                    'game-board__status-card',
                                    isLocal && 'game-board__status-card--local',
                                    isCurrent && 'game-board__status-card--active',
                                    !player.isConnected && 'game-board__status-card--disconnected',
                                )}
                            >
                                {isLocal && isCurrent && <span className="game-board__status-badge">Your Turn</span>}

                                <div className="game-board__status-main">
                                    <div
                                        className={cx(
                                            'game-board__status-avatar',
                                            isLocal && 'game-board__status-avatar--local',
                                        )}
                                        aria-hidden="true"
                                    >
                                        {getInitials(player.name)}
                                    </div>

                                    <div className="game-board__status-copy">
                                        <p className="game-board__status-name">{isLocal ? 'You' : player.name}</p>
                                        <p
                                            className={cx(
                                                'game-board__status-role',
                                                isCurrent && 'game-board__status-role--active',
                                                !player.isConnected && 'game-board__status-role--disconnected',
                                            )}
                                        >
                                            {getPlayerStatus(player)}
                                        </p>
                                    </div>
                                </div>

                                <div
                                    className={cx(
                                        'game-board__status-count',
                                        isCurrent && 'game-board__status-count--active',
                                    )}
                                >
                                    <span className="game-board__status-count-icon" aria-hidden="true">
                                        <Icon name="cards" />
                                    </span>
                                    <span className="game-board__status-count-value">{getStatusCount(player)}</span>
                                </div>
                            </article>
                        )
                    })}
                </section>

                {localPlayer && (
                    <section className="game-board__board-section" aria-labelledby="game-board-title">
                        <div className="game-board__board-header">
                            <div className="game-board__board-copy">
                                <h1 className="game-board__board-title" id="game-board-title">
                                    Build Your Words
                                </h1>
                                <p className="game-board__board-subtitle">{boardSubtitle}</p>
                            </div>

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

                        <WordBoard
                            wordBoard={localPlayer.wordBoard}
                            willAutoDiscardCardId={willAutoDiscardCardId}
                            selectedSlot={selectedBoardSlot}
                            onPlace={canEditBoard ? onPlace : undefined}
                            onClearWord={canEditBoard ? onClearWord : undefined}
                            onSlotSelected={canEditBoard ? handleSlotSelected : undefined}
                            onCardDragStart={canEditBoard ? handleBoardCardDragStart : undefined}
                            onCardDragEnd={canEditBoard ? handleBoardCardDragEnd : undefined}
                            onCardSelected={canEditBoard ? handleBoardCardSelected : undefined}
                        />
                    </section>
                )}

                <section className="game-board__piles" aria-label="Card piles">
                    <div className="game-board__pile">
                        <p className="game-board__pile-label">Draw</p>
                        <CardPile {...drawPileProps} />
                    </div>

                    <div className="game-board__pile">
                        <p className="game-board__pile-label">Discard</p>
                        <CardPile {...discardPileProps} />
                    </div>
                </section>

                {localPlayer && (
                    <footer className="game-board__hand-footer">
                        <div className="game-board__hand-shell">
                            <div className="game-board__hand-content">
                                <div className="game-board__hand-header">
                                    <div className="game-board__hand-heading">
                                        <h2 className="game-board__hand-title">Your Deck</h2>
                                        <span className="game-board__hand-count">
                                            {handCount} {handCount === 1 ? 'Card' : 'Cards'}
                                        </span>
                                    </div>
                                </div>

                                <PlayerHand
                                    hand={localPlayer.hand}
                                    drawnCardId={drawnCardId}
                                    willAutoDiscardCardId={willAutoDiscardCardId}
                                    isDraggable={canEditBoard}
                                    onDropOnHand={canEditBoard && onUnplace ? enableDropOnHand : undefined}
                                    onDiscard={canDiscard ? onDiscard : undefined}
                                />
                            </div>
                        </div>
                    </footer>
                )}
            </div>
            <DragOverlay>
                {activeDragCard ? (
                    <div className="game-board__drag-overlay">
                        <Card card={{ ...activeDragCard, id: `${activeDragCard.id}:overlay` }} readOnly />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
