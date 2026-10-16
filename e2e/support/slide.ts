import { expect, type Locator, type Page } from '@playwright/test';

// Helpers shared by the end-to-end specs that work on a slide with a real mouse. The window is a fixed
// size (set by each spec), so slide pixels map to screen pixels the same way in every browser.

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

export interface Slide {
  readonly frame: Locator;
  /** Slide pixels to page coordinates. */
  readonly at: (x: number, y: number) => Promise<{ x: number; y: number }>;
  /** How many screen pixels one slide pixel is. */
  readonly scale: () => Promise<number>;
}

/** Open the library, make a new deck, and return the first slide's frame. */
export async function openNewDeck(page: Page): Promise<Slide> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New deck' }).first().click();
  await expect(page.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  const frame = page.getByRole('group', { name: /^Slide 1 of/ });
  const box = async () => {
    const b = await frame.boundingBox();
    if (!b) throw new Error('the slide has no box');
    return b;
  };
  return {
    frame,
    at: async (x, y) => {
      const b = await box();
      return { x: b.x + (x / SLIDE_WIDTH) * b.width, y: b.y + (y / SLIDE_HEIGHT) * b.height };
    },
    scale: async () => (await box()).width / SLIDE_WIDTH,
  };
}

/** Press, move in steps and (unless told not to) release, between two slide points. */
export async function drag(
  page: Page,
  slide: Slide,
  from: readonly [number, number],
  to: readonly [number, number],
  options: { shift?: boolean; release?: boolean } = {},
) {
  const a = await slide.at(...from);
  const b = await slide.at(...to);
  if (options.shift) await page.keyboard.down('Shift');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  if (options.release !== false) await page.mouse.up();
  if (options.shift) await page.keyboard.up('Shift');
}
