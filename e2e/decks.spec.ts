import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Sprint 1: decks, shell and saving (UX-1, SL-1, SL-2, SV-1, SV-2). Each test gets a fresh browser
// profile, so every test starts with an empty library.

const newDeck = async (page: Page) => {
  await page.getByRole('button', { name: 'New deck' }).first().click();
  await expect(page.getByRole('option', { name: 'Slide 1' })).toBeVisible();
};

/** Wait for an edit to be saved: "Saving…" shows for at least the autosave delay, then "Saved". */
const waitForSaved = async (page: Page) => {
  await expect(page.getByText('Saving…')).toBeVisible();
  await expect(page.getByText('Saved')).toBeVisible();
};

const deckTitles = (page: Page) => page.locator('.deck-title');

test.describe('Given the deck library', () => {
  test('When a new deck is made, edited and the tab is closed, Then reopening finds it exactly as left (SV-1, SV-2, SL-1)', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'No decks yet' })).toBeVisible();
    await newDeck(page);

    await page.getByLabel('Deck title').fill('Autumn Launch');
    await page.getByRole('button', { name: 'Add slide' }).click();
    await page.getByRole('button', { name: 'Add slide' }).click();
    await waitForSaved(page);
    const address = page.url();
    await page.close();

    const reopened = await context.newPage();
    await reopened.goto(address);
    await expect(reopened.getByLabel('Deck title')).toHaveValue('Autumn Launch');
    await expect(reopened.getByRole('option')).toHaveCount(3);
    await reopened.getByRole('link', { name: 'All decks' }).click();
    await expect(deckTitles(reopened)).toHaveText(['Autumn Launch']);
    await expect(reopened.getByText('3 slides · Edited just now')).toBeVisible();
  });

  test('When decks are renamed, duplicated and deleted, Then the library changes and survives a reload (SV-2)', async ({
    page,
  }) => {
    await page.goto('/');
    await newDeck(page);
    await page.getByLabel('Deck title').fill('Q3 review');
    await waitForSaved(page);
    await page.getByRole('link', { name: 'All decks' }).click();
    await expect(deckTitles(page)).toHaveText(['Q3 review']);

    await page.getByRole('button', { name: 'Options for Q3 review' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(deckTitles(page)).toHaveText(['Copy of Q3 review', 'Q3 review']);

    await page.getByRole('button', { name: 'Options for Copy of Q3 review' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await page.getByLabel('Deck name').fill('Pitch v2');
    await page.getByRole('button', { name: 'Rename' }).click();
    await expect(deckTitles(page)).toHaveText(['Pitch v2', 'Q3 review']);

    await page.reload();
    await expect(deckTitles(page)).toHaveText(['Pitch v2', 'Q3 review']);

    await page.getByRole('button', { name: 'Options for Q3 review' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('dialog', { name: 'Delete “Q3 review”?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(deckTitles(page)).toHaveText(['Pitch v2', 'Q3 review']);

    await page.getByRole('button', { name: 'Options for Q3 review' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete deck' }).click();
    await expect(deckTitles(page)).toHaveText(['Pitch v2']);

    await page.reload();
    await expect(deckTitles(page)).toHaveText(['Pitch v2']);
  });

  test('When a deck is opened by its card, Then the editor opens it, and the logo leads back (SV-2)', async ({
    page,
  }) => {
    await page.goto('/');
    await newDeck(page);
    await page.getByLabel('Deck title').fill('Team offsite');
    await waitForSaved(page);
    await page.getByRole('link', { name: 'All decks' }).click();

    await page.getByRole('link', { name: /Team offsite/ }).click();

    await expect(page.getByLabel('Deck title')).toHaveValue('Team offsite');
    await expect(page).toHaveTitle('Team offsite · Cue');
  });
});

test.describe('Given an open deck', () => {
  test('When Add slide, New slide and Ctrl+M are used, Then each adds a blank slide after the current one and selects it (SL-1)', async ({
    page,
  }) => {
    await page.goto('/');
    await newDeck(page);
    await expect(page.getByRole('option')).toHaveCount(1);

    await page.getByRole('button', { name: 'Add slide' }).click();
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(page.getByRole('option', { name: 'Slide 2' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByRole('option', { name: 'Slide 1' }).click();
    await page.keyboard.press('Control+M');
    await expect(page.getByRole('option')).toHaveCount(3);
    await expect(page.getByRole('option', { name: 'Slide 2' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByRole('button', { name: 'New slide' }).click();
    await expect(page.getByRole('option')).toHaveCount(4);
    await expect(page.getByRole('option', { name: 'Slide 3' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('group', { name: 'Slide 3 of 4' })).toBeFocused();
  });

  test('When Up and Down are pressed in the slide rail, Then the selection and the canvas move and stop at the ends (SL-2)', async ({
    page,
  }) => {
    await page.goto('/');
    await newDeck(page);
    await page.getByRole('button', { name: 'Add slide' }).click();
    await page.getByRole('button', { name: 'Add slide' }).click();
    await page.getByRole('option', { name: 'Slide 3' }).click();

    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('group', { name: 'Slide 2 of 3' })).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('group', { name: 'Slide 1 of 3' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Slide 1' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('group', { name: 'Slide 2 of 3' })).toBeVisible();
  });

  test('When the editor is opened, Then the rail, canvas, notes and inspector sit in the Studio layout (UX-1)', async ({
    page,
  }) => {
    await page.goto('/');
    await newDeck(page);

    const box = async (name: string, role: 'complementary' | 'main' | 'region') =>
      page.getByRole(role, { name }).boundingBox();
    const rail = await box('Slide panel', 'complementary');
    const canvas = await box('Canvas', 'main');
    const inspector = await box('Inspector', 'complementary');
    const notes = await box('Speaker notes', 'region');

    expect(rail?.width).toBeCloseTo(208, 0);
    expect(inspector?.width).toBeCloseTo(296, 0);
    expect(notes?.height).toBeCloseTo(124, 0);
    expect((rail?.x ?? 0) + (rail?.width ?? 0)).toBeLessThanOrEqual(canvas?.x ?? 0);
    expect((canvas?.x ?? 0) + (canvas?.width ?? 0)).toBeLessThanOrEqual(inspector?.x ?? 0);
  });

  test('When the browser says storage is 90% full, Then a warning shows the real numbers (SV-1)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // Replace the whole object: redefining `estimate` on the real one does not stick in every engine.
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: () => Promise.resolve({ usage: 0.9e9, quota: 1e9 }) },
      });
    });
    await page.goto('/');

    await newDeck(page);

    await expect(page.getByText('Storage is almost full.')).toBeVisible();
    await expect(page.getByText(/0\.9 of about 1 GB used/)).toBeVisible();
  });
});

test.describe('Given any screen', () => {
  test('When the library and the editor are used, Then nothing is logged as an error', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await newDeck(page);
    await page.getByRole('button', { name: 'Add slide' }).click();
    await waitForSaved(page);
    await page.getByRole('link', { name: 'All decks' }).click();
    await expect(deckTitles(page)).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('When the empty library, the library with a menu open, a dialog and the editor are checked, Then axe finds no violations', async ({
    page,
  }) => {
    const check = async () => {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    };

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'No decks yet' })).toBeVisible();
    await check();

    await newDeck(page);
    await page.getByRole('button', { name: 'Add slide' }).click();
    await waitForSaved(page);
    await check();

    await page.getByRole('link', { name: 'All decks' }).click();
    await expect(deckTitles(page)).toHaveCount(1);
    await check();

    await page.getByRole('button', { name: /Options for/ }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await check();

    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await check();
  });
});
