import { useRef } from 'react'
import './GameBoard.css'
import { CardPile, type CardPileProps } from '../CardPile/CardPile'
import { PlayerHand } from '../PlayerHand/PlayerHand'
import type { TurnPhase } from '../TurnIndicator/TurnIndicator'
import { WordBoard, type WordBoardState } from '../WordBoard/WordBoard'
import type { CardData } from '../Card/Card'

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
    onDiscard,
}: GameBoardProps) {
    const boardDragSourceRef = useRef<BoardDragSource | null>(null)

    const isActiveTurn = localPlayer !== null && turn.currentPlayerId === localPlayer.id
    const canPlaceInCurrentPhase = isActiveTurn && phase === 'playing' && (turn.phase === 'draw' || turn.phase === 'arrange')
    const isArrangingPhase = isActiveTurn && turn.phase === 'arrange'
    const isDrawPhase = isActiveTurn && turn.phase === 'draw'

    const handleBoardCardDragStart = (cardId: string, rowIndex: number, slotIndex: number) => {
        boardDragSourceRef.current = { cardId, rowIndex, slotIndex }
    }

    const handleBoardCardDragEnd = () => {
        boardDragSourceRef.current = null
    }

    const handleDropOnHand = (cardId: string) => {
        const source = boardDragSourceRef.current
        boardDragSourceRef.current = null
        if (!source || source.cardId !== cardId) {
            return
        }

        onUnplace?.(source.rowIndex, source.slotIndex)
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
        isDropTarget: isArrangingPhase,
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

    const totalBoardSlots = variation.wordLengths.reduce((sum, length) => sum + length, 0)

    return (
        <div className="game-board" aria-label={`Game board, ${totalBoardSlots} word slots`}>
            <section className="game-board__status-strip" aria-label="Player status">
                {displayPlayers.map((player) => {
                    const isLocal = player.id === localPlayerId
                    const isCurrent = player.id === turn.currentPlayerId

                    return (
                        <article
                            key={player.id}
                            className={[
                                'game-board__status-card',
                                isLocal && 'game-board__status-card--local',
                                isCurrent && 'game-board__status-card--active',
                                !player.isConnected && 'game-board__status-card--disconnected',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                        >
                            {isLocal && isCurrent && <span className="game-board__status-badge">Your Turn</span>}

                            <div className="game-board__status-main">
                                <div
                                    className={[
                                        'game-board__status-avatar',
                                        isLocal && 'game-board__status-avatar--local',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                    aria-hidden="true"
                                >
                                    {getInitials(player.name)}
                                </div>

                                <div className="game-board__status-copy">
                                    <p className="game-board__status-name">{isLocal ? 'You' : player.name}</p>
                                    <p
                                        className={[
                                            'game-board__status-role',
                                            isCurrent && 'game-board__status-role--active',
                                            !player.isConnected && 'game-board__status-role--disconnected',
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                    >
                                        {getPlayerStatus(player)}
                                    </p>
                                </div>
                            </div>

                            <div
                                className={[
                                    'game-board__status-count',
                                    isCurrent && 'game-board__status-count--active',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                            >
                                <span className="game-board__status-count-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none">
                                        <path
                                            d="M7 7.5h8.5a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 15.5 18.5H7A1.5 1.5 0 0 1 5.5 17V9A1.5 1.5 0 0 1 7 7.5Z"
                                            stroke="currentColor"
                                            strokeWidth="1.75"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M9 5.5h8a1.5 1.5 0 0 1 1.5 1.5v8"
                                            stroke="currentColor"
                                            strokeWidth="1.75"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </span>
                                <span className="game-board__status-count-value">{getStatusCount(player)}</span>
                            </div>
                        </article>
                    )
                })}
            </section>

            {localPlayer && (
                <section className="game-board__board-section" aria-labelledby="game-board-title">
                    <div className="game-board__board-copy">
                        <h1 className="game-board__board-title" id="game-board-title">
                            Build Your Words
                        </h1>
                        <p className="game-board__board-subtitle">{boardSubtitle}</p>
                    </div>

                    <WordBoard
                        wordBoard={localPlayer.wordBoard}
                        willAutoDiscardCardId={willAutoDiscardCardId}
                        onPlace={canPlaceInCurrentPhase ? onPlace : undefined}
                        onCardDragStart={canPlaceInCurrentPhase ? handleBoardCardDragStart : undefined}
                        onCardDragEnd={canPlaceInCurrentPhase ? handleBoardCardDragEnd : undefined}
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

                                <span className="game-board__hand-sort" aria-hidden="true">
                                    Sort Hand
                                </span>
                            </div>

                            {localPlayer.hand.length > 0 ? (
                                <PlayerHand
                                    hand={localPlayer.hand}
                                    drawnCardId={drawnCardId}
                                    willAutoDiscardCardId={willAutoDiscardCardId}
                                    isDraggable={canPlaceInCurrentPhase}
                                    onDropOnHand={canPlaceInCurrentPhase ? handleDropOnHand : undefined}
                                    onDiscard={isArrangingPhase ? onDiscard : undefined}
                                />
                            ) : (
                                <p className="game-board__hand-empty">No cards in hand.</p>
                            )}
                        </div>
                    </div>
                </footer>
            )}
        </div>
    )
}
