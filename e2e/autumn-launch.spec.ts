import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { autumnLaunch } from '../tests/fixtures/autumnLaunch';
import { pictureFile, png } from './support/pictures';
import { seedDeck } from './support/seed';
import { drag, openNewDeck, type Slide } from './support/slide';

// Gate 2, "Editor alpha": can you build and save a real deck of text, shapes and images, with undo?
// The first test opens the fixture deck Autumn Launch (12 slides in the look of the design) and looks
// at every slide. The second REBUILDS the hero slide, "Our approach", through the interface, the way a
// person would, so what is awkward or missing shows up (the findings are in docs/sprint-log.md).

test.use({ viewport: { width: 1440, height: 900 } });

const frame = (page: Page) => page.getByRole('group', { name: /^Slide \d+ of/ });
const texts = (page: Page) => page.locator('.slide-frame [data-kind="text"] .cue-text');

test.describe('Given the fixture deck Autumn Launch', () => {
  test('When it is opened and every slide is visited, Then all 12 are drawn, with their words and notes, and no console errors', async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    await seedDeck(page, autumnLaunch(), 'autumn-launch');

    await expect(page.getByRole('option')).toHaveCount(12);
    await expect(page.getByText('Autumn Launch').first()).toBeVisible();
    const titles: string[] = [];
    for (let n = 1; n <= 12; n++) {
      await page.getByRole('option', { name: `Slide ${String(n)}`, exact: true }).click();
      await expect(frame(page)).toHaveAttribute('aria-label', `Slide ${String(n)} of 12`);
      await expect(page.locator('[data-fonts="loading"]')).toHaveCount(0);
      titles.push((await texts(page).first().innerText()).trim());
    }

    expect(titles.slice(0, 4)).toEqual([
      'Autumn Launch',
      'Why now',
      '03 — STRATEGY',
      'What we heard',
    ]);
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Speaker notes text' })).toHaveValue(
      /Open with the customer problem/,
    );
    expect(problems).toEqual([]);
  });

  test('When the hero slide is shown, Then the editor with it has no accessibility violations', async ({
    page,
  }) => {
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await expect(page.locator('[data-fonts="loading"]')).toHaveCount(0);

    // The slide's own words are the author's to colour, and the editor draws elements that start
    // hidden faded (AN-1): neither is the app's text.
    const results = await new AxeBuilder({ page }).exclude('.canvas .cue-slide').analyze();

    expect(results.violations).toEqual([]);
  });
});

// Rebuilding the hero slide by hand ---------------------------------------------------------------

/** Press T, click the slide, type, and finish: one line of text at a place, with its look. */
async function addText(
  page: Page,
  slide: Slide,
  at: readonly [number, number],
  words: string,
  look: { size: number; bold?: boolean; colour?: string },
) {
  await slide.frame.focus();
  await page.keyboard.press('t');
  await expect(page.getByRole('button', { name: 'Text', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const point = await slide.at(...at);
  await page.mouse.click(point.x, point.y);
  const editor = page.locator('.text-edit-box .ProseMirror');
  await expect(editor).toBeFocused();
  await page.keyboard.type(words);
  await page.keyboard.press('Control+a');
  const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
  const size = toolbar.getByRole('textbox', { name: 'Font size' });
  await size.fill(String(look.size));
  await page.keyboard.press('Enter');
  if (look.bold) await toolbar.getByRole('button', { name: 'Bold', exact: true }).click();
  if (look.colour) {
    await toolbar.getByRole('button', { name: 'Text colour' }).click();
    await page.getByRole('textbox', { name: 'Text colour hex code' }).fill(look.colour);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
}

async function drawShape(
  page: Page,
  slide: Slide,
  kind: string,
  from: readonly [number, number],
  to: readonly [number, number],
  fill?: string,
) {
  await page.getByRole('button', { name: 'Shape' }).click();
  await page.getByRole('menuitem', { name: kind, exact: true }).click();
  await drag(page, slide, from, to);
  if (fill) {
    await page.getByRole('button', { name: 'Choose fill' }).click();
    await page.getByRole('textbox', { name: 'Fill hex code' }).fill(fill);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
  }
}

test.describe('Given a blank deck, When the hero slide of Autumn Launch is rebuilt by hand (Gate 2)', () => {
  test('Then text in several sizes, shapes, a picture, notes, undo and a duplicate slide all work together', async ({
    page,
  }) => {
    // About fifty steps with a real mouse and keyboard: slower than a normal test, and slower still when
    // the suite runs in parallel.
    test.setTimeout(120_000);
    const slide = await openNewDeck(page);
    const title = page.getByRole('textbox', { name: 'Deck title' });
    await title.fill('Autumn Launch');
    await title.press('Enter');

    // The headline block.
    await addText(page, slide, [130, 120], '03 — STRATEGY', {
      size: 32,
      bold: true,
      colour: '17803F',
    });
    await addText(page, slide, [130, 190], 'Our approach', { size: 150, bold: true });

    // The picture and the blocks behind and beside it.
    await drawShape(page, slide, 'Rectangle', [1340, 280], [1780, 830], 'F5C542');
    await page
      .locator('input[type="file"]')
      .setInputFiles([pictureFile('harbour.png', 'image/png', png(730, 650, [127, 200, 160]))]);
    await expect(page.locator('.slide-frame [data-kind="image"]')).toHaveCount(1);
    await page
      .getByRole('textbox', { name: 'Image description' })
      .fill('Boats in the harbour at dawn');
    await page.keyboard.press('Tab');
    await page.getByRole('textbox', { name: 'Opacity percent' }).fill('60');
    await page.keyboard.press('Enter');
    await drawShape(page, slide, 'Ellipse', [640, 640], [940, 940], '14281B');

    // The three pillars: a rule and a row of words each.
    for (const [i, row] of [
      'Listen first',
      'Ship in small steps',
      'Measure what matters',
    ].entries()) {
      await drawShape(page, slide, 'Line', [130, 740 + i * 100], [770, 740 + i * 100]);
      await addText(page, slide, [130, 762 + i * 100], `0${String(i + 1)}   ${row}`, { size: 44 });
    }

    // Speaker notes.
    await page
      .getByRole('textbox', { name: 'Speaker notes text' })
      .fill('Open with the customer problem, not the product.');

    const counts = () =>
      page.evaluate(() => ({
        text: document.querySelectorAll('.slide-frame [data-kind="text"]').length,
        shapes: document.querySelectorAll('.slide-frame [data-kind="shape"]').length,
        images: document.querySelectorAll('.slide-frame [data-kind="image"]').length,
      }));
    expect(await counts()).toEqual({ text: 5, shapes: 5, images: 1 });

    // Undo and redo walk back and forward through all of it.
    for (let i = 0; i < 4; i++) await page.keyboard.press('Control+z');
    await expect.poll(async () => (await counts()).text + (await counts()).shapes).toBeLessThan(11);
    for (let i = 0; i < 4; i++) await page.keyboard.press('Control+Shift+z');
    await expect.poll(counts).toEqual({ text: 5, shapes: 5, images: 1 });

    // A copy of the slide, then back to the first, and a reload: it is all saved.
    await page.getByRole('option', { name: 'Slide 1', exact: true }).focus();
    await page.keyboard.press('Control+d');
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByRole('option')).toHaveCount(2);
    await page.getByRole('option', { name: 'Slide 2', exact: true }).click();
    await expect(page.locator('.slide-frame [data-kind="image"] img')).toHaveAttribute(
      'alt',
      'Boats in the harbour at dawn',
    );
    expect(await counts()).toEqual({ text: 5, shapes: 5, images: 1 });
    await expect(page.getByRole('textbox', { name: 'Speaker notes text' })).toHaveValue(
      'Open with the customer problem, not the product.',
    );
  });
});
