import { expect, test } from '@playwright/test';
import { FOREST, GREEN, MINT, SAGE, YELLOW, openSeededDeck } from './support';

// The first screenshot tests (sprint 2): how shapes are drawn, how opacity fades a whole element, and
// how a selection looks. They run only in the pinned container, and the reference images are made by
// the "Update screenshots" workflow and reviewed by Peter (decision 13). Each test uses a small deck
// written straight into the browser's database, so nothing depends on clicking.

interface ShapeSeed {
  readonly id: string;
  readonly shape: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation?: number;
  readonly opacity?: number;
  readonly fill?: string;
  readonly border?: { color: string; width: number; dash: string };
  readonly cornerRadius?: number;
}

function shape(seed: ShapeSeed) {
  return {
    kind: 'shape',
    rotation: 0,
    opacity: 1,
    fill: MINT,
    border: { color: FOREST, width: 0, dash: 'solid' },
    cornerRadius: 0,
    ...seed,
  };
}

test.describe('Given shapes on a slide', () => {
  test('When all six shapes and their border styles are drawn, Then the slide looks like all-shapes.png', async ({
    page,
  }) => {
    await openSeededDeck(page, [
      shape({
        id: 'a',
        shape: 'rectangle',
        x: 120,
        y: 120,
        width: 480,
        height: 300,
        border: { color: FOREST, width: 10, dash: 'solid' },
      }),
      shape({
        id: 'b',
        shape: 'roundedRectangle',
        x: 720,
        y: 120,
        width: 480,
        height: 300,
        fill: YELLOW,
        cornerRadius: 90,
        border: { color: FOREST, width: 10, dash: 'dashed' },
      }),
      shape({ id: 'c', shape: 'ellipse', x: 1320, y: 120, width: 480, height: 300, fill: GREEN }),
      shape({
        id: 'd',
        shape: 'triangle',
        x: 120,
        y: 600,
        width: 480,
        height: 360,
        fill: SAGE,
        border: { color: FOREST, width: 12, dash: 'dotted' },
      }),
      shape({
        id: 'e',
        shape: 'line',
        x: 720,
        y: 780,
        width: 480,
        height: 0,
        rotation: -20,
        fill: 'none',
        border: { color: FOREST, width: 12, dash: 'solid' },
      }),
      shape({
        id: 'f',
        shape: 'arrow',
        x: 1320,
        y: 780,
        width: 480,
        height: 0,
        rotation: 15,
        fill: 'none',
        border: { color: GREEN, width: 14, dash: 'solid' },
      }),
    ]);

    await expect(page.getByRole('group', { name: /^Slide 1 of/ })).toHaveScreenshot(
      'all-shapes.png',
    );
  });

  test('When one shape is faded to three levels over a coloured block, Then the whole shape fades, border included (opacity.png)', async ({
    page,
  }) => {
    const bordered = {
      shape: 'rectangle',
      width: 520,
      height: 360,
      border: { color: FOREST, width: 24, dash: 'solid' },
    };
    await openSeededDeck(page, [
      shape({
        id: 'backdrop',
        shape: 'rectangle',
        x: 80,
        y: 340,
        width: 1760,
        height: 400,
        fill: YELLOW,
      }),
      shape({ id: 'full', x: 140, y: 180, opacity: 1, ...bordered }),
      shape({ id: 'sixty', x: 700, y: 180, opacity: 0.6, ...bordered }),
      shape({ id: 'thirty', x: 1260, y: 180, opacity: 0.3, ...bordered }),
    ]);

    await expect(page.getByRole('group', { name: /^Slide 1 of/ })).toHaveScreenshot('opacity.png');
  });

  test('When a turned shape is selected, Then its outline, handles, turning handle and chip look like selection.png', async ({
    page,
  }) => {
    await openSeededDeck(page, [
      shape({
        id: 'turned',
        shape: 'rectangle',
        x: 620,
        y: 380,
        width: 680,
        height: 320,
        rotation: 20,
        opacity: 0.8,
        border: { color: FOREST, width: 8, dash: 'solid' },
      }),
    ]);
    const frame = page.getByRole('group', { name: /^Slide 1 of/ });
    await frame.focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('.sel-chip')).toHaveText('Rectangle · 80%');

    await expect(page.getByRole('main', { name: 'Canvas' })).toHaveScreenshot('selection.png');
  });
});
