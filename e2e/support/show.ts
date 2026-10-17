import { expect, type Locator, type Page } from '@playwright/test';
import { autumnLaunch } from '../../tests/fixtures/autumnLaunch';
import { seedDeck } from './seed';

// Helpers for the tests of the show windows (sprints 7 and 8): open the fixture deck, start a show and
// take the audience window it opens, and look at what a window is drawing.

export const DECK = 'autumn-launch';

/** The slides a window is drawing: two while a transition plays. */
export const shown = (page: Page): Locator => page.locator('.show-stage .cue-layer .cue-slide');

/** A window that shows slide `id` and nothing else: it has arrived, no transition is playing. */
export const settled = (page: Page, id: string): Locator =>
  page.locator(
    `.show-stage .cue-stage:not(:has(.cue-layer + .cue-layer)) .cue-slide[data-slide-id="${id}"]`,
  );

export const opacityOf = (page: Page, element: string) =>
  page
    .locator(`.show-stage [data-element-id="${element}"]`)
    .evaluate((node) => Number(getComputedStyle(node).opacity));

export async function openDeck(page: Page) {
  await seedDeck(page, autumnLaunch(), DECK);
}

/** Press Present (from the beginning, or from the slide being edited) and take the audience window. */
export async function present(page: Page, from: 'start' | 'current' = 'start'): Promise<Page> {
  const opened = page.waitForEvent('popup');
  if (from === 'start') {
    await page.getByRole('button', { name: 'Present', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Ways to present' }).click();
    await page.getByRole('menuitem', { name: 'Present from this slide' }).click();
  }
  const audience = await opened;
  await audience.waitForLoadState();
  await expect(shown(audience)).toHaveCount(1);
  await expect(shown(page)).toHaveCount(1);
  return audience;
}
