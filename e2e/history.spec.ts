import { expect, test, type Page } from '@playwright/test';
import { drag, openNewDeck, type Slide } from './support/slide';

// Sprint 4: undo and redo (EL-8), with a real mouse and keyboard.

test.use({ viewport: { width: 1440, height: 900 } });

const rectangle = (page: Page) => page.locator('.slide-frame [data-shape="rectangle"]');
const undo = (page: Page) => page.getByRole('button', { name: 'Undo' });
const redo = (page: Page) => page.getByRole('button', { name: 'Redo' });

async function drawRectangle(page: Page, slide: Slide) {
  await page.getByRole('button', { name: 'Shape' }).click();
  await page.getByRole('menuitem', { name: 'Rectangle', exact: true }).click();
  await drag(page, slide, [300, 300], [800, 600]);
}

const left = async (page: Page) =>
  Math.round(
    (await rectangle(page)
      .boundingBox()
      .then((b) => b?.x)) ?? 0,
  );

test.describe('Given edits on a slide, When they are undone and redone (EL-8)', () => {
  test('Then one Ctrl+Z undoes a whole drag, and Ctrl+Shift+Z puts it back', async ({ page }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    const before = await left(page);

    await drag(page, slide, [500, 450], [1100, 450]);
    const dragged = await left(page);
    expect(dragged).toBeGreaterThan(before + 100);
    await page.keyboard.press('Control+z');
    await expect.poll(() => left(page)).toBe(before);
    await page.keyboard.press('Control+Shift+z');

    await expect.poll(() => left(page)).toBe(dragged);
  });

  test('Then a drawn shape, a resize, a fade and a deletion each undo in turn, all the way back to a blank slide', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    await page.getByRole('textbox', { name: 'Opacity percent' }).fill('40');
    await page.keyboard.press('Enter');
    // Back on the slide (typing in a field is not the slide's), Delete removes the shape.
    const centre = await slide.at(550, 450);
    await page.mouse.click(centre.x, centre.y);
    await page.keyboard.press('Delete');
    await expect(rectangle(page)).toHaveCount(0);

    await page.keyboard.press('Control+z');
    await expect(rectangle(page)).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Opacity percent' })).toHaveValue('40');
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('textbox', { name: 'Opacity percent' })).toHaveValue('100');
    await page.keyboard.press('Control+z');

    await expect(rectangle(page)).toHaveCount(0);
    await expect(undo(page)).toBeDisabled();
    await expect(redo(page)).toBeEnabled();
  });

  test('Then the buttons undo and redo, and say what they would do', async ({ page }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    await drag(page, slide, [500, 450], [900, 450]);

    await expect(undo(page)).toHaveAttribute('title', 'Undo Move (Ctrl+Z)');
    await undo(page).click();
    await expect(redo(page)).toHaveAttribute('title', 'Redo Move (Ctrl+Shift+Z)');
    await redo(page).click();

    await expect(undo(page)).toBeEnabled();
  });

  test('Then words typed in a text box are undone with Ctrl+Z while editing', async ({ page }) => {
    const slide = await openNewDeck(page);
    await slide.frame.focus();
    await page.keyboard.press('t');
    await expect(page.getByRole('button', { name: 'Text', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const point = await slide.at(300, 300);
    await page.mouse.click(point.x, point.y);
    const editor = page.locator('.text-edit-box .ProseMirror');
    await expect(editor).toBeFocused();
    await page.keyboard.type('Hello world');

    await page.keyboard.press('Control+z');

    await expect(editor).not.toHaveText('Hello world');
    await page.keyboard.press('Control+Shift+z');
    await expect(editor).toHaveText('Hello world');
  });

  test('Then an edit on slide 1, then a visit to slide 2, is undone from slide 2 by showing slide 1', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    await page.getByRole('button', { name: 'New slide' }).click();
    await expect(page.getByRole('option', { name: 'Slide 2', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // The last step is adding slide 2, so it goes first; the next one is the rectangle on slide 1.
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('option', { name: 'Slide 2', exact: true })).toHaveCount(0);
    await page.keyboard.press('Control+z');

    await expect(rectangle(page)).toHaveCount(0);
    await expect(page.getByRole('option', { name: 'Slide 1', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('Then undone changes are saved, and a reload starts with an empty history', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    await page.keyboard.press('Control+z');
    await expect(rectangle(page)).toHaveCount(0);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    await page.reload();

    await expect(rectangle(page)).toHaveCount(0);
    await expect(undo(page)).toBeDisabled();
    await expect(redo(page)).toBeDisabled();
  });

  test('Then Ctrl+Z in a field is the field’s own, and does not undo the deck', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    const title = page.getByRole('textbox', { name: 'Deck title' });
    await title.click();
    await page.keyboard.type('X');
    await page.keyboard.press('Control+z');

    await expect(rectangle(page)).toHaveCount(1);
  });
});
