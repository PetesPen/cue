import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { autumnLaunch } from '../tests/fixtures/autumnLaunch';
import { awkwardDeck } from '../tests/fixtures/awkwardDeck';
import { pictureFile, png } from './support/pictures';
import { seedDeck } from './support/seed';

// Sprint 10: back up all decks (SV-8). Every deck goes into one file, which brings them all back in a
// browser with nothing in it; the reminder on the library says when work is not in a file anywhere.

test.use({ viewport: { width: 1440, height: 900 } });
test.slow();

/** Two decks in the library: Autumn Launch with a picture, and the awkward deck; the library is open. */
async function twoDecks(page: Page): Promise<void> {
  await seedDeck(page, autumnLaunch(), 'autumn-launch');
  await page
    .locator('input[type="file"]')
    .setInputFiles([pictureFile('logo.png', 'image/png', png(120, 80))]);
  await expect(page.locator('.slide-frame [data-kind="image"]')).toHaveCount(1);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.waitForTimeout(800);
  await seedDeck(page, { ...awkwardDeck(), id: 'awkward' }, 'awkward');
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Your decks · 2' })).toBeVisible();
}

test.describe('Given two decks in the library (SV-8)', () => {
  test('When Back up all decks is pressed, Then one file holds both, and it brings both back in a browser with nothing in it', async ({
    page,
    browser,
  }, info) => {
    await twoDecks(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Back up all decks' }).first().click();
    const taken = await download;
    expect(taken.suggestedFilename()).toMatch(/^Cue[ _]backup[ _]\d{4}-\d{2}-\d{2}\.zip$/);
    const path = info.outputPath('backup.zip');
    await taken.saveAs(path);
    await expect(page.getByText('Backed up 2 decks.')).toBeVisible();

    // A plain zip: a deck file for each deck, and a note.
    const files = unzipSync(readFileSync(path));
    expect(Object.keys(files).sort()).toEqual([
      'backup.json',
      'decks/Autumn Launch.slides',
      'decks/Awkward.slides',
    ]);
    // Both are in a file now: the library asks for nothing more, and nothing in it changed.
    await expect(page.getByText('Your decks live only in this browser.')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your decks · 2' })).toBeVisible();

    // Somewhere else: a profile with nothing in it.
    const elsewhere = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const other = await elsewhere.newPage();
    await other.goto('/');
    await expect(other.getByRole('heading', { name: 'No decks yet' })).toBeVisible();
    await other.getByLabel('Deck file').setInputFiles(path);

    await expect(other.getByText('Added 2 decks from the backup.')).toBeVisible();
    await expect(other.getByRole('heading', { name: 'Your decks · 2' })).toBeVisible();
    await expect(other.locator('.deck-title', { hasText: 'Autumn Launch' })).toBeVisible();
    await expect(other.locator('.deck-title', { hasText: 'Awkward' })).toBeVisible();

    // Autumn Launch is whole, with its picture, notes and steps.
    await other.getByRole('link', { name: /Autumn Launch/ }).click();
    await expect(other.getByRole('option', { name: 'Slide 12', exact: true })).toBeVisible();
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
    await other.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await expect(other.getByRole('textbox', { name: /notes/i })).toHaveValue(
      /Open with the customer problem/,
    );
    await elsewhere.close();
  });

  test('When a deck is old and was never backed up, Then the library says so, and Back up all decks makes the reminder go', async ({
    page,
  }) => {
    // The fixture decks were made in 2025: more than two weeks ago, and never put in a file.
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.goto('/#/');
    const reminder = page
      .getByRole('status')
      .filter({ hasText: 'Your decks live only in this browser.' });
    await expect(reminder).toBeVisible();
    await expect(reminder).toContainText('You haven’t backed them up yet.');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    const download = page.waitForEvent('download');
    await reminder.getByRole('button', { name: 'Back up all decks' }).click();
    await download;

    await expect(reminder).toHaveCount(0);
    const done = page.getByRole('status').filter({ hasText: 'Backed up 1 deck.' });
    await expect(done).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('When the reminder is closed, Then it stays away after a reload', async ({ page }) => {
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.goto('/#/');
    const reminder = page
      .getByRole('status')
      .filter({ hasText: 'Your decks live only in this browser.' });
    await expect(reminder).toBeVisible();

    await reminder.getByRole('button', { name: 'Hide this for 14 days' }).click();
    await expect(reminder).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your decks · 1' })).toBeVisible();
    await expect(reminder).toHaveCount(0);
  });

  test('When a deck is exported as a file from its card, Then the reminder is gone', async ({
    page,
  }, info) => {
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.goto('/#/');
    await expect(page.getByText('Your decks live only in this browser.')).toBeVisible();

    await page.getByRole('button', { name: 'Options for Autumn Launch' }).click();
    await page.getByRole('menuitem', { name: 'Export…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Export deck' });
    await dialog.getByRole('radio', { name: /Editable deck file/ }).click();
    const button = dialog.getByRole('button', { name: 'Export deck file' });
    await expect(button).toBeEnabled();
    const download = page.waitForEvent('download');
    await button.click();
    await (await download).saveAs(info.outputPath('one.slides'));

    await expect(page.getByText('Your decks live only in this browser.')).toHaveCount(0);
  });
});
