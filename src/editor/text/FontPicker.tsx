import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { FONTS, MIXED, type FontInfo, type Mixed } from '@/model';
import { CheckIcon, ChevronDownIcon, SearchIcon } from '../Icons';

interface FontPickerProps {
  /** The font of the selected text, or mixed. */
  readonly value: Mixed<string>;
  /** Fonts the deck already uses, listed first. */
  readonly deckFonts: readonly string[];
  readonly onChange: (family: string) => void;
  /** What the button is called for assistive technology. */
  readonly label?: string;
}

interface Group {
  readonly title: string | undefined;
  readonly fonts: readonly FontInfo[];
}

/** Split the fonts that match what was typed into "in this deck" and the rest. */
export function groupFonts(query: string, deckFonts: readonly string[]): Group[] {
  const needle = query.trim().toLowerCase();
  const matches = FONTS.filter((font) => font.family.toLowerCase().includes(needle));
  if (needle !== '') return matches.length > 0 ? [{ title: undefined, fonts: matches }] : [];
  const inDeck = deckFonts.flatMap((family) => FONTS.filter((font) => font.family === family));
  const rest = matches.filter((font) => !inDeck.includes(font));
  return [
    ...(inDeck.length > 0 ? [{ title: 'Fonts in this deck', fonts: inDeck }] : []),
    { title: inDeck.length > 0 ? 'All fonts' : undefined, fonts: rest },
  ].filter((group) => group.fonts.length > 0);
}

/**
 * The font picker (design: Editor-Text): a button that opens a search field and the bundled fonts,
 * each name in its own typeface with a small label for its kind. Up and Down move, Enter chooses,
 * Escape closes. Fonts the deck uses come first.
 */
export function FontPicker({ value, deckFonts, onChange, label = 'Font' }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  const groups = groupFonts(query, deckFonts);
  const options = groups.flatMap((group) => group.fonts);
  const current = Math.min(active, Math.max(options.length - 1, 0));
  const optionId = (font: FontInfo) => `${listId}-${font.family.replace(/\s+/g, '-')}`;
  const activeFont = options[current];

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  function close(restoreFocus: boolean) {
    setOpen(false);
    setQuery('');
    setActive(0);
    if (restoreFocus) button.current?.focus();
  }

  function choose(font: FontInfo | undefined) {
    if (!font) return;
    close(false);
    onChange(font.family);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current + step + options.length) % Math.max(options.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(activeFont);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  }

  const shown = value === MIXED ? 'Mixed' : value;

  return (
    <div ref={root} className="font-picker">
      <button
        ref={button}
        type="button"
        className="font-button"
        aria-label={`${label}: ${shown}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        <span
          className="font-button-name"
          style={value === MIXED ? undefined : { fontFamily: `"${value}"` }}
        >
          {shown}
        </span>
        <ChevronDownIcon size={14} />
      </button>

      {open && (
        <div className="font-popover">
          <label className="font-search">
            <SearchIcon size={14} />
            <input
              ref={search}
              role="combobox"
              aria-label="Search fonts"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeFont ? optionId(activeFont) : undefined}
              placeholder="Search fonts"
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
          </label>
          <div id={listId} className="font-list" role="listbox" aria-label="Fonts">
            {groups.map((group) => (
              <div key={group.title ?? 'fonts'} role="group" aria-label={group.title ?? 'Fonts'}>
                {group.title && (
                  <div className="font-group" aria-hidden="true">
                    {group.title}
                  </div>
                )}
                {group.fonts.map((font) => (
                  // The search field has focus and drives the list (aria-activedescendant).
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div
                    key={font.family}
                    id={optionId(font)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={value === font.family}
                    className={
                      font === activeFont ? 'font-option font-option-active' : 'font-option'
                    }
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onMouseMove={() => {
                      setActive(options.indexOf(font));
                    }}
                    onClick={() => {
                      choose(font);
                    }}
                  >
                    <span className="font-check" aria-hidden="true">
                      {value === font.family && <CheckIcon size={13} />}
                    </span>
                    <span className="font-option-name" style={{ fontFamily: `"${font.family}"` }}>
                      {font.family}
                    </span>
                    <span className="font-option-kind">{font.kind}</span>
                  </div>
                ))}
              </div>
            ))}
            {options.length === 0 && <p className="font-empty">No font matches “{query}”.</p>}
          </div>
          <p className="font-footer">Bundled fonts travel with exported files.</p>
        </div>
      )}
    </div>
  );
}
