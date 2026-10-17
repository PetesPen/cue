import { describe, expect, test } from 'vitest';
import { SHOW_KEYS } from '@/model';
import {
  GROUPS,
  SHORTCUTS,
  displayKey,
  listed,
  matches,
  shortcutById,
  shortcutText,
} from './shortcuts';

describe('the table of shortcuts (UX-2)', () => {
  test('Given the table, Then every shortcut has a unique id, a name, a group and at least one key', () => {
    expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.label).not.toBe('');
      expect(GROUPS).toContain(shortcut.group);
      expect(shortcut.keys.length).toBeGreaterThan(0);
    }
  });

  test('Given the shortcuts of the Shortcuts board, Then each is in the table with its keys', () => {
    const keys = (id: string) => shortcutById(id).keys.join(' ');

    expect(keys('slide.new')).toBe('Mod M');
    expect(keys('slide.duplicate')).toBe('Mod Shift D');
    expect(keys('order.front')).toBe('Mod Shift ]');
    expect(keys('general.redo')).toBe('Mod Shift Z');
    expect(keys('general.help')).toBe('?');
    expect(keys('element.shape')).toBe('S');
    expect(keys('element.image')).toBe('I');
    expect(keys('element.nudge')).toBe('← ↑ → ↓');
  });

  test('Given the shortcuts that need features not built yet, Then the sheet leaves them out until they work', () => {
    const planned = SHORTCUTS.filter((s) => s.planned === true).map((s) => s.group);

    // Everything in the table works: the show's keys since sprint 7, Export since sprint 9.
    expect(planned).toEqual([]);
    expect(listed()).toHaveLength(SHORTCUTS.length);
    expect(listed().some((s) => s.group === 'Presenting')).toBe(true);
    expect(listed().some((s) => s.id === 'general.export')).toBe(true);
  });

  test('Given Mod, When it is drawn, Then it is Ctrl, or ⌘ on a Mac', () => {
    expect(displayKey('Mod', false)).toBe('Ctrl');
    expect(displayKey('Mod', true)).toBe('⌘');
    expect(displayKey('Shift', true)).toBe('Shift');
    expect(shortcutText('slide.duplicate', false)).toBe('Ctrl+Shift+D');
    expect(shortcutText('slide.duplicate', true)).toBe('⌘+Shift+D');
  });

  test.each([
    ['', 'slide.new', true],
    ['duplic', 'slide.duplicate', true],
    ['DUPLIC', 'slide.duplicate', true],
    ['duplic', 'slide.new', false],
    ['ctrl', 'general.undo', true],
    ['⌘', 'general.undo', false],
    ['order', 'order.front', true],
    ['zzz', 'general.undo', false],
  ])('Given the search "%s", When %s is checked, Then it matches: %s', (query, id, wanted) => {
    expect(matches(shortcutById(id), query, false)).toBe(wanted);
  });

  test('Given a Mac, When the search is ⌘, Then shortcuts with Mod match', () => {
    expect(matches(shortcutById('general.undo'), '⌘', true)).toBe(true);
  });
});

describe('the keys of a show on the sheet (PM-6)', () => {
  test('Given the table of show keys, Then the sheet lists every one of them in the Presenting group with the same key caps', () => {
    const presenting = listed().filter((shortcut) => shortcut.group === 'Presenting');

    for (const entry of SHOW_KEYS) {
      const row = presenting.find((shortcut) => shortcut.id === `show.${entry.action}`);
      expect(row?.label, entry.action).toBe(entry.label);
      expect(row?.keys, entry.action).toEqual(entry.caps);
    }
  });

  test('Given the editor keys to start a show, Then they are on the sheet too, and nothing is listed that does nothing', () => {
    const ids = listed().map((shortcut) => shortcut.id);

    expect(ids).toContain('present.start');
    expect(ids).toContain('present.here');
    expect(listed().every((shortcut) => shortcut.planned !== true)).toBe(true);
  });
});
