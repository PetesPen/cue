import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { savedNotes } from './support/db';
import { openNewDeck } from './support/slide';

// Sprint 3: speaker notes (SL-6).

test.use({ viewport: { width: 1440, height: 900 } });

const field = (page: Page) => page.getByRole('textbox', { name: 'Speaker notes text' });

test.describe('Given a slide, When speaker notes are written (SL-6)', () => {
  test('Then they are saved with that slide and are there after a reload', async ({ page }) => {
    await openNewDeck(page);

    await field(page).fill('Open with the customer problem.\nThen pause for questions.');
    await expect
      .poll(() => savedNotes(page))
      .toEqual(['Open with the customer problem.\nThen pause for questions.']);
    await page.reload();

    await expect(field(page)).toHaveValue(
      'Open with the customer problem.\nThen pause for questions.',
    );
  });

  test('Then each slide keeps its own notes', async ({ page }) => {
    await openNewDeck(page);
    await field(page).fill('Notes for one');
    await page.getByRole('button', { name: 'New slide' }).click();
    await expect(page.getByRole('option', { name: 'Slide 2', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(field(page)).toHaveValue('');
    await field(page).fill('Notes for two');

    await page.getByRole('option', { name: 'Slide 1', exact: true }).click();
    await expect(field(page)).toHaveValue('Notes for one');
    await page.getByRole('option', { name: 'Slide 2', exact: true }).click();
    await expect(field(page)).toHaveValue('Notes for two');
  });

  test('Then the notes field has no accessibility violations', async ({ page }) => {
    await openNewDeck(page);
    await field(page).fill('Some notes');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
