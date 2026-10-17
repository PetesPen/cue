import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// SV-1: decks live in IndexedDB, "not the small key-value store, so image-heavy decks fit".

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('Given the app source (SV-1)', () => {
  // The two small things a window keeps for itself (decisions 33 and 34): where a show was, for this tab,
  // and the presenter view's layout, for this browser. Neither holds anything of a deck.
  const SMALL_HABITS = ['placeStore.ts', 'layoutStore.ts'].map((name) =>
    join('src', 'present', name),
  );

  test('When it is read, Then no code keeps anything in localStorage or sessionStorage, except those two habits', () => {
    const offenders = sources('src')
      .filter((path) => !SMALL_HABITS.includes(path))
      .filter((path) => /\b(localStorage|sessionStorage)\b/.test(readFileSync(path, 'utf8')));

    expect(offenders).toEqual([]);
  });

  test('When the two habits are read, Then they only keep a place and a layout, never a deck, a slide or a picture', () => {
    for (const path of SMALL_HABITS) {
      const text = readFileSync(path, 'utf8');
      expect(text).not.toMatch(/StoredImage|DeckStore|from '@\/storage'/);
      expect(text).not.toMatch(/JSON\.stringify\((deck|slide)/);
    }
  });

  test('When it is read, Then the deck store is built on IndexedDB through Dexie', () => {
    const database = readFileSync(join('src', 'storage', 'database.ts'), 'utf8');

    expect(database).toMatch(/from 'dexie'/);
  });
});
