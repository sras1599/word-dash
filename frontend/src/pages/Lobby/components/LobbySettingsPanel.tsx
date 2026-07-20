import { Icon } from '../../../components/Icon/Icon'
import { Button, Panel } from '../../../components/ui'
import type { Variation } from '../../../lib/gameTypes'
import type { VariationTab } from '../../../lib/variation'
import { TurnTimerControl } from './TurnTimerControl'
import { VariationPicker } from './VariationPicker'

type LobbySettingsPanelProps = {
    isHost: boolean
    canStart: boolean
    variation: Variation
    activeVariationTab: VariationTab
    currentVariationLabel: string
    customInput: string
    customVariationError: string
    variationOpen: boolean
    turnMinutes: string
    turnSeconds: string
    onVariationTabChange: (tab: VariationTab) => void
    onPresetClick: (wordLengths: number[]) => void
    onCustomInputChange: (value: string) => void
    onCustomApply: () => void
    onTurnMinutesChange: (value: string) => void
    onTurnSecondsChange: (value: string) => void
    onTurnLengthBlur: () => void
    onTimerStep: (deltaSeconds: number) => void
    onStart: () => void
}

export function LobbySettingsPanel({
    isHost,
    canStart,
    variation,
    activeVariationTab,
    currentVariationLabel,
    customInput,
    customVariationError,
    variationOpen,
    turnMinutes,
    turnSeconds,
    onVariationTabChange,
    onPresetClick,
    onCustomInputChange,
    onCustomApply,
    onTurnMinutesChange,
    onTurnSecondsChange,
    onTurnLengthBlur,
    onTimerStep,
    onStart,
}: LobbySettingsPanelProps) {
    return (
        <section className="page-lobby__settings-column" aria-labelledby="page-lobby-settings-title">
            <Panel className="page-lobby__settings-card" elevation="elevated">
                <div className="page-lobby__settings-ornament" aria-hidden="true">
                    <Icon name="tune" className="page-lobby__settings-ornament-icon" />
                </div>

                <div className="page-lobby__section-heading">
                    <span className="page-lobby__section-bar" aria-hidden="true" />
                    <div className="page-lobby__section-copy">
                        <h1 className="page-lobby__section-title" id="page-lobby-settings-title">
                            Game Settings
                        </h1>
                    </div>
                </div>

                <VariationPicker
                    activeTab={activeVariationTab}
                    currentWordLengths={variation.wordLengths}
                    currentVariationLabel={currentVariationLabel}
                    customInput={customInput}
                    customError={customVariationError}
                    isHost={isHost}
                    variationOpen={variationOpen}
                    onTabChange={onVariationTabChange}
                    onPresetClick={onPresetClick}
                    onCustomInputChange={onCustomInputChange}
                    onCustomApply={onCustomApply}
                />

                <TurnTimerControl
                    minutes={turnMinutes}
                    seconds={turnSeconds}
                    isHost={isHost}
                    onMinutesChange={onTurnMinutesChange}
                    onSecondsChange={onTurnSecondsChange}
                    onBlur={onTurnLengthBlur}
                    onStep={onTimerStep}
                />

                {isHost && (
                    <div className="page-lobby__settings-footer">
                        <Button
                            variant="secondary"
                            size="lg"
                            className="page-lobby__start-btn"
                            type="button"
                            onClick={onStart}
                            disabled={!canStart}
                        >
                            Start →
                        </Button>
                        <p className="page-lobby__start-note">
                            {canStart ? 'Everyone is ready.' : 'Need at least 2 ready players to start.'}
                        </p>
                    </div>
                )}
            </Panel>
        </section>
    )
}
