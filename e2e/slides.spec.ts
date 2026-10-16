import { expect, test, type Page } from '@playwright/test';
import { openNewDeck } from './support/slide';

// Sprint 4: reorder, duplicate and delete slides (SL-3, SL-4). Each slide is told apart by its notes.

test.use({ viewport: { width: 1440, height: 900 } });

const notes = (page: Page) => page.getByRole('textbox', { name: 'Speaker notes text' });
const slideItem = (page: Page, n: number) =>
  page.getByRole('option', { name: `Slide ${String(n)}`, exact: true });

/** A deck of three slides whose notes say "one", "two" and "three". */
async function threeSlides(page: Page) {
  await openNewDeck(page);
  await notes(page).fill('one');
  for (const [i, words] of ['two', 'three'].entries()) {
    await page.getByRole('button', { name: 'New slide' }).click();
    await expect(slideItem(page, i + 2)).toHaveAttribute('aria-selected', 'true');
    await notes(page).fill(words);
  }
  // Leave the notes field so the last words are given to the deck.
  await slideItem(page, 1).click();
}

/** What each slide's notes say, in order, by visiting each. */
async function order(page: Page): Promise<string[]> {
  const out: string[] = [];
  await expect(slideItem(page, 1)).toBeVisible();
  const count = await page.getByRole('option').count();
  for (let n = 1; n <= count; n++) {
    await slideItem(page, n).click();
    out.push(await notes(page).inputValue());
  }
  return out;
}

test.describe('Given three slides, When one is dragged to a new place (SL-3)', () => {
  test('Then a line shows where it will land, the numbers update when it is dropped, and Ctrl+Z puts it back', async ({
    page,
  }) => {
    await threeSlides(page);
    const first = await slideItem(page, 1).boundingBox();
    const last = await slideItem(page, 3).boundingBox();
    if (!first || !last) throw new Error('the thumbnails are not drawn');

    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(first.x + first.width / 2, first.y + first.height, { steps: 4 });
    await page.mouse.move(last.x + last.width / 2, last.y + last.height - 4, { steps: 8 });
    await expect(page.locator('.rail-drop-line')).toBeVisible();
    await page.mouse.up();

    await expect(page.locator('.rail-drop-line')).toHaveCount(0);
    expect(await order(page)).toEqual(['two', 'three', 'one']);
    await page.keyboard.press('Control+z');
    expect(await order(page)).toEqual(['one', 'two', 'three']);
  });

  test('Then Escape during a drag cancels it', async ({ page }) => {
    await threeSlides(page);
    const first = await slideItem(page, 1).boundingBox();
    const last = await slideItem(page, 3).boundingBox();
    if (!first || !last) throw new Error('the thumbnails are not drawn');

    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(last.x + last.width / 2, last.y + last.height - 4, { steps: 8 });
    await page.keyboard.press('Escape');
    await page.mouse.up();

    expect(await order(page)).toEqual(['one', 'two', 'three']);
  });

  test('Then the new order is saved and is there after a reload', async ({ page }) => {
    await threeSlides(page);
    await slideItem(page, 1).focus();
    await page.keyboard.press('Control+Shift+ArrowDown');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);

    await page.reload();

    expect(await order(page)).toEqual(['two', 'one', 'three']);
  });
});

test.describe('Given a slide, When it is duplicated or deleted (SL-4)', () => {
  test('Then Ctrl+D copies it with its notes and elements right after it, and selects the copy', async ({
    page,
  }) => {
    await threeSlides(page);
    await slideItem(page, 2).click();
    await page.getByRole('button', { name: 'Shape' }).click();
    await page.getByRole('menuitem', { name: 'Ellipse', exact: true }).click();
    const frame = await page.getByRole('group', { name: /^Slide 2 of/ }).boundingBox();
    if (!frame) throw new Error('no slide');
    await page.mouse.click(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await slideItem(page, 2).focus();

    await page.keyboard.press('Control+d');

    await expect(page.getByRole('option')).toHaveCount(4);
    await expect(slideItem(page, 3)).toHaveAttribute('aria-selected', 'true');
    await expect(notes(page)).toHaveValue('two');
    await expect(page.locator('.slide-frame [data-shape="ellipse"]')).toHaveCount(1);
    expect(await order(page)).toEqual(['one', 'two', 'two', 'three']);
  });

  test('Then Delete removes it with a toast, and Undo brings it back in the same place', async ({
    page,
  }) => {
    await threeSlides(page);
    await slideItem(page, 2).focus();

    await page.keyboard.press('Delete');

    await expect(page.getByText('Slide 2 deleted')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(2);
    await page.getByRole('button', { name: 'Undo', exact: true }).last().click();
    await expect(page.getByRole('option')).toHaveCount(3);
    expect(await order(page)).toEqual(['one', 'two', 'three']);
  });

  test('Then deleting the only slide leaves a blank one', async ({ page }) => {
    await openNewDeck(page);
    await notes(page).fill('something');
    await slideItem(page, 1).focus();

    await page.keyboard.press('Delete');

    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(notes(page)).toHaveValue('');
  });

  test('Then the right-click menu on a thumbnail duplicates, moves and deletes', async ({
    page,
  }) => {
    await threeSlides(page);
    const second = await slideItem(page, 2).boundingBox();
    if (!second) throw new Error('no thumbnail');

    await page.mouse.click(second.x + 40, second.y + 20, { button: 'right' });
    const menu = page.getByRole('menu', { name: 'Slide actions' });
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Duplicate slideCtrl+D',
      'Delete slideDel',
      'Move upCtrl+Shift+↑',
      'Move downCtrl+Shift+↓',
    ]);
    await menu.getByRole('menuitem', { name: /^Move up/ }).click();

    expect(await order(page)).toEqual(['two', 'one', 'three']);
  });
});
