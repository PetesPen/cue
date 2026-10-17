import { PlayIcon } from '../Icons';
import './animation.css';

interface TransitionBarProps {
  /** The number of the slide that comes in, from 2 (the first slide has no incoming transition). */
  readonly number: number;
  /** Whether the slide has a transition to show (None has nothing to play). */
  readonly canPlay: boolean;
  readonly playing: boolean;
  readonly onPlay: () => void;
}

/**
 * The bar at the foot of the canvas on the Transition tab (TN-4; design: Editor-Transition): which two
 * slides it is about and a button that plays the previous slide into this one, in place.
 */
export function TransitionBar({ number, canPlay, playing, onPlay }: TransitionBarProps) {
  return (
    <div className="preview-bar" role="toolbar" aria-label="Transition preview">
      <span className="transition-between">
        <span>{`Slide ${String(number - 1)}`}</span>
        <span aria-hidden="true">{'→'}</span>
        <strong>{`Slide ${String(number)}`}</strong>
      </span>
      <button
        type="button"
        className="button button-primary button-compact"
        disabled={!canPlay || playing}
        title={canPlay ? undefined : 'Choose an effect to preview'}
        onClick={onPlay}
      >
        <PlayIcon />
        Preview transition
      </button>
    </div>
  );
}
