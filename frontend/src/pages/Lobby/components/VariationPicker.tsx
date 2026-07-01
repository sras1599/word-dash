import { Icon } from '../../../components/Icon/Icon'
import { cx } from '../../../lib/cx'
import { areWordLengthsEqual, VARIATION_PRESET_GROUPS, VARIATION_TABS, type VariationTab } from '../../../lib/variation'

type VariationPickerProps = {
    activeTab: VariationTab
    currentWordLengths: number[]
    currentVariationLabel: string
    customInput: string
    customError: string
    isHost: boolean
    variationOpen: boolean
    onTabChange: (tab: VariationTab) => void
    onPresetClick: (wordLengths: number[]) => void
    onCustomInputChange: (value: string) => void
    onCustomApply: () => void
}

export function VariationPicker({
    activeTab,
    currentWordLengths,
    currentVariationLabel,
    customInput,
    customError,
    isHost,
    variationOpen,
    onTabChange,
    onPresetClick,
    onCustomInputChange,
    onCustomApply,
}: VariationPickerProps) {
    const activeVariationGroup = VARIATION_PRESET_GROUPS.find((group) => group.difficulty === activeTab)

    return (
        <section className="page-lobby__variation" aria-labelledby="page-lobby-variation-title">
            <div className="page-lobby__variation-header">
                <p className="page-lobby__eyebrow" id="page-lobby-variation-title">
                    Variation
                </p>
                <p className="page-lobby__variation-caption">Choose a preset or enter a custom dash.</p>
            </div>

            <div className="page-lobby__variation-tabs" role="tablist" aria-label="Variation difficulty">
                {VARIATION_TABS.map((tab) => (
                    <button
                        key={tab}
                        className={cx(
                            'wd-btn',
                            'page-lobby__variation-tab',
                            activeTab === tab && 'page-lobby__variation-tab--active',
                        )}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        onClick={() => onTabChange(tab)}
                        disabled={!isHost}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className={cx('page-lobby__variation-panel', variationOpen && 'page-lobby__variation-panel--open')}>
                <h2 className="page-lobby__panel-title">
                    {activeVariationGroup ? 'Select Word Length Preset' : 'Custom Word Lengths'}
                </h2>

                {activeVariationGroup ? (
                    <div className="page-lobby__preset-list">
                        {activeVariationGroup.presets.map((preset) => {
                            const isSelected = areWordLengthsEqual(preset.wordLengths, currentWordLengths)

                            return (
                                <button
                                    key={preset.label}
                                    className={cx(
                                        'wd-btn',
                                        'page-lobby__preset-button',
                                        isSelected && 'page-lobby__preset-button--selected',
                                    )}
                                    type="button"
                                    onClick={() => onPresetClick(preset.wordLengths)}
                                    disabled={!isHost}
                                >
                                    <span className="page-lobby__preset-button-label">{preset.label}</span>
                                    {isSelected && (
                                        <span className="page-lobby__preset-button-check" aria-hidden="true">
                                            <Icon name="check" className="page-lobby__preset-check-icon" />
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div className="page-lobby__custom-panel">
                        <p className="page-lobby__custom-caption">Add custom word lengths for your dash.</p>

                        <div className="page-lobby__custom-row">
                            <div className="page-lobby__custom-field">
                                <label className="wd-sr-only" htmlFor="variation-custom">
                                    Custom variation
                                </label>
                                <input
                                    id="variation-custom"
                                    className={cx('page-lobby__custom-input', customError && 'page-lobby__custom-input--error')}
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="e.g. 4,7"
                                    maxLength={20}
                                    value={customInput}
                                    onChange={(e) => onCustomInputChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') onCustomApply()
                                    }}
                                    disabled={!isHost}
                                    aria-describedby={customError ? 'custom-variation-error' : undefined}
                                />
                            </div>

                            <button
                                className="wd-btn wd-btn--lift wd-btn--secondary page-lobby__custom-apply-btn"
                                type="button"
                                onClick={onCustomApply}
                                disabled={!isHost}
                            >
                                Apply
                            </button>
                        </div>

                        {customError && (
                            <p id="custom-variation-error" className="page-lobby__custom-error" role="alert">
                                {customError}
                            </p>
                        )}

                        <div className="page-lobby__custom-chips" aria-label="Current variation">
                            <p className="page-lobby__custom-current-label">Current</p>
                            <div className="page-lobby__preset-button page-lobby__preset-button--selected page-lobby__preset-button--current">
                                <span className="page-lobby__preset-button-label">{currentVariationLabel}</span>
                                <span className="page-lobby__preset-button-check" aria-hidden="true">
                                    <Icon name="check" className="page-lobby__preset-check-icon" />
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}
