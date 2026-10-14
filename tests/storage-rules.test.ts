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
  test('When it is read, Then no code keeps anything in localStorage or sessionStorage', () => {
    const offenders = sources('src').filter((path) =>
      /\b(localStorage|sessionStorage)\b/.test(readFileSync(path, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });

  test('When it is read, Then the deck store is built on IndexedDB through Dexie', () => {
    const database = readFileSync(join('src', 'storage', 'database.ts'), 'utf8');

    expect(database).toMatch(/from 'dexie'/);
  });
});
