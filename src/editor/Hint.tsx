import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type ReactElement,
} from 'react';
import { displayKey, isMac, shortcutById } from './shortcuts';

/** How long the pointer rests on a control before its hint appears. */
const HINT_DELAY_MS = 450;

interface HintProps {
  /** What the control does, "Undo Move". */
  readonly label: string;
  /** The id of a shortcut in the table (`shortcuts.ts`): its keys are drawn as key caps. */
  readonly shortcut?: string;
  readonly children: ReactElement<{ 'aria-describedby'?: string }>;
}

/**
 * A hint for a control (UX-2): its name and its shortcut in key caps. It shows after the pointer
 * rests on the control, and at once when the control is reached by keyboard; Escape, leaving and
 * pressing all hide it. It is described to a screen reader as a tooltip of the control. It is drawn
 * with fixed positioning so no panel that scrolls can clip it.
 */
export function Hint({ label, shortcut, children }: HintProps) {
  const id = useId();
  const host = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [at, setAt] = useState<{ readonly x: number; readonly y: number } | undefined>();

  const hide = () => {
    clearTimeout(timer.current);
    setAt(undefined);
  };
  const show = () => {
    // The wrapper has no box of its own: the hint goes under the control inside it.
    const box = host.current?.firstElementChild?.getBoundingClientRect();
    if (box) setAt({ x: box.left + box.width / 2, y: box.bottom + 6 });
  };

  useEffect(() => {
    if (at === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAt(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer.current);
    };
  }, [at]);

  const onFocus = (event: FocusEvent<HTMLSpanElement>) => {
    // Only for keyboard focus: a click focuses the control too, and the hint would be in the way.
    if (event.target.matches(':focus-visible')) show();
  };

  const keys = shortcut ? shortcutById(shortcut).keys : [];
  const mac = isMac();
  return (
    // The span only listens: the events bubble up from the control inside it, which is what is
    // interactive (and what has the keyboard focus).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <span
      ref={host}
      className="hint-host"
      onPointerEnter={() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(show, HINT_DELAY_MS);
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={onFocus}
      onBlur={hide}
    >
      {cloneElement(children, { 'aria-describedby': at ? id : undefined })}
      {at && (
        <span
          id={id}
          role="tooltip"
          className="hint"
          style={{
            left: `clamp(90px, ${String(at.x)}px, calc(100vw - 90px))`,
            top: `${String(at.y)}px`,
          }}
        >
          <span className="hint-label">{label}</span>
          {keys.length > 0 && (
            <span className="hint-keys">
              {keys.map((key) => (
                <kbd key={key} className="keycap">
                  {displayKey(key, mac)}
                </kbd>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
