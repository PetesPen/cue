import { useState } from 'react';
import { MIXED, type Mixed } from '@/model';
import { ColourButton } from '../ColourButton';
import { parseHex } from '../palette';

interface ColourFieldProps {
  readonly label: string;
  /** A hex colour, `none`, or mixed. */
  readonly value: Mixed<string>;
  /** The colour is being dragged in the picker: show it, but do not save it. */
  readonly onPreview: (value: string) => void;
  /** The colour is chosen: save it. */
  readonly onChange: (value: string) => void;
  /** Offer "None" (an unfilled shape). */
  readonly allowNone?: boolean;
}

/**
 * A colour in the Design panel: a swatch that opens the picker, and the colour's code to type
 * (design: Main). The same picker serves every colour in the editor (EL-10).
 */
export function ColourField({
  label,
  value,
  onPreview,
  onChange,
  allowNone = false,
}: ColourFieldProps) {
  const [text, setText] = useState<string | undefined>();
  const shown = text ?? (value === MIXED || value === 'none' ? '' : value);

  function commit() {
    if (text === undefined) return;
    setText(undefined);
    const colour = parseHex(text);
    if (colour && colour !== value) onChange(colour);
  }

  return (
    <div className="colour-field" role="group" aria-label={label}>
      <ColourButton
        label={label}
        buttonLabel={`Choose ${label.toLowerCase()}`}
        value={value}
        allowNone={allowNone}
        onPreview={onPreview}
        onCommit={onChange}
        className="colour-swatch-button"
      >
        <span className={value === 'none' ? 'colour-chip colour-chip-none' : 'colour-chip'} />
      </ColourButton>
      <label className="field-box field-box-hex">
        <span className="field-box-label" aria-hidden="true">
          #
        </span>
        <input
          aria-label={`${label} as hex`}
          value={shown.replace('#', '')}
          placeholder={value === MIXED ? 'Mixed' : value === 'none' ? 'None' : '17803F'}
          maxLength={7}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              setText(undefined);
            }
          }}
        />
      </label>
    </div>
  );
}
