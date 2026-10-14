// SP-5 spike tests (throwaway). Storage: quota, a full store, a cleared store, saving and opening.
import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page, type TestInfo, type BrowserContext, type Playwright } from '@playwright/test';

const RESULTS_DIR = join(import.meta.dirname, 'results');
const ORIGIN = 'http://127.0.0.1:4200';

function record(info: TestInfo, key: string, value: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(join(RESULTS_DIR, `${info.project.name}.jsonl`), `${JSON.stringify({ key, value })}\n`);
}

type Json = Record<string, unknown>;
declare global {
  interface Window {
    __sp5: {
      reset: () => Promise<void>;
      numbers: () => Promise<Json>;
      blobsAndBytes: () => Promise<Json>;
      saveDeckAtomically: (id: string, imageMB: number, imageSizeMB?: number) => Promise<Json & { ok: boolean; name?: string }>;
      saveDeckInPieces: (id: string, imageMB: number, imageSizeMB?: number) => Promise<Json & { ok: boolean; photosWritten: number }>;
      counts: () => Promise<{ decks: string[]; images: number; orphanImages: number }>;
      timings: () => Promise<Json>;
      reopen: () => Promise<{ decks: string[]; images: number; orphanImages: number }>;
    };
  }
}

/** A persistent browser profile, so quotas look like a real user's, not a throwaway session's. */
async function openApp(playwright: Playwright, info: TestInfo, prefs?: Record<string, string | number | boolean>) {
  const kind = (info.project.use.defaultBrowserType ?? 'chromium') as 'chromium' | 'firefox' | 'webkit';
  const dir = mkdtempSync(join(tmpdir(), 'sp5-'));
  const context = await playwright[kind].launchPersistentContext(dir, {
    channel: info.project.use.channel,
    baseURL: ORIGIN,
    ...(kind === 'firefox' && prefs ? { firefoxUserPrefs: prefs } : {}),
  });
  const page = await context.newPage();
  await page.goto('/index.html');
  return { kind, context, page, close: async () => {
    await context.close();
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* a locked temp folder is not a test failure */ }
  } };
}

async function limitQuota(context: BrowserContext, page: Page, megabytes: number) {
  const client = await context.newCDPSession(page);
  await client.send('Storage.overrideQuotaForOrigin', { origin: ORIGIN, quotaSize: megabytes * 1024 * 1024 });
}

test.describe('SP-5 storage limits', () => {
  test('quota, usage and persistent storage in a fresh profile', async ({ playwright }, info) => {
    const app = await openApp(playwright, info);
    try {
      record(info, 'numbers (fresh profile)', await app.page.evaluate(() => window.__sp5.numbers()));
    } finally {
      await app.close();
    }
  });

  test('photos as Blobs against raw bytes: stored, read back, identical?', async ({ playwright }, info) => {
    test.setTimeout(120_000);
    const app = await openApp(playwright, info);
    try {
      const result = await app.page.evaluate(() => window.__sp5.blobsAndBytes());
      record(info, 'blobs against raw bytes (30 x 700 KB)', result);
      expect((result['arrayBuffer'] as Json)['ok'], 'raw bytes are stored').toBe(true);
      expect((result['arrayBuffer'] as Json)['identical'], 'raw bytes come back identical').toBe(true);
    } finally {
      await app.close();
    }
  });

  test('saving and opening: 20 decks of 50 slides, and one deck with 50 photos', async ({ playwright }, info) => {
    test.setTimeout(180_000);
    const app = await openApp(playwright, info);
    try {
      const result = await app.page.evaluate(() => window.__sp5.timings());
      record(info, 'timings', result);
      expect(result['openDeckJsonMs'] as number, 'UX-3: a 50-slide deck opens in under 2 s').toBeLessThan(2000);
      expect((result['autosaveMs'] as Json)['p95'] as number, 'SV-1: saves within 2 s').toBeLessThan(2000);
    } finally {
      await app.close();
    }
  });

  test('a full store: a failed save leaves nothing half written (Chromium and Firefox)', async ({ playwright }, info) => {
    test.setTimeout(240_000);
    const kind = info.project.use.defaultBrowserType ?? 'chromium';
    test.skip(kind === 'webkit', 'WebKit has no way to set a small quota; needs real Safari');
    const app = await openApp(playwright, info, { 'dom.quotaManager.temporaryStorage.fixedLimit': 51200 });
    try {
      if (app.kind === 'chromium') await limitQuota(app.context, app.page, 60);
      await app.page.reload();
      await app.page.evaluate(() => window.__sp5.reset());
      const before = await app.page.evaluate(() => window.__sp5.numbers());

      const a = await app.page.evaluate(() => window.__sp5.saveDeckAtomically('deckA', 5));
      const b = await app.page.evaluate(() => window.__sp5.saveDeckAtomically('deckB', 90)); // far more than the quota
      const afterFail = await app.page.evaluate(() => window.__sp5.counts());
      const c = await app.page.evaluate(() => window.__sp5.saveDeckAtomically('deckC', 10));
      const afterRecover = await app.page.evaluate(() => window.__sp5.counts());
      const pieces = await app.page.evaluate(() => window.__sp5.saveDeckInPieces('deckD', 90));
      const afterPieces = await app.page.evaluate(() => window.__sp5.counts());
      const reopened = await app.page.evaluate(() => window.__sp5.reopen());
      const after = await app.page.evaluate(() => window.__sp5.numbers());

      record(info, 'full store: quota in force', { before, after });
      record(info, 'full store: 5 MB deck saved in one transaction', a);
      record(info, 'full store: 90 MB deck in one transaction (should fail)', b);
      record(info, 'full store: what is stored after the failure', afterFail);
      record(info, 'full store: 10 MB deck after the failure', c);
      record(info, 'full store: what is stored after recovering', afterRecover);
      record(info, 'full store: 90 MB deck written one photo per transaction (the wrong way)', { result: pieces, stored: afterPieces });
      record(info, 'full store: after closing and reopening the database', reopened);

      expect(a['ok']).toBe(true);
      if (app.kind === 'chromium') {
        expect(b['ok'], 'the oversized save fails').toBe(false);
        // Dexie reports a failed transaction as AbortError and keeps the real cause in `inner`.
        expect(`${String(b['name'])} ${String(b['innerName'])}`, 'with a quota error').toMatch(/quota/i);
        expect(afterFail.decks, 'the failed deck left no trace').toEqual(['deckA']);
        expect(afterFail.orphanImages, 'no photos left behind by the failed save').toBe(0);
        expect(c['ok'], 'a smaller save works afterwards').toBe(true);
      }
    } finally {
      await app.close();
    }
  });

  test('cleared site data (Chromium): everything is gone and the app cannot tell', async ({ playwright }, info) => {
    test.skip((info.project.use.defaultBrowserType ?? 'chromium') !== 'chromium', 'uses a Chromium protocol call');
    const app = await openApp(playwright, info);
    try {
      await app.page.evaluate(() => window.__sp5.reset());
      await app.page.evaluate(() => window.__sp5.saveDeckAtomically('keepsake', 5));
      const before = await app.page.evaluate(() => window.__sp5.counts());
      await app.page.evaluate(() => localStorage.setItem('cue-last-backup', String(Date.now())));

      const client = await app.context.newCDPSession(app.page);
      await client.send('Storage.clearDataForOrigin', { origin: ORIGIN, storageTypes: 'all' });
      await app.page.reload();
      const after = await app.page.evaluate(() => window.__sp5.reopen());
      const reminder = await app.page.evaluate(() => localStorage.getItem('cue-last-backup'));
      record(info, 'cleared site data: decks before and after', { before, after, backupReminderStillThere: reminder !== null });
      expect(after.decks).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
