// SP-6 spike tests (throwaway). Installable and offline: service worker, offline reload, installability,
// updates that wait for the user, and a development server that never registers a worker.
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page, type Playwright, type TestInfo } from '@playwright/test';

const RESULTS_DIR = join(import.meta.dirname, 'results');
const ORIGIN = 'http://127.0.0.1:4200';

function record(info: TestInfo, key: string, value: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(join(RESULTS_DIR, `${info.project.name}.jsonl`), `${JSON.stringify({ key, value })}\n`);
}

test.afterEach(async ({}, info) => {
  if (info.status !== info.expectedStatus && info.status !== 'skipped') {
    record(info, `FAILED: ${info.title}`, String(info.error?.message ?? info.status).slice(0, 700));
  }
});

/** A persistent profile (service workers need real storage), with console errors collected. */
async function openApp(playwright: Playwright, info: TestInfo) {
  const kind = (info.project.use.defaultBrowserType ?? 'chromium') as 'chromium' | 'firefox' | 'webkit';
  const dir = mkdtempSync(join(tmpdir(), 'sp6-'));
  const context = await playwright[kind].launchPersistentContext(dir, { channel: info.project.use.channel, baseURL: ORIGIN });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return {
    kind,
    context,
    page,
    errors,
    close: async () => {
      await context.close();
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* a locked temp folder is not a test failure */
      }
    },
  };
}

const version = (page: Page) => page.evaluate(() => document.querySelector('meta[name="spike-version"]')?.getAttribute('content'));

/** Waits until a service worker controls the page (the first visit installs it; a reload hands over control). */
async function makeControlled(page: Page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 15_000 });
}

test.describe('SP-6 installable and offline', () => {
  test.beforeEach(async ({ request }) => {
    await request.get(`${ORIGIN}/__switch?to=a`);
  });

  test('a worker registers and caches the whole app, fonts included', async ({ playwright }, info) => {
    const app = await openApp(playwright, info);
    try {
      await makeControlled(app.page);
      const cache = await app.page.evaluate(async () => {
        const names = await caches.keys();
        let entries = 0;
        let bytes = 0;
        const urls: string[] = [];
        for (const name of names) {
          const cache = await caches.open(name);
          for (const request of await cache.keys()) {
            entries += 1;
            urls.push(new URL(request.url).pathname);
            bytes += (await (await cache.match(request))!.arrayBuffer()).byteLength;
          }
        }
        const registration = await navigator.serviceWorker.getRegistration();
        return { names: names.length, entries, MB: Math.round((bytes / 1048576) * 100) / 100, fonts: urls.filter((u) => u.endsWith('.woff2')).length, hasIndex: urls.includes('/index.html'), hasManifest: urls.some((u) => u.endsWith('.webmanifest')), scope: registration?.scope, active: registration?.active?.state };
      });
      record(info, 'service worker and cache', cache);
      expect(['activating', 'activated']).toContain(cache.active);
      expect(cache.fonts, 'all eleven bundled fonts are cached').toBe(11);
      expect(cache.hasIndex).toBe(true);
      expect(app.errors, 'no console errors under the real security headers').toEqual([]);
    } finally {
      await app.close();
    }
  });

  test('offline: the app reloads and works with no network', async ({ playwright }, info) => {
    const app = await openApp(playwright, info);
    try {
      await makeControlled(app.page);
      await app.context.setOffline(true);
      await app.page.reload();
      await expect(app.page.getByRole('heading', { name: 'Cue', level: 1 })).toBeVisible();
      await app.page.getByRole('tab', { name: 'Animate' }).click();
      await expect(app.page.getByRole('tabpanel', { name: 'Animate' })).toBeVisible();
      const loadedFonts = await app.page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replaceAll('"', ''));
      });
      // A path the app does not have, as if the user opened a deep link offline.
      const deep = await app.page.goto('/some/deep/link', { waitUntil: 'load' }).then((r) => r?.status() ?? 'no response').catch((e) => String(e).slice(0, 80));
      const deepShowsApp = await app.page.getByRole('heading', { name: 'Cue', level: 1 }).isVisible().catch(() => false);
      record(info, 'offline reload', { shellWorks: true, fontsLoaded: loadedFonts, deepLinkStatus: deep, deepLinkShowsTheApp: deepShowsApp, consoleErrors: app.errors.length });
      expect(loadedFonts).toContain('Instrument Sans');
    } finally {
      await app.close();
    }
  });

  test('installable (Chromium): no installability errors, a valid manifest', async ({ playwright }, info) => {
    test.skip((info.project.use.defaultBrowserType ?? 'chromium') !== 'chromium', 'uses a Chromium protocol call');
    const app = await openApp(playwright, info);
    try {
      await makeControlled(app.page);
      const client = await app.context.newCDPSession(app.page);
      const installability = (await client.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] };
      const manifest = (await client.send('Page.getAppManifest')) as { errors: { message: string }[]; data?: string };
      const parsed = manifest.data ? (JSON.parse(manifest.data) as { name?: string; display?: string; icons?: { sizes: string; purpose?: string }[] }) : {};
      record(info, 'installability', { installabilityErrors: installability.installabilityErrors.map((e) => e.errorId), manifestErrors: manifest.errors.map((e) => e.message), name: parsed.name, display: parsed.display, icons: parsed.icons?.map((i) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ''}`) });
      expect(installability.installabilityErrors).toEqual([]);
      expect(manifest.errors).toEqual([]);
      expect(parsed.display).toBe('standalone');
    } finally {
      await app.close();
    }
  });

  test('an update waits for the user, never replaces the running app, and leaves stored decks alone', async ({ playwright, request }, info) => {
    test.setTimeout(120_000);
    const app = await openApp(playwright, info);
    try {
      await makeControlled(app.page);
      expect(await version(app.page)).toBe('a');
      // A "stored deck" the update must not touch.
      await app.page.evaluate(
        () =>
          new Promise<void>((resolve, reject) => {
            const open = indexedDB.open('sp6', 1);
            open.onupgradeneeded = () => open.result.createObjectStore('k');
            open.onsuccess = () => {
              const tx = open.result.transaction('k', 'readwrite');
              tx.objectStore('k').put('precious deck', 'deck');
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            };
          }),
      );

      await request.get(`${ORIGIN}/__switch?to=b`); // "deploy" version b
      const started = Date.now();
      await app.page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      });
      const waitingAfter = await app.page
        .waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.waiting !== null, undefined, { timeout: 20_000 })
        .then(() => Date.now() - started)
        .catch(() => null);

      const stillRunning = await version(app.page);
      await app.page.reload();
      const afterReloadBeforeChoosing = await version(app.page);

      // The user chooses "update now".
      const handover = await app.page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        const waiting = registration?.waiting;
        const signal = new Promise<string>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve('controllerchange'), { once: true });
          waiting?.addEventListener('statechange', () => {
            if (waiting.state === 'activated') resolve('worker activated');
          });
          setTimeout(() => resolve('neither event within 8 s'), 8000);
        });
        waiting?.postMessage({ type: 'SKIP_WAITING' });
        return signal;
      });
      await app.page.reload();
      const afterChoosing = await version(app.page);

      const deck = await app.page.evaluate(
        () =>
          new Promise<unknown>((resolve) => {
            const open = indexedDB.open('sp6', 1);
            open.onsuccess = () => {
              const get = open.result.transaction('k').objectStore('k').get('deck');
              get.onsuccess = () => resolve(get.result);
            };
          }),
      );
      const caches = await app.page.evaluate(async () => (await window.caches.keys()).length);
      record(info, 'update flow', { newWorkerWaitingAfterMs: waitingAfter, versionWhileWaiting: stillRunning, versionAfterReloadWhileWaiting: afterReloadBeforeChoosing, versionAfterUserChoseUpdate: afterChoosing, handoverSignal: handover, storedDeckAfterUpdate: deck, cacheStores: caches });
      expect(waitingAfter, 'the new worker is installed and waiting').not.toBeNull();
      expect(stillRunning).toBe('a');
      expect(afterReloadBeforeChoosing, 'a reload alone does not switch versions').toBe('a');
      expect(afterChoosing).toBe('b');
      expect(deck).toBe('precious deck');
    } finally {
      await app.close();
    }
  });

  test('the development server registers no service worker', async ({ playwright }, info) => {
    test.setTimeout(120_000);
    const dev = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'spikes/sp-6/vite.pwa.config.mjs', '--port', '4300', '--strictPort', '--host', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const log: string[] = [];
    dev.stdout.on('data', (d: Buffer) => log.push(String(d)));
    dev.stderr.on('data', (d: Buffer) => log.push(String(d)));
    const app = await openApp(playwright, info);
    try {
      const deadline = Date.now() + 60_000;
      while (!log.join('').includes('127.0.0.1:4300') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 300));
      await app.page.goto('http://127.0.0.1:4300/', { waitUntil: 'load' });
      await app.page.waitForTimeout(1500);
      const state = await app.page.evaluate(async () => ({
        registrations: (await navigator.serviceWorker.getRegistrations()).length,
        manifestLink: document.querySelector('link[rel="manifest"]') !== null,
        cacheStores: (await window.caches.keys()).length,
      }));
      record(info, 'development server with the PWA plugin installed', state);
      expect(state.registrations, 'no service worker in development').toBe(0);
      expect(state.cacheStores).toBe(0);
    } finally {
      await app.close();
      dev.kill();
    }
  });
});
