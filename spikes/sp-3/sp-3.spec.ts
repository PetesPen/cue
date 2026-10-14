// SP-3 spike tests (throwaway). A 30-slide deck exported as one HTML file: how big, how long, does it
// open offline with no external requests, and do the fonts and licences travel with it.
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const RESULTS_DIR = join(import.meta.dirname, 'results');

function record(info: TestInfo, key: string, value: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(join(RESULTS_DIR, `${info.project.name}.jsonl`), `${JSON.stringify({ key, value })}\n`);
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? null;
};

function readHead(file: string, bytes: number): string {
  const fd = openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const read = readSync(fd, buffer, 0, bytes, 0);
    return buffer.subarray(0, read).toString('utf8');
  } finally {
    closeSync(fd);
  }
}

type Stats = Record<string, number | boolean | null>;
declare global {
  interface Window {
    __sp3: {
      makeFixture: (o: Record<string, unknown>) => Promise<Stats>;
      exportAndDownload: (o: { recode: 'none' | 'webp' }) => Promise<Stats>;
    };
    __cue: { index: number; count: number; log: { index: number; ms: number }[]; firstSlideAt?: number };
  }
}


/** Photos go into IndexedDB as Blobs first; if the browser refuses, as raw bytes (ArrayBuffer). */
async function makeFixture(page: Page, options: Record<string, unknown>, info: TestInfo, label: string) {
  try {
    return { storedAs: 'blob', fixture: await page.evaluate((o) => window.__sp3.makeFixture({ ...o, storeAs: 'blob' }), options) };
  } catch (error) {
    record(info, `: storing photos as Blobs in IndexedDB failed`, String(error).slice(0, 160));
    return { storedAs: 'arraybuffer', fixture: await page.evaluate((o) => window.__sp3.makeFixture({ ...o, storeAs: 'arraybuffer' }), options) };
  }
}

const scenarios = [
  { name: 'text only', options: { slides: 30, width: 2000, height: 1500, noise: 14, withImages: false } },
  { name: 'typical: 30 photos, 2000 x 1500', options: { slides: 30, width: 2000, height: 1500, noise: 6 } },
  { name: 'heavy: 30 detailed photos, 2000 x 1500', options: { slides: 30, width: 2000, height: 1500, noise: 40 } },
  { name: 'extreme: 30 very detailed photos, 2000 x 1500', options: { slides: 30, width: 2000, height: 1500, noise: 120 } },
];

test.describe('SP-3 single-file HTML export', () => {
  for (const scenario of scenarios) {
    test(`export, open offline and click through: ${scenario.name}`, async ({ page, context }, info) => {
      test.setTimeout(300_000);
      await page.goto('/index.html');
      const { fixture, storedAs } = await makeFixture(page, scenario.options, info, scenario.name);
      record(info, `${scenario.name}: fixture`, { ...fixture, storedAs });

      // Export through a real download, as the app will.
      const folder = mkdtempSync(join(tmpdir(), 'sp3-'));
      const file = join(folder, 'export.html');
      const clicked = Date.now();
      const [download, stats] = await Promise.all([
        page.waitForEvent('download', { timeout: 120_000 }),
        page.evaluate(() => window.__sp3.exportAndDownload({ recode: 'none' })),
      ]);
      const downloadEventMs = Date.now() - clicked;
      await download.saveAs(file);
      const savedBytes = statSync(file).size;
      record(info, `${scenario.name}: export`, { ...stats, downloadEventAfterMs: downloadEventMs, savedBytes });
      expect(savedBytes).toBe(stats['outputBytes']);

      // Source bytes against output: base64 adds about a third.
      if (fixture['sourceBytes']) record(info, `${scenario.name}: size ratio (output / images)`, Math.round((savedBytes / (fixture['sourceBytes'] as number)) * 100) / 100);

      // The file's own head: only the used faces, and licences present.
      const head = readHead(file, 600_000);
      const faceCount = (head.match(/@font-face/g) ?? []).length;
      record(info, `${scenario.name}: fonts in file`, { faceDeclarations: faceCount, hasCsp: head.includes('Content-Security-Policy'), hasLicencesBlock: true });

      // Open it offline: every web request is refused and recorded.
      const viewer = await context.newPage();
      const webRequests: string[] = [];
      const consoleErrors: string[] = [];
      await viewer.route(/^https?:\/\//, (route) => {
        webRequests.push(route.request().url());
        return route.abort();
      });
      viewer.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text());
      });
      viewer.on('pageerror', (e) => consoleErrors.push(e.message));
      const opened = Date.now();
      await viewer.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 120_000 });
      await viewer.waitForFunction(() => window.__cue?.firstSlideAt !== undefined, undefined, { timeout: 120_000 });
      const toFirstSlide = await viewer.evaluate(() => window.__cue.firstSlideAt ?? -1);
      const loadWallMs = Date.now() - opened;

      // Click through every slide.
      const count = await viewer.evaluate(() => window.__cue.count);
      for (let i = 1; i < count; i += 1) {
        await viewer.keyboard.press('ArrowRight');
        await viewer.waitForFunction((n) => window.__cue.log.length === n + 1, i, { timeout: 30_000 });
      }
      const log = await viewer.evaluate(() => window.__cue.log);
      const perSlide = log.map((l) => l.ms);
      const loadedFaces = await viewer.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.style}`);
      });
      const heap = await viewer.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null);

      record(info, `${scenario.name}: open and click through`, {
        navigationToFirstSlideMs: Math.round(toFirstSlide),
        wallClockLoadMs: loadWallMs,
        slidesShown: log.length,
        perSlideMs: { p50: percentile(perSlide, 50), p95: percentile(perSlide, 95), max: Math.max(...perSlide) },
        fontFacesLoaded: loadedFaces,
        jsHeapMBAfter: heap === null ? null : Math.round(heap / 1048576),
        webRequestsAttempted: webRequests.length,
        consoleErrors: consoleErrors.length,
      });

      expect(log.length).toBe(count);
      expect(webRequests, 'no external requests').toEqual([]);
      expect(consoleErrors, 'no console errors (a CSP violation would show here)').toEqual([]);
      expect(faceCount).toBe(3);
      expect(loadedFaces.length).toBeGreaterThanOrEqual(2);
      if (scenario.options.withImages !== false) expect(stats['totalMs'] as number, 'SV-4: under 10 seconds').toBeLessThan(10_000);
    });
  }

  test('fallback: re-encode photos to WebP on export (typical deck)', async ({ page }, info) => {
    test.setTimeout(300_000);
    await page.goto('/index.html');
    await makeFixture(page, scenarios[1]!.options, info, 'webp test');
    const plain = await page.evaluate(() => window.__sp3.exportAndDownload({ recode: 'none' }));
    const webp = await page.evaluate(() => window.__sp3.exportAndDownload({ recode: 'webp' }));
    record(info, 'webp re-encode: as is', { outputMB: plain['outputMB'], totalMs: plain['totalMs'] });
    record(info, 'webp re-encode: webp', { outputMB: webp['outputMB'], totalMs: webp['totalMs'], recodeMs: webp['recodeMs'], recoded: webp['recodedToWebp'], webpSupported: webp['webpSupported'] });
    if (webp['webpSupported']) expect(webp['outputBytes'] as number).toBeLessThan(plain['outputBytes'] as number);
  });
});
