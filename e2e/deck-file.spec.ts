import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { autumnLaunch } from '../tests/fixtures/autumnLaunch';
import { pictureFile, png } from './support/pictures';
import { seedDeck } from './support/seed';

// Sprint 9: save a deck to a file and open it somewhere else (SV-3).

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = 'autumn-launch';

/** Export the open deck as a file, through the dialog, and return where it was saved. */
async function exportDeck(page: Page, path: string) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export deck' });
  await dialog.getByRole('radio', { name: /Editable deck file/ }).click();
  await expect(dialog.getByText(/\.slides · about/)).toBeVisible();
  const button = dialog.getByRole('button', { name: 'Export deck file' });
  await expect(button).toBeEnabled();
  const download = page.waitForEvent('download');
  await button.click();
  const taken = await download;
  // The app names the file "Autumn Launch.slides"; WebKit on Linux turns the space into an underscore.
  expect(taken.suggestedFilename()).toMatch(/^Autumn[ _]Launch\.slides$/);
  await taken.saveAs(path);
  return path;
}

test.describe('Given Autumn Launch with a picture added (SV-3)', () => {
  test('When it is saved to a file and opened in a fresh browser profile, Then the same deck is there, with its picture, steps, transitions and notes', async ({
    page,
    browser,
  }, info) => {
    await seedDeck(page, autumnLaunch(), DECK);
    await page
      .locator('input[type="file"]')
      .setInputFiles([pictureFile('logo.png', 'image/png', png(120, 80))]);
    await expect(page.locator('.slide-frame [data-kind="image"]')).toHaveCount(1);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);

    const path = await exportDeck(page, info.outputPath('autumn.slides'));

    // The file carries the fonts the deck uses, each with its licence (decision 38), and the picture once.
    const names = Object.keys(unzipSync(readFileSync(path)));
    expect(names).toContain('deck.json');
    expect(names.filter((name) => name.startsWith('images/'))).toHaveLength(1);
    expect(names).toContain('fonts/instrument-sans/OFL.txt');
    expect(
      names.some((name) => name.startsWith('fonts/instrument-sans/') && name.endsWith('.woff2')),
    ).toBe(true);
    // A family the deck does not use is not in it.
    expect(names.some((name) => name.startsWith('fonts/caveat/'))).toBe(false);

    // Somewhere else: another browser profile, with nothing in it.
    const elsewhere = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const other = await elsewhere.newPage();
    await other.goto('/');
    await expect(other.getByRole('heading', { name: 'No decks yet' })).toBeVisible();
    await other.getByLabel('Deck file').setInputFiles(path);

    await expect(other.getByRole('option', { name: 'Slide 12', exact: true })).toBeVisible();
    expect(new URL(other.url()).hash).not.toBe(`#/deck/${DECK}`);
    await expect(other.getByLabel('Deck title')).toHaveValue('Autumn Launch');
    await expect(other.locator('.rail-item')).toHaveCount(12);
    // The picture came with it and is drawn.
    await expect(other.locator('.slide-frame [data-kind="image"] img')).toHaveCount(1);
    await expect
      .poll(() =>
        other.evaluate(
          () =>
            document.querySelector<HTMLImageElement>('.slide-frame [data-kind="image"] img')
              ?.naturalWidth ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    // Slide 3: its notes, its transition and its three clicks.
    await other.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await expect(other.getByRole('textbox', { name: /notes/i })).toHaveValue(
      /Open with the customer problem/,
    );
    await other.getByRole('tab', { name: 'Animate' }).click();
    await expect(other.getByText('6 steps · 3 clicks')).toBeVisible();
    await other.getByRole('tab', { name: 'Transition' }).click();
    await expect(
      other
        .getByRole('group', { name: 'Effect' })
        .getByRole('button', { name: 'Slide', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await elsewhere.close();

    // And the deck here was not touched by exporting it.
    await page.reload();
    await expect(page.getByRole('option', { name: 'Slide 12', exact: true })).toBeVisible();
  });

  test('When a file is opened twice, Then there are two decks and neither is replaced', async ({
    page,
  }, info) => {
    await seedDeck(page, autumnLaunch(), DECK);
    const path = await exportDeck(page, info.outputPath('twice.slides'));
    await page.goto('/#/');
    await expect(page.locator('.deck-title', { hasText: 'Autumn Launch' })).toBeVisible();

    await page.getByLabel('Deck file').setInputFiles(path);
    await expect(page.getByRole('option', { name: 'Slide 12', exact: true })).toBeVisible();
    await page.goto('/#/');
    await page.getByLabel('Deck file').setInputFiles(path);
    await expect(page.getByRole('option', { name: 'Slide 12', exact: true })).toBeVisible();
    await page.goto('/#/');

    await expect(page.getByRole('heading', { name: /Your decks · 3/ })).toBeVisible();
  });
});

test.describe('Given files that are not decks (SV-3)', () => {
  const notes = 'Not a deck at all';
  const zipOfSomethingElse = zipSync({ 'a.txt': strToU8('hello'), 'b.jpg': new Uint8Array(30) });

  test('When one is opened, Then a clear message is shown, nothing is added, and another can be chosen', async ({
    page,
  }, info) => {
    await seedDeck(page, autumnLaunch(), DECK);
    const good = await exportDeck(page, info.outputPath('good.slides'));
    const whole = readFileSync(good);
    await page.goto('/#/');
    await expect(page.locator('.deck-title', { hasText: 'Autumn Launch' })).toBeVisible();
    const input = page.getByLabel('Deck file');
    const refused = page.getByRole('alert').filter({ hasText: 'This file couldn’t be opened' });

    for (const [name, buffer] of [
      ['notes.slides', Buffer.from(notes)],
      ['other.slides', Buffer.from(zipOfSomethingElse)],
      ['half.slides', whole.subarray(0, Math.floor(whole.length / 2))],
      ['empty.slides', Buffer.alloc(0)],
    ] as const) {
      await input.setInputFiles({ name, mimeType: 'application/zip', buffer });
      await expect(refused).toBeVisible();
      await expect(refused).toContainText('Your decks are untouched.');
      await expect(page.getByRole('heading', { name: /Your decks · 1/ })).toBeVisible();
      expect(new URL(page.url()).hash).toBe('#/');
      await page.getByRole('button', { name: 'Dismiss' }).click();
    }
  });

  test('When a file from a newer Cue is opened, Then it says so', async ({ page }) => {
    await page.goto('/');
    const manifest = {
      format: 'cue-deck',
      formatVersion: 1,
      savedAt: 1,
      deck: { ...(autumnLaunch() as object), schemaVersion: 99 },
      images: [],
      originals: [],
      fonts: [],
    };
    const buffer = Buffer.from(zipSync({ 'deck.json': strToU8(JSON.stringify(manifest)) }));

    await page
      .getByLabel('Deck file')
      .setInputFiles({ name: 'future.slides', mimeType: 'application/zip', buffer });

    await expect(page.getByText('This deck needs a newer version of Cue')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No decks yet' })).toBeVisible();
  });

  test('Then the message, the Export dialog and the card of a deck Cue cannot read have no accessibility violations', async ({
    page,
  }) => {
    await seedDeck(page, autumnLaunch(), DECK);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export deck' });
    await expect(dialog.getByText(/\.slides · about/)).toBeVisible();
    const exportResults = await new AxeBuilder({ page }).exclude('.canvas .cue-slide').analyze();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await page.goto('/#/');
    await page
      .getByLabel('Deck file')
      .setInputFiles({ name: 'x.slides', mimeType: 'application/zip', buffer: Buffer.from(notes) });
    await expect(page.getByText('This file couldn’t be opened')).toBeVisible();
    const problemResults = await new AxeBuilder({ page }).exclude('.deck-thumb').analyze();

    expect(exportResults.violations).toEqual([]);
    expect(problemResults.violations).toEqual([]);
  });
});
