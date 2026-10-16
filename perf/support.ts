import type { Browser, Page, TestInfo } from '@playwright/test';
import { seedDeck } from '../e2e/support/seed';

// Helpers for the performance suite (UX-3). The method follows spike SP-4 (docs/spikes/SP-4.md): the
// page's own frame gaps say what JavaScript can see, and in Chromium a trace says how many frames the
// browser really presented or dropped, which the gaps alone cannot.

export interface FrameStats {
  readonly frames: number;
  readonly averageFps: number;
  readonly p95GapMs: number;
  readonly maxGapMs: number;
  /** The share of frames that took more than 25 ms: later than one frame and a half at 60 Hz. */
  readonly lateShare: number;
}

declare global {
  interface Window {
    __frames?: { gaps: number[]; last: number; running: boolean };
    __keys?: number[];
  }
}

/** Start recording the gap between animation frames in the page. */
export async function startFrameMeter(page: Page): Promise<void> {
  await page.evaluate(() => {
    const meter = { gaps: [] as number[], last: performance.now(), running: true };
    window.__frames = meter;
    const tick = (now: number) => {
      if (!meter.running) return;
      meter.gaps.push(now - meter.last);
      meter.last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function stopFrameMeter(page: Page): Promise<FrameStats> {
  const gaps = await page.evaluate(() => {
    const meter = window.__frames;
    if (meter) meter.running = false;
    // The first gap includes the time before the meter had a frame to wait for.
    return (meter?.gaps ?? []).slice(1);
  });
  const sorted = [...gaps].sort((a, b) => a - b);
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  const at = (share: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;
  return {
    frames: gaps.length,
    averageFps: total === 0 ? 0 : Math.round((gaps.length / total) * 1000 * 10) / 10,
    p95GapMs: Math.round(at(0.95) * 10) / 10,
    maxGapMs: Math.round((sorted[sorted.length - 1] ?? 0) * 10) / 10,
    lateShare: gaps.length === 0 ? 0 : gaps.filter((gap) => gap > 25).length / gaps.length,
  };
}

export interface TraceStats {
  readonly frames: number;
  readonly dropped: number;
  readonly droppedShare: number;
}

interface TraceEvent {
  readonly name: string;
  readonly ph: string;
  readonly args?: { readonly frame_reporter?: { readonly state?: unknown } };
}

function isTraceEvent(value: unknown): value is TraceEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'ph' in value &&
    typeof value.ph === 'string'
  );
}

function traceEventsOf(value: unknown): TraceEvent[] {
  if (typeof value !== 'object' || value === null || !('traceEvents' in value)) return [];
  const raw: unknown = value.traceEvents;
  return Array.isArray(raw) ? raw.filter(isTraceEvent) : [];
}

/**
 * Chromium only: run `work` while tracing, then count how many frames the browser presented and how
 * many it dropped (its own PipelineReporter events). Returns undefined on other engines.
 */
export async function withFrameTrace<T>(
  browser: Browser | null,
  page: Page,
  work: () => Promise<T>,
): Promise<{ readonly value: T; readonly trace: TraceStats | undefined }> {
  const traceable = browser?.browserType().name() === 'chromium';
  if (!browser || !traceable) return { value: await work(), trace: undefined };
  await browser.startTracing(page, {
    categories: [
      '-*',
      'benchmark',
      'cc',
      'viz',
      'toplevel',
      'disabled-by-default-devtools.timeline.frame',
    ],
  });
  const value = await work();
  const buffer = await browser.stopTracing();
  const events = traceEventsOf(JSON.parse(buffer.toString('utf8')));
  const states = events
    .filter((event) => event.name === 'PipelineReporter' && event.ph === 'b')
    .map((event) => String(event.args?.frame_reporter?.state));
  const frames = states.filter(
    (state) => state.startsWith('STATE_PRESENTED') || state === 'STATE_DROPPED',
  );
  const dropped = frames.filter((state) => state === 'STATE_DROPPED').length;
  return {
    value,
    trace: {
      frames: frames.length,
      dropped,
      droppedShare: frames.length === 0 ? 0 : dropped / frames.length,
    },
  };
}

/** Put a deck in the browser's database, open it, and wait until its first slide is drawn with its fonts. */
export async function openDeck(page: Page, deck: object, id: string): Promise<void> {
  await seedDeck(page, deck, id);
  await page.waitForSelector('.canvas .cue-slide');
  await page.waitForFunction(() => document.querySelector('[data-fonts="loading"]') === null);
}

/** Print what a test measured, so a nightly log shows the numbers whether or not they passed. */
export function report(info: TestInfo, name: string, numbers: Record<string, unknown>): void {
  const line = `[perf] ${info.project.name} ${name} ${JSON.stringify(numbers)}`;
  console.log(line);
  info.annotations.push({ type: 'perf', description: line });
}

/** Engines held to the budgets. WebKit's numbers are printed and watched, not failed (SP-4). */
export const enforced = (info: TestInfo): boolean => info.project.name !== 'webkit';

/**
 * Reload the open deck and return how long it took, from the start of the page to the first slide
 * drawn with its fonts and the first thumbnails in the rail. A cold run is noisy, so it is the
 * middle one of three.
 */
export async function reloadAndMeasure(page: Page): Promise<number> {
  const times: number[] = [];
  for (let run = 0; run < 3; run++) {
    await page.reload();
    await page.waitForFunction(
      () =>
        document.querySelector('.canvas .cue-slide') !== null &&
        document.querySelector('[data-fonts="loading"]') === null &&
        document.querySelectorAll('.rail-item .cue-slide').length >= 7,
    );
    times.push(await page.evaluate(() => Math.round(performance.now())));
  }
  times.sort((a, b) => a - b);
  return times[1] ?? 0;
}
