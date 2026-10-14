import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { check, firstLoadFiles, measure } from '../scripts/check-bundle-size.mjs';

const KB = 1024;

// A dist folder as Vite writes it, plus a lazy chunk that index.html does not ask for.
const dist = mkdtempSync(join(tmpdir(), 'cue-dist-'));
mkdirSync(join(dist, 'assets'));
writeFileSync(
  join(dist, 'index.html'),
  `<!doctype html><html><head>
<link rel="icon" href="/favicon.svg">
<script type="module" crossorigin src="/assets/index-aaa.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-bbb.js">
<link crossorigin rel="stylesheet" href="/assets/index-ccc.css">
</head><body></body></html>`,
);
// Random bytes do not compress, so their gzipped size is about their size.
writeFileSync(join(dist, 'assets', 'index-aaa.js'), randomBytes(10 * KB));
writeFileSync(join(dist, 'assets', 'vendor-bbb.js'), randomBytes(20 * KB));
writeFileSync(join(dist, 'assets', 'index-ccc.css'), randomBytes(2 * KB));
writeFileSync(join(dist, 'assets', 'present-zzz.js'), randomBytes(500 * KB));
afterAll(() => {
  rmSync(dist, { recursive: true, force: true });
});

describe('Given the first-load rule for the bundle budget (config/budgets.json)', () => {
  test('When index.html is read, Then module scripts, preloads and stylesheets count, in any attribute order', () => {
    expect(firstLoadFiles(readIndex())).toEqual({
      js: ['/assets/index-aaa.js', '/assets/vendor-bbb.js'],
      css: ['/assets/index-ccc.css'],
    });
  });

  test('When the folder is measured, Then a lazy chunk that index.html does not request is not counted', () => {
    const { jsGzipBytes, cssGzipBytes, files } = measure(dist);
    expect(files.map((f) => f.file)).not.toContain('/assets/present-zzz.js');
    expect(jsGzipBytes).toBeGreaterThan(30 * KB);
    expect(jsGzipBytes).toBeLessThan(31 * KB);
    expect(cssGzipBytes).toBeGreaterThan(2 * KB);
    expect(cssGzipBytes).toBeLessThan(3 * KB);
  });

  test('When the first load is inside both budgets, Then nothing is reported', () => {
    expect(check(measure(dist), { initialJsGzipKB: 40, initialCssGzipKB: 5 })).toEqual([]);
  });

  test('When first-load JavaScript is over its budget, Then one problem names it', () => {
    const problems = check(measure(dist), { initialJsGzipKB: 25, initialCssGzipKB: 5 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('JavaScript');
  });

  test('When first-load CSS is over its budget, Then one problem names it', () => {
    const problems = check(measure(dist), { initialJsGzipKB: 40, initialCssGzipKB: 1 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('CSS');
  });
});

function readIndex(): string {
  return `<script type="module" crossorigin src="/assets/index-aaa.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-bbb.js">
<link crossorigin rel="stylesheet" href="/assets/index-ccc.css">
<link rel="icon" href="/favicon.svg">`;
}
