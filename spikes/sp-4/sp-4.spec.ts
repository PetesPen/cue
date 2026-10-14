// SP-4 spike tests (throwaway). Motion: 50 animated elements, full-slide transitions, stepping back.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import fc from 'fast-check';
import { diff, makeSlide, resolve } from './engine.js';

const RESULTS_DIR = join(import.meta.dirname, 'results');

function record(info: TestInfo, key: string, value: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(join(RESULTS_DIR, `${info.project.name}.jsonl`), `${JSON.stringify({ key, value })}\n`);
}

type Intervals = { frames: number; averageFps?: number; p50?: number; p95?: number; p99?: number; max?: number; framesOver25ms?: number };
type Result = { name: string; frameIntervals: Intervals; elementsWithWrongEndState: number; setupMsMax: number };
type RunOptions = { ms?: number; repeat?: number; heavy?: boolean; prepare?: boolean };
declare global {
  interface Window {
    __sp4: { run: (name: string, options?: RunOptions) => Promise<Result> };
  }
}

const runScenario = (page: Page, name: string, options: RunOptions = {}) => page.evaluate(([n, o]) => window.__sp4.run(n, o), [name, options] as const);

/** Chromium only: how many animation frames were really presented, partly presented or dropped. */
async function withTrace<T>(browser: Browser, page: Page, work: () => Promise<T>) {
  await browser.startTracing(page, { categories: ['-*', 'benchmark', 'cc', 'viz', 'toplevel', 'disabled-by-default-devtools.timeline.frame'] });
  const value = await work();
  const buffer = await browser.stopTracing();
  const events: { name: string; ph: string; args?: { frame_reporter?: Record<string, unknown> } }[] = JSON.parse(buffer.toString('utf8')).traceEvents;
  const reports = events.filter((e) => e.name === 'PipelineReporter' && e.ph === 'b').map((e) => e.args?.frame_reporter ?? {});
  const animating = reports.filter((r) => r['has_compositor_animation'] === true || r['has_main_animation'] === true);
  const byState: Record<string, number> = {};
  for (const r of animating) byState[String(r['state'])] = (byState[String(r['state'])] ?? 0) + 1;
  const dropped = byState['STATE_DROPPED'] ?? 0;
  const presented = (byState['STATE_PRESENTED_ALL'] ?? 0) + (byState['STATE_PRESENTED_PARTIAL'] ?? 0);
  return { value, trace: { animationFrames: animating.length, presented, dropped, droppedShare: animating.length ? Math.round((dropped / animating.length) * 1000) / 10 : null, byState } };
}

const scenarios = ['elements50-transform', 'transition-fade', 'transition-push', 'transition-zoom', 'step-back'];

test.describe('SP-4 motion', () => {
  // ---- the pure part: no browser needed ----------------------------------------------------------
  test('the resolver: states at each click, and stepping back, are pure', async ({}, info) => {
    const slide = makeSlide(50, 7);
    const at = (n: number) => resolve(slide, n);
    const visible = (n: number) => new Set(Object.values(at(n)).map((s) => (s as { opacity: number }).opacity > 0));

    expect(visible(0)).toEqual(new Set([false])); // nothing visible before the first click
    expect(visible(1)).toEqual(new Set([true])); // everything in after the first
    expect(visible(3)).toEqual(new Set([false])); // everything out after the last

    // Any jump between clicks, forwards or back, ends in exactly the state the resolver gives.
    let jumps = 0;
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 12 }), (targets) => {
        const live: Record<string, unknown> = { ...at(0) };
        let current = 0;
        for (const target of targets) {
          for (const id of diff(slide, current, target)) live[id] = at(target)[id]; // replay only what changed
          current = target;
          jumps += 1;
        }
        expect(live).toEqual(at(current));
      }),
      { numRuns: 500 },
    );
    for (const k of [1, 2, 3]) expect(diff(slide, k, k)).toEqual([]);
    record(info, 'resolver: random click jumps checked against the pure function', { runs: 500, jumps, sequencesPassed: true });
  });

  // ---- in the browser: normal slide and a heavy one -----------------------------------------------
  for (const heavy of [false, true]) {
    for (const name of scenarios) {
      test(`${heavy ? 'heavy slide, ' : ''}${name}: frame cadence and end state`, async ({ page, browser, browserName }, info) => {
        test.setTimeout(180_000);
        await page.goto('/index.html');
        const label = `${heavy ? 'heavy ' : ''}${name}`;
        let result: Result;
        let trace: unknown = 'not available (Chromium only)';
        if (browserName === 'chromium') {
          const traced = await withTrace(browser, page, () => runScenario(page, name, { heavy }));
          result = traced.value;
          trace = traced.trace;
        } else {
          result = await runScenario(page, name, { heavy });
        }
        record(info, label, { frameIntervalsMs: result.frameIntervals, elementsWithWrongEndState: result.elementsWithWrongEndState, setupMsMax: result.setupMsMax, presentedFramesTrace: trace });
        expect(result.elementsWithWrongEndState, 'every animation ends in the resolver state').toBe(0);
        expect(result.frameIntervals.frames).toBeGreaterThan(30);
        // The 60 fps budget: no sustained jank.
        expect.soft(result.frameIntervals.p95 ?? 99, 'p95 frame interval').toBeLessThanOrEqual(20);
        expect.soft((result.frameIntervals.framesOver25ms ?? 0) / result.frameIntervals.frames, 'share of late frames').toBeLessThanOrEqual(0.05);
      });
    }
  }

  // Heavy transitions dropped a few frames. Does promoting both slides to their own layers first help?
  test('heavy transitions, with and without preparing the layers first', async ({ page, browser, browserName }, info) => {
    test.setTimeout(300_000);
    await page.goto('/index.html');
    for (const name of ['transition-fade', 'transition-push', 'transition-zoom']) {
      for (const prepare of [false, true]) {
        let result: Result;
        let trace: unknown = 'not available (Chromium only)';
        if (browserName === 'chromium') {
          const traced = await withTrace(browser, page, () => runScenario(page, name, { heavy: true, prepare, repeat: 5 }));
          result = traced.value;
          trace = traced.trace;
        } else {
          result = await runScenario(page, name, { heavy: true, prepare, repeat: 5 });
        }
        record(info, `heavy ${name}, layers prepared first: ${prepare}`, { frameIntervalsMs: result.frameIntervals, presentedFramesTrace: trace });
      }
    }
  });

  test('contrast: the same 50 elements moved with left and top instead of transform', async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.goto('/index.html');
    for (const heavy of [false, true]) {
      const result = await runScenario(page, 'elements50-layout', { heavy });
      record(info, `${heavy ? 'heavy ' : ''}elements50-layout (contrast)`, { frameIntervalsMs: result.frameIntervals, elementsWithWrongEndState: result.elementsWithWrongEndState, setupMsMax: result.setupMsMax });
      expect(result.elementsWithWrongEndState).toBe(0);
    }
  });

  // ---- a slower computer: Chromium can slow the page's thread down ------------------------------------
  for (const rate of [4, 6]) {
    test(`Chromium with the CPU slowed ${rate}x (heavy slide)`, async ({ page, context, browserName }, info) => {
      test.skip(browserName !== 'chromium', 'CPU throttling is a Chromium feature');
      test.setTimeout(300_000);
      await page.goto('/index.html');
      const client = await context.newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate });
      for (const name of ['elements50-transform', 'elements50-layout', 'transition-push']) {
        const result = await runScenario(page, name, { heavy: true });
        record(info, `cpu ${rate}x slower, heavy: ${name}`, { frameIntervalsMs: result.frameIntervals, setupMsMax: result.setupMsMax, wrongEndState: result.elementsWithWrongEndState });
      }
      await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    });
  }
});
