import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell, type FloatingLetter } from '../../components/PageShell/PageShell'
import { session } from '../../lib/session'
import { customVariationSchema, turnDurationSchema } from '../../lib/schemas'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import {
    getPresetDisplayLabel,
    getVariationDifficulty,
    parseCustomVariation,
    sanitizeCustomVariationInput,
    toVariation,
    type VariationTab,
} from '../../lib/variation'
import {
    sanitizeNumericInput,
    stepTurnDurationMs,
    type TurnDurationFields,
    turnDurationFieldsToMs,
    turnDurationMsToFields,
} from '../../lib/turnTimer'
import { LobbySettingsPanel } from './components/LobbySettingsPanel'
import { LobbyStateScreen } from './components/LobbyStateScreen'
import { LobbyTopBar } from './components/LobbyTopBar'
import { PlayerSlots } from './components/PlayerSlots'
import { useLobbyRoom } from './hooks/useLobbyRoom'
import './Lobby.css'

const MAX_PLAYERS = 4
const COPY_STATUS_RESET_MS = 1800

const FLOATING_LETTERS: FloatingLetter[] = [
    { key: 'w', letter: 'W', className: 'page-lobby__floating-letter--w' },
    { key: 'd', letter: 'D', className: 'page-lobby__floating-letter--d' },
    { key: 'a', letter: 'A', className: 'page-lobby__floating-letter--a' },
    { key: 's', letter: 'S', className: 'page-lobby__floating-letter--s' },
    { key: 'h', letter: 'H', className: 'page-lobby__floating-letter--h' },
]

export function Lobby() {
    const { roomCode } = useParams<{ roomCode: string }>()
    const navigate = useNavigate()
    const localPlayerId = session.getPlayerId() ?? ''
    const { lobby, pageStatus, startGame, updateSettings } = useLobbyRoom(roomCode, localPlayerId)
    useDocumentTitle('Lobby')

    const [customInput, setCustomInput] = useState('')
    const [customVariationError, setCustomVariationError] = useState('')
    const [activeVariationTabOverride, setActiveVariationTabOverride] = useState<VariationTab | null>(null)
    const [turnDurationDraft, setTurnDurationDraft] = useState<TurnDurationFields | null>(null)
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
    const copyStatusTimerRef = useRef<number | null>(null)

    const isHost = lobby !== null && lobby.hostPlayerId === localPlayerId
    const canStart = lobby !== null && lobby.players.length >= 2
    const activeVariationTab =
        activeVariationTabOverride ?? getVariationDifficulty(lobby?.variation.wordLengths ?? [3, 4, 5])
    const turnDurationFields = turnDurationDraft ?? turnDurationMsToFields(lobby?.turnDurationMs ?? 90_000)

    useEffect(() => {
        return () => {
            if (copyStatusTimerRef.current !== null) {
                window.clearTimeout(copyStatusTimerRef.current)
            }
        }
    }, [])

    function scheduleCopyStatusReset() {
        if (copyStatusTimerRef.current !== null) {
            window.clearTimeout(copyStatusTimerRef.current)
        }
        copyStatusTimerRef.current = window.setTimeout(() => {
            setCopyStatus('idle')
            copyStatusTimerRef.current = null
        }, COPY_STATUS_RESET_MS)
    }

    function handlePresetClick(wordLengths: number[]) {
        if (!lobby) return

        const variation = toVariation(wordLengths)
        const turnDurationResult = turnDurationSchema.safeParse(turnDurationFields)
        updateSettings({
            variation,
            turnDurationMs: (turnDurationResult.success
                ? turnDurationResult.data
                : turnDurationFieldsToMs(turnDurationFields.minutes, turnDurationFields.seconds) / 1_000) * 1_000,
        })
        setActiveVariationTabOverride(null)
        setCustomInput('')
        setCustomVariationError('')
    }

    function handleCustomInputChange(value: string) {
        setCustomInput(sanitizeCustomVariationInput(value))
        setCustomVariationError('')
    }

    function handleCustomApply() {
        if (!lobby) return

        const customResult = customVariationSchema.safeParse({ customInput })
        if (!customResult.success) {
            setCustomVariationError(customResult.error.issues[0]?.message ?? 'Enter at least 2 comma-separated numbers, e.g. 4,7')
            return
        }

        const wordLengths = parseCustomVariation(customResult.data.customInput)
        if (!wordLengths) return

        const variation = toVariation(wordLengths)
        const turnDurationResult = turnDurationSchema.safeParse(turnDurationFields)
        updateSettings({
            variation,
            turnDurationMs: (turnDurationResult.success
                ? turnDurationResult.data
                : turnDurationFieldsToMs(turnDurationFields.minutes, turnDurationFields.seconds) / 1_000) * 1_000,
        })
        setActiveVariationTabOverride(null)
        setCustomInput('')
        setCustomVariationError('')
    }

    function handleTurnLengthBlur() {
        if (!lobby) return

        const turnDurationResult = turnDurationSchema.safeParse(turnDurationFields)
        const turnDurationMs = (turnDurationResult.success
            ? turnDurationResult.data
            : turnDurationFieldsToMs(turnDurationFields.minutes, turnDurationFields.seconds) / 1_000) * 1_000

        setTurnDurationDraft(null)
        updateSettings({
            variation: lobby.variation,
            turnDurationMs,
        })
    }

    function handleVariationTabChange(nextTab: VariationTab) {
        if (!isHost) return

        setActiveVariationTabOverride(nextTab)
        setCustomVariationError('')
    }

    function handleTimerStep(deltaSeconds: number) {
        if (!lobby || !isHost) return

        const nextTurnDurationMs = stepTurnDurationMs(lobby.turnDurationMs, deltaSeconds)

        setTurnDurationDraft(null)
        updateSettings({
            variation: lobby.variation,
            turnDurationMs: nextTurnDurationMs,
        })
    }

    async function handleCopyRoomCode() {
        if (!roomCode || !navigator.clipboard) {
            setCopyStatus('failed')
            scheduleCopyStatusReset()
            return
        }

        try {
            await navigator.clipboard.writeText(roomCode)
            setCopyStatus('copied')
        } catch {
            setCopyStatus('failed')
        }
        scheduleCopyStatusReset()
    }

    function goHome() {
        navigate('/')
    }

    if (pageStatus !== 'ready' || !lobby) {
        return (
            <PageShell
                pageClassName="page-lobby"
                modifierClassName="page-lobby--loading"
                floatingBgClassName="page-lobby__floating-bg"
                floatingLetterClassName="page-lobby__floating-letter"
                floatingLetters={FLOATING_LETTERS}
            >
                <LobbyStateScreen pageStatus={pageStatus} onHome={goHome} />
            </PageShell>
        )
    }

    return (
        <PageShell
            pageClassName="page-lobby"
            floatingBgClassName="page-lobby__floating-bg"
            floatingLetterClassName="page-lobby__floating-letter"
            floatingLetters={FLOATING_LETTERS}
        >
            <LobbyTopBar roomCode={lobby.roomCode} onCopyRoomCode={handleCopyRoomCode} copyStatus={copyStatus} />

            <main className="wd-content-layer page-lobby__main">
                <div className="page-lobby__grid">
                    <LobbySettingsPanel
                        isHost={isHost}
                        canStart={canStart}
                        variation={lobby.variation}
                        activeVariationTab={activeVariationTab}
                        currentVariationLabel={getPresetDisplayLabel(lobby.variation.wordLengths)}
                        customInput={customInput}
                        customVariationError={customVariationError}
                        variationOpen={activeVariationTab === 'Custom'}
                        turnMinutes={turnDurationFields.minutes}
                        turnSeconds={turnDurationFields.seconds}
                        onVariationTabChange={handleVariationTabChange}
                        onPresetClick={handlePresetClick}
                        onCustomInputChange={handleCustomInputChange}
                        onCustomApply={handleCustomApply}
                        onTurnMinutesChange={(value) =>
                            setTurnDurationDraft({
                                minutes: sanitizeNumericInput(value),
                                seconds: turnDurationFields.seconds,
                            })
                        }
                        onTurnSecondsChange={(value) =>
                            setTurnDurationDraft({
                                minutes: turnDurationFields.minutes,
                                seconds: sanitizeNumericInput(value),
                            })
                        }
                        onTurnLengthBlur={handleTurnLengthBlur}
                        onTimerStep={handleTimerStep}
                        onStart={startGame}
                    />

                    <PlayerSlots
                        players={lobby.players}
                        hostPlayerId={lobby.hostPlayerId}
                        localPlayerId={localPlayerId}
                        maxPlayers={MAX_PLAYERS}
                    />
                </div>
            </main>
        </PageShell>
    )
}
