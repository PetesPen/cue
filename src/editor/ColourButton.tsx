import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MIXED, type Mixed } from '@/model';
import { ColourField } from './fields';

interface ColourButtonProps {
  /** What the button is called for assistive technology, for example "Text colour". */
  readonly label: string;
  /** The colour now (hex), or mixed. */
  readonly value: Mixed<string>;
  readonly onChange: (colour: string) => void;
  /** What the button shows: usually an "A" or a swatch. */
  readonly children: ReactNode;
}

/**
 * A button that opens a colour chooser beside it. Clicking in the chooser does not take focus from
 * the text being edited, except into its own typing field.
 */
export function ColourButton({ label, value, onChange, children }: ColourButtonProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const swatch: CSSProperties & Record<'--swatch', string> = {
    '--swatch': value === MIXED ? 'transparent' : value,
  };

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown);
    // In the capture phase, so Escape closes this and does not also end the text editing behind it.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={root} className="colour-button-anchor">
      <button
        ref={button}
        type="button"
        className="tool-button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={label}
        style={swatch}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        {children}
      </button>
      {open && (
        <div id={panelId} className="colour-popover" role="dialog" aria-label={label}>
          <ColourField
            label={label}
            value={value}
            onChange={(colour) => {
              onChange(colour);
            }}
          />
        </div>
      )}
    </div>
  );
}
