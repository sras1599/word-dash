import './GameBoard.css'
import { CardPile, type CardPileProps } from '../CardPile/CardPile'
import { OpponentStatus, type OpponentStatusPlayer } from '../OpponentStatus/OpponentStatus'
import { PlayerHand } from '../PlayerHand/PlayerHand'
import { TurnIndicator, type TurnPhase } from '../TurnIndicator/TurnIndicator'
import { TurnTimer } from '../TurnTimer/TurnTimer'
import { WordBoard, type WordBoardState } from '../WordBoard/WordBoard'
import type { CardData } from '../Card/Card'

export interface GameBoardPlayer {
    id: string
    name: string
    isConnected: boolean
    hand: CardData[]
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

export interface GameBoardProps {
    /** ID of the local (human) player. */
    localPlayerId: string
    /** All players in the game (local + opponents). */
    players: GameBoardPlayer[]
    /** Current turn state. */
    turn: GameBoardTurn
    /** Game variation (word lengths). */
    variation: GameBoardVariation
    /** Top card visible in the discard pile. */
    discardTopCard: CardData | null
    /** Total cards remaining in the draw pile. */
    drawPileCount: number
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
    localPlayerId,
    players,
    turn,
    variation,
    discardTopCard,
    drawPileCount,
    onDraw,
    onPlace,
    onUnplace,
    onDiscard,
}: GameBoardProps) {
    const localPlayer = players.find((p) => p.id === localPlayerId) ?? null
    const opponents = players.filter((p) => p.id !== localPlayerId)

    const isActiveTurn = turn.currentPlayerId === localPlayerId
    const isArrangingPhase = isActiveTurn && turn.phase === 'arrange'
    const isDrawPhase = isActiveTurn && turn.phase === 'draw'

    const currentPlayer = players.find((p) => p.id === turn.currentPlayerId) ?? {
        id: turn.currentPlayerId,
        name: 'Unknown',
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

    const opponentVariation = { wordLengths: variation.wordLengths }

    return (
        <div className="game-board" aria-label="Game board">
            {/* ── Header ── */}
            <header className="game-board__header">
                <div className="game-board__logo" aria-hidden="true">
                    WordIt!
                </div>
                <TurnIndicator
                    currentPlayer={currentPlayer}
                    phase={turn.phase}
                    isLocalPlayer={isActiveTurn}
                />
                <TurnTimer
                    timeRemainingMs={turn.timeRemainingMs}
                    totalDurationMs={turn.totalDurationMs}
                    isActive={turn.phase !== 'idle'}
                />
            </header>

            {/* ── Opponents band ── */}
            {opponents.length > 0 && (
                <section className="game-board__opponents" aria-label="Opponents">
                    {opponents.map((opponent) => {
                        const oppIsActive = turn.currentPlayerId === opponent.id
                        const oppIsArranging = oppIsActive && turn.phase === 'arrange'
                        const oppPlayer: OpponentStatusPlayer = {
                            id: opponent.id,
                            name: opponent.name,
                            isConnected: opponent.isConnected,
                            hand: opponent.hand,
                            wordBoard: {
                                rows: opponent.wordBoard.rows.map((r) => ({
                                    isComplete: r.isComplete,
                                })),
                            },
                        }
                        return (
                            <OpponentStatus
                                key={opponent.id}
                                player={oppPlayer}
                                variation={opponentVariation}
                                isActiveTurn={oppIsActive}
                                isArranging={oppIsArranging}
                            />
                        )
                    })}
                </section>
            )}

            {/* ── Card piles ── */}
            <section className="game-board__piles" aria-label="Card piles">
                <CardPile {...drawPileProps} />
                <CardPile {...discardPileProps} />
            </section>

            {/* ── Local player area ── */}
            {localPlayer && (
                <section className="game-board__local-player" aria-label="Your area">
                    <WordBoard
                        wordBoard={localPlayer.wordBoard}
                        onPlace={isArrangingPhase ? onPlace : undefined}
                        onUnplace={isArrangingPhase ? onUnplace : undefined}
                    />
                    <PlayerHand
                        hand={localPlayer.hand}
                        isDraggable={isArrangingPhase}
                        onDiscard={isArrangingPhase ? onDiscard : undefined}
                    />
                </section>
            )}
        </div>
    )
}
