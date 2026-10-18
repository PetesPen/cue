import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// Gate 4 (sprint 10): every Must story has at least one end-to-end test (CLAUDE.md, testing rules). This
// reads the stories and the tests and fails when a Must story's ID is in no test's title: a test that is
// there but does not say which story it shows is as good as none when someone looks for it.

/** The IDs of the Must stories, in the order the stories file has them. */
function mustStories(): string[] {
  const text = readFileSync('docs/user-stories.md', 'utf8');
  return [...text.matchAll(/^\*\*([A-Z]{2}-\d+) [^\n]*?\(Must\)\./gm)].map(
    (match) => match[1] ?? '',
  );
}

function specFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return specFiles(path);
    return /\.(spec|perf)\.ts$/.test(entry.name) ? [path] : [];
  });
}

/** Every quoted string of the end-to-end and performance suites: the titles are among them. */
function quotedStrings(): string {
  const quoted = /'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g;
  return [...specFiles('e2e'), ...specFiles('perf')]
    .flatMap((path) => readFileSync(path, 'utf8').match(quoted) ?? [])
    .join('\n');
}

describe('the Must stories and their end-to-end tests (Gate 4)', () => {
  const stories = mustStories();
  const strings = quotedStrings();

  test('Given the stories file, Then it has the 39 Must stories', () => {
    expect(stories).toHaveLength(39);
    expect(new Set(stories).size).toBe(39);
  });

  test.each(stories)(
    'Given the Must story %s, Then an end-to-end or performance test names it',
    (id) => {
      expect(strings, `${id} is in no end-to-end or performance test title`).toMatch(
        new RegExp(`\\b${id}\\b`),
      );
    },
  );
});
