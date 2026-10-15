import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// UX-1: a restrained palette, one typeface for the interface, and subtle motion that stops for people
// who ask for less. These read the app's own stylesheets (not the bundled font declarations, which
// are the one place that names typefaces).

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith('.css') && !path.includes(join('src', 'fonts')) ? [path] : [];
  });
}

const files = stylesheets('src').map((path) => ({
  path,
  lines: readFileSync(path, 'utf8').split('\n'),
}));

describe('Given the app stylesheets (UX-1)', () => {
  test('When they are listed, Then the editor, the library, the controls and the slide renderer are all covered', () => {
    const names = files.map((f) => f.path.replaceAll('\\', '/'));

    expect(names).toEqual(
      expect.arrayContaining([
        'src/editor/shell.css',
        'src/editor/home.css',
        'src/editor/controls.css',
        'src/render/slide.css',
        'src/styles/base.css',
      ]),
    );
  });

  test('When every colour written as a hex value is read, Then each one is marked as copied from a design board', () => {
    const unmarked = files.flatMap(({ path, lines }) =>
      lines
        .map((line, index) => ({ line, at: `${path}:${String(index + 1)}` }))
        .filter(({ line }) => /#[0-9a-fA-F]{3,8}\b/.test(line) && !/\/\*.*board/.test(line))
        .map(({ line, at }) => `${at}: ${line.trim()}`),
    );

    expect(unmarked).toEqual([]);
  });

  test('When font families are read, Then the interface uses the one UI font through its token', () => {
    const families = files.flatMap(({ path, lines }) =>
      lines.filter((line) => /font-family\s*:/.test(line)).map((line) => `${path}: ${line.trim()}`),
    );

    for (const family of families) expect(family).toMatch(/var\(--font-ui\)|inherit/);
  });

  test('When transitions and animations are read, Then none is a decorative effect longer than 200 ms', () => {
    const durations = files.flatMap(({ path, lines }) =>
      lines
        .filter((line) => /(transition|animation)(-duration)?\s*:/.test(line))
        .map((line) => ({ path, line: line.trim() })),
    );

    for (const { path, line } of durations) {
      const ms = [...line.matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map(([, value, unit]) =>
        unit === 's' ? Number(value) * 1000 : Number(value),
      );
      // The only longer motion is the spinner of the save indicator, which loops while work is
      // running; it is not decorative and it stops under "reduce motion" (next test).
      if (/\bspin\b/.test(line)) continue;
      for (const duration of ms) expect(duration, `${path}: ${line}`).toBeLessThanOrEqual(200);
    }
  });

  test('When animations are read, Then each one has a "reduce motion" override that turns it off', () => {
    for (const { path, lines } of files) {
      const text = lines.join('\n');
      const animated = /animation\s*:/.test(text) || /transition\s*:/.test(text);
      if (!animated) continue;
      const reduced =
        /@media \(prefers-reduced-motion: reduce\)[\s\S]*?(animation|transition)\s*:\s*none/;
      expect(text, `${path} animates but does not honour reduced motion`).toMatch(reduced);
    }
  });
});
