// SP-1 spike tests (throwaway). They measure and record what each browser does, and only assert the
// pass lines from docs/backlog/sprint-00.md: two windows from one click, sync within 100 ms, the
// other window surviving a close, and a clear signal when a window is blocked.
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

const RESULTS_DIR = join(import.meta.dirname, 'results');
const ORIGIN = 'http://127.0.0.1:4200';

function record(info: TestInfo, key: string, value: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(join(RESULTS_DIR, `${info.project.name}.jsonl`), `${JSON.stringify({ key, value })}\n`);
}

const isBlockerProject = (info: TestInfo) => info.project.name.endsWith('-blocker');

function summarise(values: number[]) {
  if (values.length === 0) return { n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  const round = (x: number | undefined) => (x === undefined ? null : Math.round(x * 10) / 10);
  return { n: sorted.length, p50: round(at(50)), p95: round(at(95)), p99: round(at(99)), max: round(sorted.at(-1)) };
}

async function startOpener(context: BrowserContext, query = '') {
  const opener = await context.newPage();
  await opener.goto(`/index.html${query}`);
  return opener;
}

/** Clicks a button on the opener and returns the pages that appeared, sorted by role. */
async function openWindows(context: BrowserContext, opener: Page, button: RegExp = /Open audience and presenter/) {
  const pages: Page[] = [];
  context.on('page', (page) => pages.push(page));
  await opener.getByRole('button', { name: button }).click();
  await opener.waitForTimeout(2000);
  await Promise.all(pages.map((p) => p.waitForLoadState('domcontentloaded').catch(() => undefined)));
  const byRole = (name: string) => pages.find((p) => p.url().includes(name));
  return { pages, audience: byRole('audience.html'), presenter: byRole('presenter.html') };
}

const openBoth = openWindows;

test.describe('SP-1 two-window show', () => {
  test('one click opens the audience and presenter windows (popup blocker off)', async ({ context }, info) => {
    test.skip(isBlockerProject(info), 'covered by the blocker tests');
    const opener = await startOpener(context);
    const { pages, audience, presenter } = await openBoth(context, opener);

    record(info, 'windowsOpenedFromOneClick', pages.length);
    expect(audience).toBeDefined();
    expect(presenter).toBeDefined();
    const reported = await opener.evaluate(() => window.__sp1.results.openBoth);
    record(info, 'openerReport', reported);
    expect(reported).toMatchObject({ audience: 'opened', presenter: 'opened' });
  });

  test('real popup blocker: what happens when one click asks for two windows', async ({ context }, info) => {
    test.skip(!isBlockerProject(info), 'needs the browser popup blocker switched on');
    const opener = await startOpener(context);
    const { pages } = await openBoth(context, opener);
    const reported = await opener.evaluate(() => window.__sp1.results.openBoth);
    record(info, 'blocker: two windows from one click', { windows: pages.length, openerReport: reported });

    // One window per click, as the fallback design (audience popup, presenter in this tab) would need.
    const opener2 = await startOpener(context);
    const before = context.pages().length;
    await opener2.getByRole('button', { name: 'Open audience only' }).click();
    await opener2.waitForTimeout(1500);
    const reported2 = await opener2.evaluate(() => window.__sp1.results.openAudienceOnly);
    record(info, 'blocker: one window from one click', {
      newWindows: context.pages().length - before,
      openerReport: reported2,
    });

    // Two clicks, one window each: the second click is a fresh user gesture.
    const opener3 = await startOpener(context);
    const { pages: twoClicks } = await openWindows(context, opener3, /Open audience only/);
    await opener3.getByRole('button', { name: 'Open presenter only' }).click();
    await opener3.waitForTimeout(1500);
    const second = await opener3.evaluate(() => window.__sp1.results.openPresenterOnly);
    record(info, 'blocker: two separate clicks', { firstClickWindows: twoClicks.length, secondClickReport: second });
  });

  test('real popup blocker, site allowed by the user ("always allow pop-ups"): one click opens both', async ({ playwright }, info) => {
    test.skip(!['chrome-blocker', 'edge-blocker'].includes(info.project.name), 'needs a real Chrome or Edge profile');
    const profile = mkdtempSync(join(tmpdir(), 'sp1-profile-'));
    mkdirSync(join(profile, 'Default'), { recursive: true });
    // The setting Chrome and Edge store when the user picks "Always allow pop-ups" for a site.
    const exceptions = { [`${ORIGIN},*`]: { setting: 1 } };
    writeFileSync(
      join(profile, 'Default', 'Preferences'),
      JSON.stringify({ profile: { content_settings: { exceptions: { popups: exceptions } } } }),
    );
    const context = await playwright.chromium.launchPersistentContext(profile, {
      channel: info.project.name.startsWith('edge') ? 'msedge' : 'chrome',
      ignoreDefaultArgs: ['--disable-popup-blocking'],
      baseURL: ORIGIN,
    });
    try {
      const opener = await context.newPage();
      await opener.goto('/index.html');
      const { pages } = await openBoth(context, opener);
      const reported = await opener.evaluate(() => window.__sp1.results.openBoth);
      record(info, 'blocker, site allowed: two windows from one click', { windows: pages.length - 0, openerReport: reported });
      expect(reported).toMatchObject({ audience: 'opened', presenter: 'opened' });
    } finally {
      await context.close();
      rmSync(profile, { recursive: true, force: true });
    }
  });

  for (const mechanism of ['broadcast', 'storage'] as const) {
    test(`sync latency, ${mechanism} channel: 200 steps, 10 ms apart`, async ({ context }, info) => {
      test.skip(isBlockerProject(info), 'latency is measured with the blocker off');
      const opener = await startOpener(context, mechanism === 'storage' ? '?mech=storage' : '');
      const { audience, presenter } = await openBoth(context, opener);
      expect(audience && presenter).toBeTruthy();
      if (!audience || !presenter) return;

      const result = await presenter.evaluate(() => window.__runLatency(200, 10));
      const oneWay = await audience.evaluate(() => window.__sp1.oneWay);
      const handled = summarise(oneWay.map((r: { handled: number }) => r.handled));
      const painted = summarise(
        oneWay.filter((r: { painted: number | null }) => r.painted !== null).map((r: { painted: number }) => r.painted),
      );
      record(info, `latency ${mechanism}`, {
        sent: result.sent,
        acknowledged: result.acknowledged,
        roundTripMs: result.rtt,
        oneWayHandledMs: handled,
        oneWayPaintedMs: painted,
      });

      expect(result.acknowledged).toBe(result.sent);
      expect(result.rtt.p95).toBeLessThan(100);
      expect(painted.p95 ?? 0).toBeLessThan(100);
    });
  }

  test('burst: 200 steps with no gap arrive complete and in order (broadcast)', async ({ context }, info) => {
    test.skip(isBlockerProject(info), 'blocker off');
    const opener = await startOpener(context);
    const { audience, presenter } = await openBoth(context, opener);
    if (!audience || !presenter) throw new Error('windows did not open');

    const result = await presenter.evaluate(() => window.__runLatency(200, 0));
    const finalAudience = await audience.evaluate(() => window.__sp1.state);
    const finalPresenter = await presenter.evaluate(() => window.__sp1.state);
    record(info, 'burst 200 no gap', { sent: result.sent, acknowledged: result.acknowledged, rtt: result.rtt, finalAudience, finalPresenter });
    expect(finalAudience.step).toBe(finalPresenter.step);
  });

  test('either window can drive, and the other follows', async ({ context }, info) => {
    test.skip(isBlockerProject(info), 'blocker off');
    const opener = await startOpener(context);
    const { audience, presenter } = await openBoth(context, opener);
    if (!audience || !presenter) throw new Error('windows did not open');

    await audience.keyboard.press('ArrowRight');
    await expect(presenter.locator('#now')).toContainText('click 1');
    await presenter.getByRole('button', { name: 'Next click' }).click();
    await expect(audience.locator('#now')).toContainText('click 2');
    record(info, 'either window can drive', true);
  });

  for (const how of ['playwright', 'script'] as const) {
  test(`closing the audience window (${how === 'playwright' ? 'closed by Playwright' : 'window.close() in the page'}): the presenter notices and carries on; reconnecting catches up`, async ({ context }, info) => {
    test.skip(isBlockerProject(info), 'blocker off');
    const label = how === 'playwright' ? 'close' : 'script close';
    const opener = await startOpener(context);
    const { audience, presenter } = await openBoth(context, opener);
    if (!audience || !presenter) throw new Error('windows did not open');
    await presenter.evaluate(() => window.__drive({ step: 7 }));
    await presenter.waitForTimeout(500);

    const closedAt = Date.now();
    if (how === 'playwright') await audience.close({ runBeforeUnload: true });
    else await audience.evaluate(() => window.close()).catch(() => undefined);

    // Three independent ways to notice a closed window; record each one's result and delay.
    const heardGoodbye = await presenter
      .waitForFunction(() => window.__sp1.gone.length > 0, undefined, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    record(info, `${label}: goodbye message (sent while the page unloads)`, { received: heardGoodbye, afterMs: Date.now() - closedAt });

    const lockSupported = await presenter.evaluate(() => window.__sp1.locks.supported);
    const lockReleased = await presenter
      .waitForFunction(() => window.__sp1.locks.released.length > 0, undefined, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    const lockDelay = lockReleased
      ? await presenter.evaluate((t) => window.__sp1.locks.released[0].at - t, closedAt)
      : null;
    record(info, `${label}: Web Lock released by the dead window`, { supported: lockSupported, released: lockReleased, afterMs: lockDelay === null ? null : Math.round(lockDelay) });

    const openerSeesClosed = await opener
      .waitForFunction(() => window.__sp1.audienceWin.closed === true, undefined, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    record(info, `${label}: opener sees window.closed`, openerSeesClosed);

    // The presenter keeps working.
    await presenter.evaluate(() => window.__drive({ step: 8 }));
    await expect(presenter.locator('#now')).toContainText('click 8');
    record(info, `${label}: presenter keeps working`, true);

    // Reconnect: a new audience window must show the current state without anyone pressing anything.
    const popup = context.waitForEvent('page', { timeout: 5000 }).catch(() => undefined);
    await presenter.getByRole('button', { name: 'Reconnect audience' }).click();
    const reopened = await popup;
    const windowOpenResult = await presenter.evaluate(() => window.__sp1.reconnect);
    let caughtUp = false;
    if (reopened) {
      await reopened.waitForLoadState('domcontentloaded');
      caughtUp = await reopened
        .waitForFunction(() => document.getElementById('now')?.textContent?.includes('click 8'), undefined, { timeout: 3000 })
        .then(() => true)
        .catch(() => false);
    }
    record(info, `${label} then reconnect: window.open result and catch-up`, { windowAppeared: Boolean(reopened), windowOpenResult, caughtUpToCurrentClick: caughtUp });
    expect.soft(caughtUp).toBe(true);
  });
  }

  test('ending the show from either window closes both', async ({ context }, info) => {
    test.skip(isBlockerProject(info), 'blocker off');
    for (const from of ['presenter', 'audience'] as const) {
      const opener = await startOpener(context);
      const { audience, presenter } = await openBoth(context, opener);
      if (!audience || !presenter) throw new Error('windows did not open');

      if (from === 'presenter') await presenter.getByRole('button', { name: 'End show' }).click();
      else await audience.evaluate(() => window.__endShow());

      await opener.waitForTimeout(1500);
      record(info, `end show from ${from}`, { audienceClosed: audience.isClosed(), presenterClosed: presenter.isClosed() });
      expect.soft(audience.isClosed() && presenter.isClosed()).toBe(true);
    }
  });

  test('a blocked second window is detected and can be reported', async ({ context }, info) => {
    test.skip(isBlockerProject(info), 'simulated here; the real blocker has its own test');
    const opener = await context.newPage();
    // Simulate a blocker: the first call works, the second returns null as browsers do.
    await opener.addInitScript(() => {
      const real = window.open.bind(window);
      let calls = 0;
      window.open = (...args: Parameters<typeof window.open>) => (++calls === 2 ? null : real(...args));
    });
    await opener.goto('/index.html');
    await opener.getByRole('button', { name: /Open audience and presenter/ }).click();
    await opener.waitForTimeout(1000);
    const reported = await opener.evaluate(() => window.__sp1.results.openBoth);
    record(info, 'simulated block of the second window', reported);
    expect(reported).toMatchObject({ audience: 'opened', presenter: 'blocked' });
  });

  test('fullscreen and screen detection: what each browser allows', async ({ context }, info) => {
    test.skip(isBlockerProject(info), 'blocker off');
    if (/chrom|edge/.test(info.project.name)) await context.grantPermissions(['window-management']).catch(() => undefined);
    const opener = await startOpener(context);
    const { audience } = await openBoth(context, opener);
    if (!audience) throw new Error('audience did not open');

    const onLoad = await audience.evaluate(() => window.__sp1.fullscreen.onLoad ?? 'no result');
    await audience.locator('body').click();
    await audience.waitForTimeout(500);
    const afterClick = await audience.evaluate(() => window.__sp1.fullscreen.afterGestureInThisWindow ?? 'no result');

    await opener.getByRole('button', { name: /fullscreen on the audience window from here/ }).click();
    await opener.waitForTimeout(500);
    const fromOpener = await opener.evaluate(() => window.__sp1.results.fullscreenAudienceFromOpener ?? 'no result');

    await opener.getByRole('button', { name: 'Detect screens' }).click();
    await opener.waitForTimeout(800);
    const screens = await opener.evaluate(() => window.__sp1.results.screens ?? 'no result');

    record(info, 'fullscreen', { onLoadWithNoGesture: onLoad, afterClickInAudienceWindow: afterClick, fromOpenerWindowClick: fromOpener });
    record(info, 'screen detection', screens);
  });

  // Needs real, visible windows: run with SP1_OCCLUSION=1 and --headed. A covered window can be
  // treated as hidden by the browser, which pauses painting and slows timers.
  test('occlusion: audience window fully covered by the presenter window', async ({ playwright }, info) => {
    test.skip(!process.env.SP1_OCCLUSION, 'run with SP1_OCCLUSION=1 and --headed');
    test.skip(!['chrome', 'edge'].includes(info.project.name), 'uses a real Chrome or Edge profile');
    // Playwright starts Chromium with flags that switch off occlusion detection and background
    // throttling. Remove them so the browser behaves as it does for a real user.
    const profile = mkdtempSync(join(tmpdir(), 'sp1-occlusion-'));
    const context = await playwright.chromium.launchPersistentContext(profile, {
      channel: info.project.name === 'edge' ? 'msedge' : 'chrome',
      headless: false,
      baseURL: ORIGIN,
      ignoreDefaultArgs: [
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
      ],
    });
    try {
    const opener = await startOpener(context);
    const { audience, presenter } = await openWindows(context, opener, /presenter covering the audience/);
    if (!audience || !presenter) throw new Error('windows did not open');
    await presenter.bringToFront();
    await presenter.waitForTimeout(1500);

    const rect = () => ({ x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight, focused: document.hasFocus() });
    const audienceRect = await audience.evaluate(rect);
    const presenterRect = await presenter.evaluate(rect);
    const visibility = await audience.evaluate(() => document.visibilityState);
    const frames = await audience.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let n = 0;
          const start = performance.now();
          const tick = () => {
            n += 1;
            if (performance.now() - start >= 1000) resolve(n);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          setTimeout(() => resolve(n), 3500);
        }),
    );
    const result = await presenter.evaluate(() => window.__runLatency(100, 20));
    const oneWay = await audience.evaluate(() => window.__sp1.oneWay);
    const audienceState = await audience.evaluate(() => window.__sp1.state);
    const presenterState = await presenter.evaluate(() => window.__sp1.state);
    record(info, 'occlusion: covered audience window', {
      audienceRect,
      presenterRect,
      audienceVisibility: visibility,
      animationFramesInOneSecond: frames,
      acknowledgedOf100: result.acknowledged,
      handledMs: summarise(oneWay.map((r: { handled: number }) => r.handled)),
      paintedMs: summarise(oneWay.filter((r: { painted: number | null }) => r.painted !== null).map((r: { painted: number }) => r.painted)),
      audienceStateMatchesPresenter: audienceState.step === presenterState.step,
    });
    } finally {
      await context.close();
      rmSync(profile, { recursive: true, force: true });
    }
  });
});

declare global {
  interface Window {
    __sp1: Record<string, any>;
    __runLatency: (count: number, gapMs: number) => Promise<{ sent: number; acknowledged: number; rtt: Record<string, number | null> }>;
    __drive: (patch: Record<string, unknown>) => unknown;
    __endShow: () => void;
  }
}
