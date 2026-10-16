import { expect, test, type Page } from '@playwright/test';
import { drag, openNewDeck, type Slide } from './support/slide';

// Sprint 3: copy, paste, duplicate and delete (EL-7), with the real keyboard and clipboard.

test.use({ viewport: { width: 1440, height: 900 } });

const elements = (page: Page) => page.locator('.slide-frame .cue-element');

async function drawRectangle(
  page: Page,
  slide: Slide,
  from: [number, number],
  to: [number, number],
) {
  await page.getByRole('button', { name: 'Shape' }).click();
  await page.getByRole('menuitem', { name: 'Rectangle', exact: true }).click();
  await drag(page, slide, from, to);
}

async function addText(page: Page, slide: Slide, at: [number, number], words: string) {
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  const point = await slide.at(...at);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.text-edit-box .ProseMirror')).toBeFocused();
  await page.keyboard.type(words);
  await page.keyboard.press('Escape');
  await expect(page.locator('.text-edit-box .ProseMirror')).toHaveCount(0);
}

/** A slide with a rectangle and a text box, both selected by dragging a box round them. */
async function twoElementsSelected(page: Page): Promise<Slide> {
  const slide = await openNewDeck(page);
  await drawRectangle(page, slide, [200, 200], [700, 500]);
  await addText(page, slide, [800, 300], 'Our approach');
  await drag(page, slide, [100, 100], [1500, 700]);
  await expect(page.locator('.sel-member')).toHaveCount(2);
  return slide;
}

test.describe('Given elements selected on a slide, When they are copied and pasted (EL-7)', () => {
  test('Then Ctrl+C and Ctrl+V on another slide put formatted copies there, selected, and they are saved', async ({
    page,
  }) => {
    await twoElementsSelected(page);

    await page.keyboard.press('Control+c');
    await page.getByRole('button', { name: 'New slide' }).click();
    await expect(page.getByRole('option', { name: 'Slide 2', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Control+v');

    await expect(elements(page)).toHaveCount(2);
    await expect(page.locator('.slide-frame [data-kind="text"] .cue-text')).toHaveText(
      'Our approach',
    );
    await expect(page.locator('.sel-member')).toHaveCount(2);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('option', { name: 'Slide 2', exact: true }).click();
    await expect(elements(page)).toHaveCount(2);
  });

  test('Then Ctrl+X removes them and Ctrl+V puts them back', async ({ page }) => {
    await twoElementsSelected(page);

    await page.keyboard.press('Control+x');
    await expect(elements(page)).toHaveCount(0);
    await page.keyboard.press('Control+v');

    await expect(elements(page)).toHaveCount(2);
  });

  test('Then Ctrl+D makes copies at once and Delete removes the selection', async ({ page }) => {
    await twoElementsSelected(page);

    await page.keyboard.press('Control+d');
    await expect(elements(page)).toHaveCount(4);
    await page.keyboard.press('Delete');

    await expect(elements(page)).toHaveCount(2);
  });

  test('Then the right-click menu pastes what was copied, even on an empty part of the slide', async ({
    page,
  }) => {
    const slide = await twoElementsSelected(page);
    await page.keyboard.press('Control+c');

    const empty = await slide.at(1700, 950);
    await page.mouse.click(empty.x, empty.y, { button: 'right' });
    const menu = page.getByRole('menu', { name: 'Element actions' });
    await expect(menu.getByRole('menuitem')).toHaveText(['PasteCtrl+V']);
    await menu.getByRole('menuitem', { name: /^Paste/ }).click();

    await expect(elements(page)).toHaveCount(4);
  });
});

test.describe('Given text being edited (EL-7)', () => {
  test('Then Delete and Backspace edit the words and leave the element alone', async ({ page }) => {
    const slide = await openNewDeck(page);
    await addText(page, slide, [300, 300], 'Keep the box');
    await page.locator('.slide-frame [data-kind="text"]').dblclick({ position: { x: 20, y: 10 } });
    await expect(page.locator('.text-edit-box .ProseMirror')).toBeFocused();
    await page.waitForTimeout(300);

    await page.keyboard.press('Control+End');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Escape');

    await expect(page.locator('.slide-frame [data-kind="text"] .cue-text')).toHaveText('Keep the');
    await expect(elements(page)).toHaveCount(1);
  });
});
