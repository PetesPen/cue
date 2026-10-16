import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { SLIDE_HEIGHT, SLIDE_WIDTH, boundsOf, type Align, type SlideElement } from '@/model';
import { ColourButton } from '../ColourButton';
import { NumberField } from '../fields';
import { boxOf } from '../gestures';
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, BulletsIcon, NumbersIcon } from '../Icons';
import { FontPicker } from './FontPicker';
import type { TextFormat } from './format';

/** The size of the toolbar, to place it where it never covers what is being edited (slide pixels). */
const TOOLBAR_HEIGHT = 96;
const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 1000;

/** A button press must not move focus out of the text being edited; typing fields still take it. */
export function keepSelection(event: MouseEvent<HTMLElement>): void {
  if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
}

interface ToggleProps {
  readonly label: string;
  readonly shortcut?: string;
  readonly pressed: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}

export function Toggle({ label, shortcut, pressed, onClick, children }: ToggleProps) {
  return (
    <button
      type="button"
      className="tool-button"
      aria-label={label}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface StyleControlsProps {
  readonly format: TextFormat;
  readonly deckFonts: readonly string[];
}

/** Font, size, bold, italic, underline, strikethrough and colour. Shared by the toolbar and the panel. */
export function StyleButtons({ format }: { readonly format: TextFormat }) {
  const { summary, apply } = format;
  return (
    <>
      {summary.canBold && (
        <Toggle
          label="Bold"
          shortcut="Ctrl+B"
          pressed={summary.bold === true}
          onClick={() => {
            apply({ bold: summary.bold !== true });
          }}
        >
          <strong>B</strong>
        </Toggle>
      )}
      {summary.canItalic && (
        <Toggle
          label="Italic"
          shortcut="Ctrl+I"
          pressed={summary.italic === true}
          onClick={() => {
            apply({ italic: summary.italic !== true });
          }}
        >
          <em>I</em>
        </Toggle>
      )}
      <Toggle
        label="Underline"
        shortcut="Ctrl+U"
        pressed={summary.underline === true}
        onClick={() => {
          apply({ underline: summary.underline !== true });
        }}
      >
        <span className="glyph-underline">U</span>
      </Toggle>
      <Toggle
        label="Strikethrough"
        shortcut="Ctrl+Shift+S"
        pressed={summary.strike === true}
        onClick={() => {
          apply({ strike: summary.strike !== true });
        }}
      >
        <span className="glyph-strike">S</span>
      </Toggle>
    </>
  );
}

const ALIGN_OPTIONS: readonly {
  readonly align: Align;
  readonly label: string;
  readonly icon: ReactNode;
}[] = [
  { align: 'left', label: 'Align left', icon: <AlignLeftIcon /> },
  { align: 'center', label: 'Align centre', icon: <AlignCenterIcon /> },
  { align: 'right', label: 'Align right', icon: <AlignRightIcon /> },
];

export function AlignButtons({ format }: { readonly format: TextFormat }) {
  return (
    <>
      {ALIGN_OPTIONS.map(({ align, label, icon }) => (
        <Toggle
          key={align}
          label={label}
          pressed={format.summary.align === align}
          onClick={() => {
            format.apply({ align });
          }}
        >
          {icon}
        </Toggle>
      ))}
    </>
  );
}

export function ListButtons({ format }: { readonly format: TextFormat }) {
  const { list } = format.summary;
  return (
    <>
      <Toggle
        label="Bulleted list"
        pressed={list === 'bulletList'}
        onClick={() => {
          format.setList(list === 'bulletList' ? 'none' : 'bulletList');
        }}
      >
        <BulletsIcon />
      </Toggle>
      <Toggle
        label="Numbered list"
        pressed={list === 'orderedList'}
        onClick={() => {
          format.setList(list === 'orderedList' ? 'none' : 'orderedList');
        }}
      >
        <NumbersIcon />
      </Toggle>
    </>
  );
}

export function TextColourButton({ format }: { readonly format: TextFormat }) {
  return (
    <ColourButton
      label="Text colour"
      value={format.summary.color}
      onChange={(color) => {
        format.apply({ color });
      }}
    >
      <span className="glyph-colour">A</span>
    </ColourButton>
  );
}

export function SizeField({ format }: { readonly format: TextFormat }) {
  return (
    <NumberField
      label="Font size"
      shortLabel="Size"
      value={format.summary.fontSize}
      min={MIN_FONT_SIZE}
      max={MAX_FONT_SIZE}
      onCommit={(fontSize) => {
        format.apply({ fontSize: Math.round(fontSize) });
      }}
    />
  );
}

interface FloatingToolbarProps extends StyleControlsProps {
  /** The element being edited: the toolbar sits above it, or below if there is no room. */
  readonly element: SlideElement;
  /** Escape in the toolbar finishes editing too. */
  readonly onFinish: () => void;
}

/**
 * The toolbar that floats by the text being edited (design: Editor-Text). Pressing its buttons does
 * not take focus from the text, so the selection stays where it was. It is in the slide frame, and
 * placed in percentages of the slide, so it follows the zoom.
 */
export function FloatingToolbar({ format, deckFonts, element, onFinish }: FloatingToolbarProps) {
  const bounds = boundsOf(boxOf(element));
  const below = bounds.y < TOOLBAR_HEIGHT;
  const top = below ? bounds.y + bounds.height : bounds.y;
  const left = `${String((bounds.x / SLIDE_WIDTH) * 100)}%`;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onFinish();
    } else if (!event.ctrlKey && !event.metaKey) {
      event.stopPropagation();
    }
  }

  return (
    // The toolbar's own keys are handled here; every control inside is a real button or field.
    <div
      className="text-toolbar"
      role="toolbar"
      aria-label="Text formatting"
      data-below={below}
      style={{
        left: `clamp(0px, ${left}, calc(100% - var(--toolbar-width)))`,
        top: `${String((top / SLIDE_HEIGHT) * 100)}%`,
      }}
      onMouseDown={keepSelection}
      onKeyDown={onKeyDown}
    >
      <FontPicker
        value={format.summary.fontFamily}
        deckFonts={deckFonts}
        onChange={(fontFamily) => {
          format.apply({ fontFamily });
        }}
      />
      <span className="toolbar-size">
        <SizeField format={format} />
      </span>
      <span className="toolbar-divider" aria-hidden="true" />
      <StyleButtons format={format} />
      <TextColourButton format={format} />
      <span className="toolbar-divider" aria-hidden="true" />
      <AlignButtons format={format} />
      <span className="toolbar-divider" aria-hidden="true" />
      <ListButtons format={format} />
    </div>
  );
}
