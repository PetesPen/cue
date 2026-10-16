import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, PlayIcon } from '../Icons';
import './animation.css';

interface PreviewBarProps {
  /** How many clicks have played. */
  readonly click: number;
  readonly total: number;
  readonly onBack: () => void;
  /** Play the next click, or start again when they have all played. */
  readonly onPlay: () => void;
  readonly onForward: () => void;
  readonly onStop: () => void;
}

/**
 * The bar at the foot of the canvas while Preview runs (design: Editor-Animate): step back, play the
 * next click, step forward, and where you are.
 */
export function PreviewBar({ click, total, onBack, onPlay, onForward, onStop }: PreviewBarProps) {
  const finished = click >= total;
  return (
    <div className="preview-bar" role="toolbar" aria-label="Preview">
      <button
        type="button"
        className="icon-button"
        aria-label="Previous click"
        title="Previous click (Left arrow)"
        disabled={click === 0}
        onClick={onBack}
      >
        <ArrowLeftIcon />
      </button>
      <button type="button" className="button button-primary button-compact" onClick={onPlay}>
        <PlayIcon />
        {finished ? 'Play again' : `Play click ${String(click + 1)}`}
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Next click"
        title="Next click (Right arrow or Space)"
        disabled={finished}
        onClick={onForward}
      >
        <ArrowRightIcon />
      </button>
      <span className="preview-count" aria-live="polite">
        {finished
          ? `${String(total)} of ${String(total)} played`
          : `Click ${String(click + 1)} of ${String(total)}`}
      </span>
      <button
        type="button"
        className="icon-button"
        aria-label="Exit preview"
        title="Exit preview (Esc)"
        onClick={onStop}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
