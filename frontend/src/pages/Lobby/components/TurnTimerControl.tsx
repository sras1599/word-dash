import { Icon } from '../../../components/Icon/Icon'
import { IconButton } from '../../../components/ui'

type TurnTimerControlProps = {
    minutes: string
    seconds: string
    isHost: boolean
    onMinutesChange: (value: string) => void
    onSecondsChange: (value: string) => void
    onBlur: () => void
    onStep: (deltaSeconds: number) => void
}

export function TurnTimerControl({
    minutes,
    seconds,
    isHost,
    onMinutesChange,
    onSecondsChange,
    onBlur,
    onStep,
}: TurnTimerControlProps) {
    return (
        <section className="page-lobby__timer-card" aria-labelledby="page-lobby-timer-title">
            <div className="page-lobby__timer-copy">
                <span className="page-lobby__timer-icon-wrap" aria-hidden="true">
                    <Icon name="timer" className="page-lobby__timer-icon" />
                </span>

                <div>
                    <h2 className="page-lobby__timer-title" id="page-lobby-timer-title">
                        Turn Timer
                    </h2>
                    <p className="page-lobby__timer-subtitle">Time per word dash</p>
                </div>
            </div>

            <div className="page-lobby__timer-controls">
                <IconButton
                    className="page-lobby__timer-step"
                    onClick={() => onStep(-15)}
                    disabled={!isHost}
                    label="Decrease turn time"
                    icon={<Icon name="minus" className="page-lobby__timer-step-icon" />}
                />

                <div className="page-lobby__timer-display">
                    <label className="wd-sr-only" htmlFor="turn-minutes">
                        Turn length minutes
                    </label>
                    <input
                        id="turn-minutes"
                        className="page-lobby__timer-input page-lobby__timer-input--minutes"
                        type="number"
                        min={1}
                        max={5}
                        value={minutes}
                        onChange={(e) => onMinutesChange(e.target.value)}
                        onBlur={onBlur}
                        disabled={!isHost}
                    />

                    <span className="page-lobby__timer-separator" aria-hidden="true">
                        :
                    </span>

                    <label className="wd-sr-only" htmlFor="turn-seconds">
                        Turn length seconds
                    </label>
                    <input
                        id="turn-seconds"
                        className="page-lobby__timer-input page-lobby__timer-input--seconds"
                        type="number"
                        min={0}
                        max={59}
                        value={seconds.padStart(2, '0')}
                        onChange={(e) => onSecondsChange(e.target.value)}
                        onBlur={onBlur}
                        disabled={!isHost}
                    />
                </div>

                <IconButton
                    className="page-lobby__timer-step"
                    onClick={() => onStep(15)}
                    disabled={!isHost}
                    label="Increase turn time"
                    icon={<Icon name="plus" className="page-lobby__timer-step-icon" />}
                />
            </div>
        </section>
    )
}
