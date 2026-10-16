import { expect, test, type Page } from '@playwright/test';
import { autumnLaunch, transition, type Json } from '../tests/fixtures/autumnLaunch';
import { fiftyHeavySlidesDeck } from '../tests/fixtures/heavyDeck';
import {
  enforced,
  openDeck,
  report,
  startFrameMeter,
  stopFrameMeter,
  withFrameTrace,
} from './support';

// TN-5, transitions play smoothly (sprint 7): the four transitions between slides of the fixture deck,
// and between slides of 50 elements each. A show in one window is measured (the same stage as the
// audience window and the presenter view draw with). The method follows spike SP-4 and the budgets are
// in `config/budgets.json`: on the nightly runner (no graphics card) Chromium and Firefox are held to
// a share of late frames; 60 fps itself is confirmed by hand on a real laptop and a Mac.

import budgets from '../config/budgets.json' with { type: 'json' };

const { perf } = budgets;

const KINDS = ['fade', 'slide', 'push', 'zoom'] as const;
type Kind = (typeof KINDS)[number];

/** The deck with `kind` as the transition into every slide. */
function withTransitions(deck: Json, kind: Kind, slides = 6): Json {
  const { slides: all } = deck;
  if (!Array.isArray(all)) throw new Error('A deck has slides');
  return {
    ...deck,
    slides: all.slice(0, slides).map((slide: Json) => ({ ...slide, transition: transition(kind) })),
  };
}

/** Open a show of the deck in this window, on its first slide, with everything drawn. */
async function startShow(page: Page, deck: Json, id: string) {
  await openDeck(page, deck, id);
  await page.evaluate((deckId) => {
    window.location.hash = `#/show/${deckId}/single`;
  }, id);
  await page.waitForSelector('.audience .cue-slide');
  await page.waitForFunction(() => document.querySelector('[data-fonts="loading"]') === null);
}

/** Step forward `times` slides, a transition each; returns the frames seen while they played. */
async function playTransitions(
  page: Page,
  browser: Parameters<typeof withFrameTrace>[0],
  times: number,
) {
  let frames = 0;
  let late = 0;
  let worst = 0;
  const { trace } = await withFrameTrace(browser, page, async () => {
    for (let i = 0; i < times; i++) {
      await startFrameMeter(page);
      await page.keyboard.press('ArrowRight');
      // The transition takes 0.6 s; the frames after it are not part of it.
      await page.waitForTimeout(700);
      const stats = await stopFrameMeter(page);
      frames += stats.frames;
      late += Math.round(stats.lateShare * stats.frames);
      worst = Math.max(worst, stats.maxGapMs);
      await expect(page.locator('.audience .cue-layer')).toHaveCount(1);
    }
  });
  return { frames, lateShare: frames === 0 ? 0 : late / frames, worstGapMs: worst, trace };
}

for (const kind of KINDS) {
  test(`Given slides of the fixture deck, When ${kind} plays between them, Then the frames stay on time`, async ({
    page,
    browser,
  }, info) => {
    await startShow(page, withTransitions(autumnLaunch(), kind), 'autumn-launch');

    const result = await playTransitions(page, browser, 5);

    report(info, `transition ${kind}`, result);
    expect(result.frames).toBeGreaterThan(0);
    if (!enforced(info)) return;
    expect(result.lateShare).toBeLessThanOrEqual(perf.lateFrameShare);
    if (result.trace) expect(result.trace.droppedShare).toBeLessThanOrEqual(perf.droppedFrameShare);
  });

  test(`Given slides of 50 elements, When ${kind} plays between them, Then the frames stay within the budget for the busiest slides`, async ({
    page,
    browser,
  }, info) => {
    await startShow(page, withTransitions(fiftyHeavySlidesDeck(), kind), 'fifty-heavy-slides');

    const result = await playTransitions(page, browser, 4);

    report(info, `heavy transition ${kind}`, result);
    expect(result.frames).toBeGreaterThan(0);
    if (!enforced(info)) return;
    // The busiest slides have their own budgets (SP-4 found a zoom the most costly, since it changes the
    // size of a whole slide as it moves).
    const limit =
      kind === 'zoom' ? perf.heavyZoomLateFrameShare : perf.heavyTransitionLateFrameShare;
    expect(result.lateShare).toBeLessThanOrEqual(limit);
  });
}
