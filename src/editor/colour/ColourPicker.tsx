import { useRef, useState, type PointerEvent } from 'react';
import { MIXED, type Mixed } from '@/model';
import { PALETTE, parseHex } from '../palette';
import { useDeckColours } from './deckColours';
import { hexToHsv, hsvToHex, keepHue, pureHue, type Hsv } from './hsv';
import './colour.css';

/** What a browser with an eyedropper offers (Chromium); other browsers have none and show no button. */
interface EyeDropperApi {
  open: () => Promise<{ sRGBHex: string }>;
}
declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperApi;
  }
}

const START: Hsv = hexToHsv('#7FC8A0');

/** The name of a colour for a screen reader: a design colour by its name, any other by its code. */
export function colourName(value: string): string {
  const swatch = PALETTE.find((s) => s.value === value.toUpperCase());
  return swatch ? swatch.name : value.toUpperCase();
}

interface ColourPickerProps {
  /** What the picker is for, for example "Fill" or "Text colour". */
  readonly label: string;
  /** The colour now (`#RRGGBB`), `none`, or mixed. */
  readonly value: Mixed<string>;
  /** Offer "None" (an unfilled shape). */
  readonly allowNone?: boolean;
  /** The colour is being dragged: show it, but do not save it yet. */
  readonly onPreview: (colour: string) => void;
  /** The colour is chosen: save it. One step, whatever the drag before it was (decision 18). */
  readonly onCommit: (colour: string) => void;
}

/**
 * The colour picker (EL-10), the same for every colour in the editor: the deck's colours, an area to
 * drag across for shade and brightness, a slider for hue, a field for a code, and an eyedropper where
 * the browser has one. Dragging shows the colour live; letting go saves it.
 */
export function ColourPicker({
  label,
  value,
  allowNone = false,
  onPreview,
  onCommit,
}: ColourPickerProps) {
  const { colours: deckColours, remember } = useDeckColours();
  const [hsv, setHsv] = useState<Hsv>(() => (isColour(value) ? hexToHsv(value) : START));
  const [prevValue, setPrevValue] = useState(value);
  const [typed, setTyped] = useState<string | undefined>();
  const dragging = useRef(false);
  const area = useRef<HTMLDivElement>(null);

  // The colour changed from outside (another selection, an undo): follow it, keeping the hue of a grey.
  if (value !== prevValue) {
    setPrevValue(value);
    if (isColour(value) && hsvToHex(hsv) !== value.toUpperCase()) {
      setHsv(keepHue(hexToHsv(value), hsv));
    }
  }

  const current = hsvToHex(hsv);
  const shown = isColour(value) ? value.toUpperCase() : undefined;

  function choose(next: Hsv, drag: boolean) {
    const hex = hsvToHex(next);
    setHsv(next);
    if (drag) onPreview(hex);
    else save(hex);
  }

  function save(hex: string) {
    remember(hex);
    onCommit(hex);
  }

  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    save(current);
  }

  function fromPointer(event: PointerEvent<HTMLDivElement>): Hsv {
    const rect = area.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return hsv;
    return {
      h: hsv.h,
      s: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      v: 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function applyColour(hex: string) {
    setHsv(keepHue(hexToHsv(hex), hsv));
    save(hex);
  }

  function commitTyped() {
    if (typed === undefined) return;
    const hex = parseHex(typed);
    setTyped(undefined);
    if (hex && hex !== shown) applyColour(hex);
  }

  async function pickFromScreen() {
    if (!window.EyeDropper) return;
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      const hex = parseHex(sRGBHex);
      if (hex) applyColour(hex);
    } catch {
      // Escape closes the eyedropper without a colour; that is not an error.
    }
  }

  const recent = [...new Set(deckColours)].filter((c) => !PALETTE.some((s) => s.value === c));
  const swatch = (hex: string, name: string) => (
    <button
      key={hex}
      type="button"
      className="swatch"
      style={{ background: hex }}
      aria-label={name}
      aria-pressed={shown === hex}
      title={name}
      onClick={() => {
        applyColour(hex);
      }}
    />
  );

  return (
    <div className="colour-picker" role="group" aria-label={label}>
      <div className="swatches">
        {allowNone && (
          <button
            type="button"
            className="swatch swatch-none"
            aria-label="No fill"
            aria-pressed={value === 'none'}
            title="None"
            onClick={() => {
              onCommit('none');
            }}
          />
        )}
        {PALETTE.map((s) => swatch(s.value, s.name))}
      </div>

      {recent.length > 0 && (
        <div>
          <p className="colour-subtitle">In this deck</p>
          <div className="swatches">{recent.slice(0, 10).map((hex) => swatch(hex, hex))}</div>
        </div>
      )}

      {/* The area is for the pointer. The two sliders under it are for the keyboard and for
          assistive technology: one for saturation, one for brightness, both moving the same thumb. */}
      <div
        ref={area}
        className="cp-area"
        style={{ backgroundColor: pureHue(hsv.h) }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = true;
          choose(fromPointer(event), true);
        }}
        onPointerMove={(event) => {
          if (dragging.current) choose(fromPointer(event), true);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span
          className="cp-thumb"
          aria-hidden="true"
          style={{ left: `${String(hsv.s * 100)}%`, top: `${String((1 - hsv.v) * 100)}%` }}
        />
        <input
          type="range"
          className="cp-range"
          aria-label={`${label}: saturation`}
          min={0}
          max={100}
          step={1}
          value={Math.round(hsv.s * 100)}
          aria-valuetext={`${String(Math.round(hsv.s * 100))}%`}
          onChange={(event) => {
            choose({ ...hsv, s: Number(event.target.value) / 100 }, false);
          }}
        />
        <input
          type="range"
          className="cp-range"
          aria-label={`${label}: brightness`}
          min={0}
          max={100}
          step={1}
          value={Math.round(hsv.v * 100)}
          aria-valuetext={`${String(Math.round(hsv.v * 100))}%`}
          onChange={(event) => {
            choose({ ...hsv, v: Number(event.target.value) / 100 }, false);
          }}
        />
      </div>

      <input
        type="range"
        className="cp-hue"
        aria-label={`${label}: hue`}
        min={0}
        max={359}
        step={1}
        value={Math.round(hsv.h) % 360}
        aria-valuetext={`${String(Math.round(hsv.h) % 360)} degrees`}
        onPointerDown={() => {
          dragging.current = true;
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onChange={(event) => {
          choose({ ...hsv, h: Number(event.target.value) }, dragging.current);
        }}
      />

      <div className="cp-row">
        {typeof window !== 'undefined' && 'EyeDropper' in window && (
          <button
            type="button"
            className="tool-button"
            aria-label="Pick a colour from the screen"
            title="Pick a colour from the screen"
            onClick={() => void pickFromScreen()}
          >
            <EyedropperIcon />
          </button>
        )}
        <label className="field-box field-box-hex">
          <span className="field-box-label" aria-hidden="true">
            #
          </span>
          <input
            aria-label={`${label} hex code`}
            value={typed ?? (shown ? shown.replace('#', '') : '')}
            placeholder={value === MIXED ? 'Mixed' : value === 'none' ? 'None' : '17803F'}
            maxLength={7}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            onBlur={commitTyped}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTyped();
              } else if (event.key === 'Escape') {
                setTyped(undefined);
              }
            }}
          />
        </label>
      </div>

      <span className="visually-hidden" role="status">
        {shown ? `${label}: ${colourName(shown)}` : value === 'none' ? `${label}: none` : ''}
      </span>
    </div>
  );
}

function isColour(value: Mixed<string>): value is string {
  return value !== MIXED && value !== 'none';
}

function EyedropperIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m14 7 3 3M4 20l1-4 9-9a2.1 2.1 0 0 1 3 3l-9 9-4 1ZM15 6l3-3 3 3-3 3" />
    </svg>
  );
}
