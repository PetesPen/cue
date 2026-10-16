import { TRANSITION_KINDS, type Transition, type TransitionKind } from '@/model';
import './animation.css';

export const TRANSITION_LABELS: Readonly<Record<TransitionKind, string>> = {
  none: 'None',
  fade: 'Fade',
  slide: 'Slide',
  push: 'Push',
  zoom: 'Zoom',
};

interface TransitionPanelProps {
  /** The number of the slide the panel is about, from 1. */
  readonly number: number;
  readonly transition: Transition;
  readonly onChange: (change: Partial<Transition>) => void;
}

/**
 * The Transition tab (TN-1; design: Editor-Transition): how the selected slide arrives. The kind is
 * chosen here; the direction, the duration and "Apply to all slides" (TN-2, TN-3) come later. The first
 * slide has nothing before it, so it has nothing to choose.
 */
export function TransitionPanel({ number, transition, onChange }: TransitionPanelProps) {
  const first = number === 1;
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
          <p className="caption transition-note">
            Slides with a transition show a small arrow in the slide list.
          </p>
        </div>
      )}
    </div>
  );
}
