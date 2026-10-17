/**
 * The keys of a show (PM-6, UX-2): one table, read by the show windows' key handler, by the editor's
 * shortcut sheet and by the tests, so that what the sheet says is what the keys do. Pure data: the show
 * decides what each action does.
 */

export type ShowAction =
  'next' | 'previous' | 'first' | 'last' | 'digit' | 'blackout' | 'whiteout' | 'fullscreen' | 'end';

export interface ShowKey {
  readonly action: ShowAction;
  /** What the sheet calls it. */
  readonly label: string;
  /** The key caps the sheet draws, left to right. */
  readonly caps: readonly string[];
  /** The `KeyboardEvent.key` values that do it. */
  readonly keys: readonly string[];
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const SHOW_KEYS: readonly ShowKey[] = [
  {
    action: 'next',
    label: 'Next click or slide',
    caps: ['→', 'Space'],
    keys: ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'],
  },
  {
    action: 'previous',
    label: 'Previous click or slide',
    caps: ['←'],
    keys: ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'],
  },
  { action: 'first', label: 'First slide', caps: ['Home'], keys: ['Home'] },
  { action: 'last', label: 'Last slide', caps: ['End'], keys: ['End'] },
  {
    action: 'digit',
    label: 'Go to a slide: type its number, then Enter',
    caps: ['0–9', 'Enter'],
    keys: DIGITS,
  },
  { action: 'blackout', label: 'Blank the screen', caps: ['B'], keys: ['b', 'B'] },
  { action: 'whiteout', label: 'Whiten the screen', caps: ['W'], keys: ['w', 'W'] },
  { action: 'fullscreen', label: 'Full screen (audience window)', caps: ['F'], keys: ['f', 'F'] },
  { action: 'end', label: 'End the show', caps: ['Esc'], keys: ['Escape'] },
];

/** What a key press asks of the show, or nothing. A key with Ctrl, Cmd or Alt is the browser's. */
export function showActionFor(event: {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}): ShowAction | undefined {
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
  return SHOW_KEYS.find((entry) => entry.keys.includes(event.key))?.action;
}
