import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MIXED, type Mixed } from '@/model';
import { ColourPicker } from './colour/ColourPicker';

interface ColourButtonProps {
  /** What the button is called for assistive technology, for example "Text colour". */
  readonly label: string;
  /** What the button itself is called, if not the same as the picker it opens. */
  readonly buttonLabel?: string;
  /** The colour now (hex), `none`, or mixed. */
  readonly value: Mixed<string>;
  readonly allowNone?: boolean;
  readonly onPreview: (colour: string) => void;
  readonly onCommit: (colour: string) => void;
  /** What the button shows: usually an "A" or a swatch. */
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * A button that opens the colour picker beside it. Pressing in the picker does not take focus from the
 * text being edited, except into its own typing field and sliders.
 */
export function ColourButton({
  label,
  buttonLabel,
  value,
  allowNone,
  onPreview,
  onCommit,
  children,
  className = 'tool-button',
}: ColourButtonProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const swatch: CSSProperties & Record<'--swatch', string> = {
    '--swatch': value === MIXED || value === 'none' ? 'transparent' : value,
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
        className={className}
        aria-label={buttonLabel ?? label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={buttonLabel ?? label}
        style={swatch}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        {children}
      </button>
      {open && (
        <div id={panelId} className="colour-popover" role="dialog" aria-label={`${label} picker`}>
          <ColourPicker
            label={label}
            value={value}
            {...(allowNone === undefined ? {} : { allowNone })}
            onPreview={onPreview}
            onCommit={onCommit}
          />
        </div>
      )}
    </div>
  );
}
