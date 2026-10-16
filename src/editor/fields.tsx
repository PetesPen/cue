import { useState, type KeyboardEvent } from 'react';

/** A value that is the same for everything selected, or `mixed`. */
export const MIXED = 'mixed';
export type Mixed<T> = T | typeof MIXED;

/** The one value everything shares, or `mixed`. */
export function common<T, K>(items: readonly T[], pick: (item: T) => K): Mixed<K> {
  const [first, ...rest] = items;
  if (first === undefined) return MIXED;
  const value = pick(first);
  return rest.every((item) => pick(item) === value) ? value : MIXED;
}

const show = (n: number) => String(Math.round(n * 100) / 100);

interface NumberFieldProps {
  /** Read by assistive technology, for example "Width". */
  readonly label: string;
  /** The short label drawn in the field, for example "W". */
  readonly shortLabel: string;
  readonly value: Mixed<number>;
  readonly onCommit: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  /** How far Up and Down move the value (Shift moves ten times as far). */
  readonly step?: number;
  readonly suffix?: string;
}

/**
 * A number you can type (the design's X, Y, W, H fields). It is saved when you press Enter or leave
 * the field; Escape puts the old value back; Up and Down step by 1, or 10 with Shift.
 */
export function NumberField({
  label,
  shortLabel,
  value,
  onCommit,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix,
}: NumberFieldProps) {
  const [text, setText] = useState<string | undefined>();
  const shown = text ?? (value === MIXED ? '' : show(value));
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  function commit() {
    if (text === undefined) return;
    setText(undefined);
    const parsed = Number(text.trim().replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(parsed)) return;
    const next = clamp(parsed);
    if (value === MIXED || next !== value) onCommit(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // Enter is only for this field: a change can move focus to the text being edited (Safari does it
      // at once), and the key would then type a new line there.
      event.preventDefault();
      commit();
      event.currentTarget.select();
    } else if (event.key === 'Escape') {
      setText(undefined);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const move = (event.shiftKey ? 10 : 1) * step * (event.key === 'ArrowUp' ? 1 : -1);
      const base = text !== undefined ? Number(text) : value === MIXED ? 0 : value;
      setText(undefined);
      // Rounded, so 1.2 + 0.1 is 1.3 and not 1.3000000000000003.
      if (Number.isFinite(base)) onCommit(clamp(Math.round((base + move) * 1000) / 1000));
    }
  }

  return (
    <label className="field-box">
      <span className="field-box-label" aria-hidden="true">
        {shortLabel}
      </span>
      <input
        aria-label={label}
        inputMode="decimal"
        value={shown}
        placeholder={value === MIXED ? 'Mixed' : undefined}
        onFocus={(event) => {
          event.target.select();
        }}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {suffix && (
        <span className="field-box-suffix" aria-hidden="true">
          {suffix}
        </span>
      )}
    </label>
  );
}

interface SegmentedProps<T extends string> {
  readonly label: string;
  readonly value: Mixed<T>;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}

/** A row of toggle buttons where one is on (for example Solid, Dashed, Dotted). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segment"
          aria-pressed={value === option.value}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
