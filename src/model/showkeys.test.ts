import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { SHOW_KEYS, showActionFor, type ShowAction } from './showkeys';

const press = (
  key: string,
  modifiers: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', true>> = {},
) => showActionFor({ key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers });

describe('the keys of a show (PM-6)', () => {
  test.each<[string, ShowAction | undefined]>([
    ['ArrowRight', 'next'],
    ['ArrowDown', 'next'],
    ['PageDown', 'next'],
    [' ', 'next'],
    ['Enter', 'next'],
    ['ArrowLeft', 'previous'],
    ['ArrowUp', 'previous'],
    ['PageUp', 'previous'],
    ['Backspace', 'previous'],
    ['Home', 'first'],
    ['End', 'last'],
    ['7', 'digit'],
    ['0', 'digit'],
    ['b', 'blackout'],
    ['B', 'blackout'],
    ['w', 'whiteout'],
    ['W', 'whiteout'],
    ['f', 'fullscreen'],
    ['F', 'fullscreen'],
    ['Escape', 'end'],
    ['x', undefined],
    ['Tab', undefined],
    ['F5', undefined],
    ['', undefined],
  ])('Given the key %j, When it is pressed, Then the action is %s', (key, action) => {
    expect(press(key)).toBe(action);
  });

  test('Given Ctrl, Cmd or Alt, When a show key is pressed, Then it is left to the browser', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(press('ArrowRight', { [modifier]: true })).toBeUndefined();
      expect(press('b', { [modifier]: true })).toBeUndefined();
    }
  });

  test('Given the table, Then every action appears once and no key does two things', () => {
    const actions = SHOW_KEYS.map((entry) => entry.action);
    expect(new Set(actions).size).toBe(actions.length);
    const keys = SHOW_KEYS.flatMap((entry) => entry.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('Given every entry, Then it has a label and key caps for the sheet', () => {
    for (const entry of SHOW_KEYS) {
      expect(entry.label.length).toBeGreaterThan(3);
      expect(entry.caps.length).toBeGreaterThan(0);
      expect(entry.keys.length).toBeGreaterThan(0);
    }
  });

  test('Given any key, When it is looked up, Then the answer is one a table entry gives', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), (key) => {
        const action = press(key);
        if (action === undefined) {
          expect(SHOW_KEYS.some((entry) => entry.keys.includes(key))).toBe(false);
        } else {
          expect(SHOW_KEYS.find((entry) => entry.action === action)?.keys).toContain(key);
        }
      }),
    );
  });
});
