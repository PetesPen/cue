/**
 * Every keyboard shortcut in one table (UX-2; design: Shortcuts). The key handler's names, the
 * tooltips and the cheat sheet all read it, so they cannot disagree, and a test checks that what the
 * table says is on a toolbar button is there.
 */

export type ShortcutGroup = 'Slides' | 'Order' | 'General' | 'Elements' | 'Presenting';

export interface Shortcut {
  readonly id: string;
  readonly label: string;
  readonly group: ShortcutGroup;
  /** The key caps, left to right. "Mod" is Ctrl, or ⌘ on a Mac. */
  readonly keys: readonly string[];
  /** Not built yet: it is left off the sheet until it works, so the list never promises a key that does nothing. */
  readonly planned?: true;
}

export const GROUPS: readonly ShortcutGroup[] = [
  'Slides',
  'Order',
  'General',
  'Elements',
  'Presenting',
];

export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'slide.new', label: 'New slide', group: 'Slides', keys: ['Mod', 'M'] },
  { id: 'slide.duplicate', label: 'Duplicate slide', group: 'Slides', keys: ['Mod', 'Shift', 'D'] },
  { id: 'slide.delete', label: 'Delete slide', group: 'Slides', keys: ['Delete'] },
  { id: 'slide.step', label: 'Previous or next slide', group: 'Slides', keys: ['↑', '↓'] },

  { id: 'order.forward', label: 'Bring forward', group: 'Order', keys: ['Mod', ']'] },
  { id: 'order.backward', label: 'Send backward', group: 'Order', keys: ['Mod', '['] },
  { id: 'order.front', label: 'Bring to front', group: 'Order', keys: ['Mod', 'Shift', ']'] },
  { id: 'order.back', label: 'Send to back', group: 'Order', keys: ['Mod', 'Shift', '['] },

  { id: 'general.undo', label: 'Undo', group: 'General', keys: ['Mod', 'Z'] },
  { id: 'general.redo', label: 'Redo', group: 'General', keys: ['Mod', 'Shift', 'Z'] },
  { id: 'general.save', label: 'Save now', group: 'General', keys: ['Mod', 'S'] },
  { id: 'general.export', label: 'Export', group: 'General', keys: ['Mod', 'E'], planned: true },
  { id: 'general.help', label: 'Show this list', group: 'General', keys: ['?'] },

  { id: 'element.text', label: 'Text box', group: 'Elements', keys: ['T'] },
  { id: 'element.shape', label: 'Shape', group: 'Elements', keys: ['S'] },
  { id: 'element.image', label: 'Image', group: 'Elements', keys: ['I'] },
  { id: 'element.duplicate', label: 'Duplicate', group: 'Elements', keys: ['Mod', 'D'] },
  { id: 'element.nudge', label: 'Nudge', group: 'Elements', keys: ['←', '↑', '→', '↓'] },
  { id: 'element.nudgeFar', label: 'Nudge further', group: 'Elements', keys: ['Shift', 'Arrows'] },

  {
    id: 'present.start',
    label: 'Start from the beginning',
    group: 'Presenting',
    keys: ['Mod', 'Enter'],
    planned: true,
  },
  {
    id: 'present.here',
    label: 'Start from this slide',
    group: 'Presenting',
    keys: ['Mod', 'Shift', 'Enter'],
    planned: true,
  },
  {
    id: 'present.next',
    label: 'Next click or slide',
    group: 'Presenting',
    keys: ['→', 'Space'],
    planned: true,
  },
  {
    id: 'present.previous',
    label: 'Previous click or slide',
    group: 'Presenting',
    keys: ['←'],
    planned: true,
  },
  {
    id: 'present.blank',
    label: 'Blank the screen',
    group: 'Presenting',
    keys: ['B'],
    planned: true,
  },
  { id: 'present.end', label: 'End the show', group: 'Presenting', keys: ['Esc'], planned: true },
];

/** Is this a Mac, where Mod is ⌘? Read when asked, so a test can change it. */
export function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

export function shortcutById(id: string): Shortcut {
  const found = SHORTCUTS.find((shortcut) => shortcut.id === id);
  if (!found) throw new Error(`No shortcut called ${id}`);
  return found;
}

/** A key as it is drawn: Mod is Ctrl or ⌘. */
export function displayKey(key: string, mac: boolean = isMac()): string {
  return key === 'Mod' ? (mac ? '⌘' : 'Ctrl') : key;
}

export function displayKeys(shortcut: Shortcut, mac: boolean = isMac()): string[] {
  return shortcut.keys.map((key) => displayKey(key, mac));
}

/** "Ctrl+Shift+D", for a tooltip's plain text. */
export function shortcutText(id: string, mac: boolean = isMac()): string {
  return displayKeys(shortcutById(id), mac).join('+');
}

/** The shortcuts the sheet lists: those that work now. */
export function listed(): readonly Shortcut[] {
  return SHORTCUTS.filter((shortcut) => shortcut.planned !== true);
}

/** Does a shortcut match what was typed in the search box? By its name or by its keys. */
export function matches(shortcut: Shortcut, query: string, mac: boolean = isMac()): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  const haystack = `${shortcut.label} ${displayKeys(shortcut, mac).join(' ')} ${shortcut.group}`;
  return haystack.toLowerCase().includes(needle);
}
