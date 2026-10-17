import {
  MAX_TRANSITION_DURATION,
  MIN_TRANSITION_DURATION,
  TRANSITION_KINDS,
  type Transition,
  type TransitionKind,
  type TransitionSide,
} from '@/model';
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon } from '../Icons';
import { TimingSlider } from './TimingSlider';
import './animation.css';

export const TRANSITION_LABELS: Readonly<Record<TransitionKind, string>> = {
  none: 'None',
  fade: 'Fade',
  slide: 'Slide',
  push: 'Push',
  zoom: 'Zoom',
};

/** Where the new slide comes in from, and the arrow of the way it moves (board: Editor-Transition). */
const DIRECTIONS: readonly {
  readonly from: TransitionSide;
  readonly label: string;
  readonly icon: React.ReactNode;
}[] = [
  { from: 'left', label: 'From the left', icon: <ArrowRightIcon /> },
  { from: 'right', label: 'From the right', icon: <ArrowLeftIcon /> },
  { from: 'top', label: 'From the top', icon: <ArrowDownIcon /> },
  { from: 'bottom', label: 'From the bottom', icon: <ArrowUpIcon /> },
];

interface TransitionPanelProps {
  /** The number of the slide the panel is about, from 1. */
  readonly number: number;
  readonly transition: Transition;
  readonly onChange: (change: Partial<Transition>) => void;
  /** Give every slide but the first this slide's transition (TN-3). */
  readonly onApplyToAll: () => void;
}

/**
 * The Transition tab (TN-1 to TN-3; design: Editor-Transition): how the selected slide arrives. The effect
 * is chosen from the small pictures; Slide and Push also have a direction; every effect has a duration;
 * "Apply to all slides" copies the settings to every slide but the first, in one undo step. The first
 * slide has nothing before it, so it has nothing to choose.
 */
export function TransitionPanel({
  number,
  transition,
  onChange,
  onApplyToAll,
}: TransitionPanelProps) {
  const first = number === 1;
  const moves = transition.kind === 'slide' || transition.kind === 'push';
  return (
    <div className="transition-panel">
      <div className="panel-section">
        <h2 className="panel-name">{`Slide ${String(number)} transition`}</h2>
        <p className="caption transition-note">Plays when this slide appears.</p>
      </div>

      {first ? (
        <p className="placeholder panel-section">
          This is the first slide: nothing comes before it, so it has no incoming transition.
        </p>
      ) : (
        <>
          <div className="panel-section">
            <h3 className="section-label panel-title">Effect</h3>
            <div className="tn-tiles" role="group" aria-label="Effect">
              {TRANSITION_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="tn-tile"
                  aria-pressed={transition.kind === kind}
                  onClick={() => {
                    if (transition.kind !== kind) onChange({ kind });
                  }}
                >
                  <span className="tn-pic" data-kind={kind} aria-hidden="true">
                    <span className="tn-a" />
                    <span className="tn-b" />
                  </span>
                  <span className="tn-name">{TRANSITION_LABELS[kind]}</span>
                </button>
              ))}
            </div>
          </div>

          {transition.kind !== 'none' && (
            <div className="panel-section">
              {moves && (
                <>
                  <h3 className="section-label panel-title">Direction</h3>
                  <div className="tn-directions" role="group" aria-label="Direction">
                    {DIRECTIONS.map((direction) => (
                      <button
                        key={direction.from}
                        type="button"
                        className="tn-direction"
                        aria-label={direction.label}
                        title={direction.label}
                        aria-pressed={transition.from === direction.from}
                        onClick={() => {
                          if (transition.from !== direction.from)
                            onChange({ from: direction.from });
                        }}
                      >
                        {direction.icon}
                      </button>
                    ))}
                  </div>
                  <p className="caption transition-note">
                    {`New slide comes in from the ${transition.from}.`}
                  </p>
                </>
              )}
              <TimingSlider
                label="Duration"
                value={transition.duration}
                min={MIN_TRANSITION_DURATION}
                max={MAX_TRANSITION_DURATION}
                ends
                onCommit={(duration) => {
                  onChange({ duration });
                }}
              />
            </div>
          )}

          <div className="panel-section tn-actions">
            <button type="button" className="button button-compact" onClick={onApplyToAll}>
              Apply to all slides
            </button>
            <button
              type="button"
              className="button button-compact button-quiet"
              disabled={transition.kind === 'none'}
              onClick={() => {
                onChange({ kind: 'none' });
              }}
            >
              Reset to none
            </button>
            <p className="caption transition-note">
              Slides with a transition show a small arrow in the slide list.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
