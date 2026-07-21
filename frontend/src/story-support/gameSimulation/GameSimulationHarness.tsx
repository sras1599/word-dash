import { useEffect, useState, useSyncExternalStore } from 'react'
import { GameBoard } from '../../components/GameBoard/GameBoard'
import type { TurnPhase } from '../../lib/gameTypes'
import { isTurnTimerUrgent } from '../../lib/turnTimer'
import { GameHud } from '../../pages/Game/components/GameHud'
import { GameTopBar } from '../../pages/Game/components/GameTopBar'
import {
    advanceTurn,
    clearBoard,
    clearWord,
    createScenarioState,
    DEFAULT_TURN_DURATION_MS,
    discardCard,
    drawCard,
    expireTurn,
    fillWord,
    finishGame,
    LOCAL_PLAYER_ID,
    placeCard,
    recordSimulationEvent,
    setActivePlayer,
    setGamePhase,
    setPlayerConnected,
    setTurnPhase,
    unplaceCard,
    type GameSimulationState,
    type SimulationScenario,
} from './simulation'
import { ControlledClock } from './controlledClock'
import './GameSimulationHarness.css'
import '../../pages/Game/Game.css'

export type GameSimulationHarnessProps = {
    scenario?: SimulationScenario
    playerCount?: 2 | 4
    wordLengths?: number[]
    longContent?: boolean
    discardPileEmpty?: boolean
    drawPileCount?: number
    nearlyComplete?: boolean
    overflowingHand?: boolean
    showControls?: boolean
    showEventLog?: boolean
}

export function GameSimulationHarness({
    scenario = 'draw',
    playerCount = 2,
    wordLengths,
    longContent = false,
    discardPileEmpty = false,
    drawPileCount,
    nearlyComplete = false,
    overflowingHand = false,
    showControls = true,
    showEventLog = true,
}: GameSimulationHarnessProps) {
    const fixtureOptions = {
        playerCount,
        wordLengths,
        longContent,
        discardPileEmpty,
        drawPileCount,
        nearlyComplete,
        overflowingHand,
    }
    const [simulation, setSimulation] = useState(() =>
        createScenarioState(scenario, fixtureOptions))
    const [winnerId, setWinnerId] = useState(LOCAL_PLAYER_ID)
    const [eventLogVisible, setEventLogVisible] = useState(showEventLog)
    const [clock] = useState(() => {
        const controlledClock = new ControlledClock(DEFAULT_TURN_DURATION_MS, () => {
            setSimulation((current) => expireTurn(current))
        })
        if (scenario === 'urgent') {
            controlledClock.setRemaining(DEFAULT_TURN_DURATION_MS * 0.15)
        }
        return controlledClock
    })
    const clockSnapshot = useSyncExternalStore(
        clock.subscribe,
        clock.getSnapshot,
        clock.getSnapshot,
    )

    useEffect(() => () => clock.dispose(), [clock])

    function resetSimulation() {
        setSimulation(createScenarioState(scenario, fixtureOptions))
        setWinnerId(LOCAL_PLAYER_ID)
        setEventLogVisible(showEventLog)
        clock.reset()
        if (scenario === 'urgent') {
            clock.setRemaining(DEFAULT_TURN_DURATION_MS * 0.15)
        }
    }

    function update(
        transition: (current: GameSimulationState) => GameSimulationState,
        resetClock = false,
    ) {
        setSimulation(transition)
        if (resetClock) clock.reset()
    }

    function logClockEvent(label: string) {
        update((current) => recordSimulationEvent(current, label))
    }

    function handlePlay() {
        clock.play()
        logClockEvent('timer.play()')
    }

    function handlePause() {
        clock.pause()
        logClockEvent('timer.pause()')
    }

    function handleAdvanceClock() {
        clock.advance(5_000)
        logClockEvent('timer.advance(5000)')
    }

    function handleUrgency() {
        clock.setRemaining(DEFAULT_TURN_DURATION_MS * 0.15)
        logClockEvent('timer.setUrgent()')
    }

    function handleLeaveUrgency() {
        clock.reset()
        logClockEvent('timer.leaveUrgency()')
    }

    function handleExpire() {
        logClockEvent('timer.expire()')
        clock.expire()
    }

    const { gameState } = simulation
    const localPlayer = gameState.players.find(({ id }) => id === LOCAL_PLAYER_ID) ?? null
    const opponents = gameState.players.filter(({ id }) => id !== LOCAL_PLAYER_ID)
    const drawnCardId = gameState.turn.drawnCard?.id ?? null
    const timerUrgent = isTurnTimerUrgent(
        clockSnapshot.remainingMs,
        clockSnapshot.durationMs,
    )
    return (
        <div className="game-simulation page-game" data-testid="game-simulation" data-scenario={scenario}>
            {showControls && (
                <aside className="game-simulation__controls" aria-label="Simulation controls">
                    <div className="game-simulation__control-group">
                        <span className="game-simulation__control-label">Turn</span>
                        <label>
                            <span className="game-simulation__sr-only">Active player</span>
                            <select
                                aria-label="Active player"
                                value={gameState.turn.currentPlayerId}
                                onChange={(event) => {
                                    update(
                                        (current) => setActivePlayer(current, event.target.value),
                                        true,
                                    )
                                }}
                            >
                                {gameState.players.map((player) => (
                                    <option key={player.id} value={player.id}>{player.name}</option>
                                ))}
                            </select>
                        </label>
                        {(['draw', 'arrange'] satisfies TurnPhase[]).map((phase) => (
                            <button
                                key={phase}
                                type="button"
                                aria-pressed={gameState.turn.phase === phase}
                                onClick={() => update((current) => setTurnPhase(current, phase))}
                            >
                                {phase === 'draw' ? 'Draw phase' : 'Arrange phase'}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => update(advanceTurn, true)}
                        >
                            Advance turn
                        </button>
                    </div>

                    <div className="game-simulation__control-group">
                        <span className="game-simulation__control-label">Game</span>
                        <button type="button" onClick={() => update((current) => setGamePhase(current, 'waiting'))}>
                            Waiting
                        </button>
                        <button type="button" onClick={() => update((current) => setGamePhase(current, 'playing'), true)}>
                            Playing
                        </button>
                        <button type="button" onClick={() => update((current) => fillWord(current, false))}>
                            Fill invalid word
                        </button>
                        <button type="button" onClick={() => update((current) => fillWord(current, true))}>
                            Fill valid word
                        </button>
                        {opponents[0] && (
                            <button
                                type="button"
                                onClick={() => update((current) =>
                                    setPlayerConnected(
                                        current,
                                        opponents[0].id,
                                        opponents[0].isConnected === false,
                                    ))}
                            >
                                {opponents[0].isConnected ? 'Disconnect opponent' : 'Reconnect opponent'}
                            </button>
                        )}
                        <label>
                            <span className="game-simulation__sr-only">Winner</span>
                            <select
                                aria-label="Winner"
                                value={winnerId}
                                onChange={(event) => setWinnerId(event.target.value)}
                            >
                                {gameState.players.map((player) => (
                                    <option key={player.id} value={player.id}>{player.name}</option>
                                ))}
                            </select>
                        </label>
                        <button type="button" onClick={() => update((current) => finishGame(current, winnerId))}>
                            Finish game
                        </button>
                    </div>

                    <div className="game-simulation__control-group">
                        <span className="game-simulation__control-label">Clock</span>
                        <button type="button" onClick={handlePlay} disabled={clockSnapshot.isRunning}>Play timer</button>
                        <button type="button" onClick={handlePause} disabled={!clockSnapshot.isRunning}>Pause timer</button>
                        <button type="button" onClick={handleAdvanceClock}>Advance 5s</button>
                        <button type="button" onClick={handleUrgency}>Enter urgency</button>
                        <button type="button" onClick={handleLeaveUrgency}>Leave urgency</button>
                        <button type="button" onClick={handleExpire}>Expire timer</button>
                    </div>

                    <div className="game-simulation__control-group game-simulation__control-group--end">
                        <button type="button" onClick={() => setEventLogVisible((visible) => !visible)}>
                            {eventLogVisible ? 'Hide event log' : 'Show event log'}
                        </button>
                        <button type="button" onClick={resetSimulation}>Reset simulation</button>
                    </div>
                </aside>
            )}

            <GameTopBar onHome={() => undefined} />

            <div className="page-game__hud-layer">
                <div className="page-game__hud-grid">
                    <div className="page-game__hud">
                        <GameHud
                            gameState={gameState}
                            localPlayerId={LOCAL_PLAYER_ID}
                            timeRemainingMs={clockSnapshot.remainingMs}
                            turnDurationMs={clockSnapshot.durationMs}
                            timerIsUrgent={timerUrgent}
                        />
                    </div>
                </div>
            </div>

            <main className="page-game__main game-simulation__board">
                <GameBoard
                    phase={gameState.phase}
                    playerOrder={gameState.players.map((player) => player.id)}
                    localPlayerId={LOCAL_PLAYER_ID}
                    winnerId={gameState.winnerId}
                    localPlayer={localPlayer ? {
                        ...localPlayer,
                        hand: localPlayer.hand ?? [],
                    } : null}
                    opponents={opponents}
                    turn={gameState.turn}
                    variation={gameState.variation}
                    discardTopCard={gameState.discardPileTop}
                    drawPileCount={gameState.drawPileCount}
                    handCount={localPlayer?.handCount ?? 0}
                    drawnCardId={drawnCardId}
                    willAutoDiscardCardId={
                        timerUrgent && gameState.turn.phase === 'arrange'
                            ? drawnCardId
                            : null
                    }
                    onDraw={(source) => update((current) => drawCard(current, source))}
                    onPlace={(cardId, rowIndex, slotIndex) =>
                        update((current) => placeCard(current, cardId, rowIndex, slotIndex))}
                    onUnplace={(rowIndex, slotIndex) =>
                        update((current) => unplaceCard(current, rowIndex, slotIndex))}
                    onClearWord={(rowIndex) =>
                        update((current) => clearWord(current, rowIndex))}
                    onClearBoard={() => update(clearBoard)}
                    onDiscard={(cardId) => update((current) => discardCard(current, cardId), true)}
                />
            </main>

            {eventLogVisible && (
                <aside className="game-simulation__event-log" aria-label="Simulation event log">
                    <h2>Event log</h2>
                    {simulation.eventLog.length === 0 ? (
                        <p>No actions yet.</p>
                    ) : (
                        <ol>
                            {simulation.eventLog.map((event) => (
                                <li key={event.id}>{event.label}</li>
                            ))}
                        </ol>
                    )}
                </aside>
            )}
        </div>
    )
}
