import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import {
  MAX_DIGITS,
  PAGE_KEYS,
  SHOW_KEYS,
  pageActionFor,
  showActionFor,
  typeDigit,
  type ShowAction,
} from './showkeys';

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

describe('typing a slide number (PM-6)', () => {
  test('Given digits typed one after another, Then they make a number', () => {
    expect(['1', '2'].reduce(typeDigit, '')).toBe('12');
  });

  test('Given more digits than a deck could need, Then only the first are kept', () => {
    expect(Array.from('123456789').reduce(typeDigit, '')).toHaveLength(MAX_DIGITS);
    expect(Array.from('123456789').reduce(typeDigit, '')).toBe('1234');
  });
});

describe('the keys only the exported page has (SV-4)', () => {
  const lookup = (key: string, modifiers: { ctrlKey?: true; metaKey?: true; altKey?: true } = {}) =>
    pageActionFor({ key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers });

  test.each([
    ['n', 'notes'],
    ['N', 'notes'],
    ['?', 'help'],
    ['x', undefined],
    ['ArrowRight', undefined],
  ])('Given the key %j, Then the page action is %s', (key, action) => {
    expect(lookup(key)).toBe(action);
  });

  test('Given Ctrl, Cmd or Alt, Then the key is left to the browser', () => {
    expect(lookup('n', { ctrlKey: true })).toBeUndefined();
    expect(lookup('n', { metaKey: true })).toBeUndefined();
    expect(lookup('?', { altKey: true })).toBeUndefined();
  });

  test('Given both tables, Then no key does two things and every entry has a label and caps', () => {
    const keys = [...SHOW_KEYS, ...PAGE_KEYS].flatMap((entry) => entry.keys);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of PAGE_KEYS) {
      expect(entry.label.length).toBeGreaterThan(3);
      expect(entry.caps.length).toBeGreaterThan(0);
    }
  });
});
