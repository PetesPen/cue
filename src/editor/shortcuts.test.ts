import { describe, expect, test } from 'vitest';
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

    // Export is the one still to come (sprint 10); the show's keys work since sprint 7.
    expect(planned).toEqual(['General']);
    expect(listed().every((s) => s.planned !== true)).toBe(true);
    expect(listed().some((s) => s.group === 'Presenting')).toBe(true);
    expect(listed().some((s) => s.id === 'general.export')).toBe(false);
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
