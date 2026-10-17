import { useState } from 'react';
import './animation.css';

/**
 * A slider in tenths of a second (AN-4, TN-2). It saves one step when you let go, not one for every
 * tenth. `ends` puts the smallest and the largest value under it (the Transition board does).
 */
export function TimingSlider({
  label,
  value,
  min,
  max,
  ends,
  onCommit,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly ends?: boolean;
  readonly onCommit: (value: number) => void;
}) {
  const [dragging, setDragging] = useState<number | undefined>();
  const shown = dragging ?? value;
  const done = () => {
    if (dragging === undefined) return;
    setDragging(undefined);
    if (dragging !== value) onCommit(dragging);
  };
  return (
    <div className="timing-row">
      <label className="timing-label">
        <span>{label}</span>
        <span className="timing-value">{`${shown.toFixed(1)} s`}</span>
        <input
          type="range"
          className="slider"
          aria-label={label}
          min={min}
          max={max}
          step={0.1}
          value={shown}
          onChange={(event) => {
            setDragging(Number(event.target.value));
          }}
          onPointerUp={done}
          onKeyUp={done}
          onBlur={done}
        />
      </label>
      {ends && (
        <div className="timing-ends" aria-hidden="true">
          <span>{`${min.toFixed(1)} s`}</span>
          <span>{`${String(max)} s`}</span>
        </div>
      )}
    </div>
  );
}
