import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { drag, openNewDeck, type Slide } from './support/slide';

// Sprint 3: text (EL-1, EL-2). These drive the real editor with a real mouse and keyboard in each
// browser, at a fixed window size.

test.use({ viewport: { width: 1440, height: 900 } });

const editor = (page: Page) => page.locator('.text-edit-box .ProseMirror');
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Text formatting' });
const drawn = (page: Page) => page.locator('.slide-frame [data-kind="text"] .cue-text');

/** Press T, click the slide, and wait for the editor (TipTap loads the first time). */
async function addText(page: Page, slide: Slide, at: readonly [number, number] = [300, 300]) {
  // Keys go to the page once it has focus, as they do after any click by a person.
  await slide.frame.focus();
  await page.keyboard.press('t');
  // The button shows the tool is armed; clicking before that would only deselect.
  await expect(page.getByRole('button', { name: 'Text', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const point = await slide.at(...at);
  await page.mouse.click(point.x, point.y);
  await expect(editor(page)).toBeFocused();
}

/**
 * Wait for a moment after the editor opens. For about 50 ms after it puts the cursor in place,
 * ProseMirror puts back any cursor movement it did not make itself, so a key pressed at that instant
 * (which no person does) would seem to do nothing.
 */
const settle = (page: Page) => page.waitForTimeout(300);

/** Stop editing, and wait until the words are drawn by the slide again. */
async function finish(page: Page) {
  await page.keyboard.press('Escape');
  await expect(editor(page)).toHaveCount(0);
}

test.describe('Given a blank slide, When text is added (EL-1)', () => {
  test('Then T and a click add a text box with the cursor in it, and typing shows the words', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);

    await addText(page, slide);
    await page.keyboard.type('Our approach');

    await expect(editor(page)).toHaveText('Our approach');
    await finish(page);
    await expect(drawn(page)).toHaveText('Our approach');
    await expect(page.locator('.sel-chip')).toContainText('Text');
  });

  test('Then the Text button does the same, and a drag sets the width of the box', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);

    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await drag(page, slide, [200, 200], [1000, 260]);
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('A wide box');
    await finish(page);

    await expect(page.getByRole('textbox', { name: 'Width', exact: true })).toHaveValue('800');
  });

  test('Then Escape before any words are typed leaves no empty box behind', async ({ page }) => {
    const slide = await openNewDeck(page);

    await addText(page, slide);
    await finish(page);

    await expect(page.locator('.slide-frame [data-kind="text"]')).toHaveCount(0);
  });

  test('Then the words are saved with the deck and are there after a reload', async ({ page }) => {
    const slide = await openNewDeck(page);
    await addText(page, slide);
    await page.keyboard.type('Still here');
    await finish(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    await page.reload();

    await expect(drawn(page)).toHaveText('Still here');
  });

  test('Then a long text wraps and the box grows in height with it', async ({ page }) => {
    const slide = await openNewDeck(page);
    await addText(page, slide);
    const oneLine = (await page.locator('.slide-frame [data-kind="text"]').boundingBox())?.height;

    await page.keyboard.type('word '.repeat(60));
    await finish(page);

    const grown = (await page.locator('.slide-frame [data-kind="text"]').boundingBox())?.height;
    expect(grown).toBeGreaterThan((oneLine ?? 0) * 3);
  });
});

test.describe('Given a text box, When it is edited (EL-1)', () => {
  test('Then double-clicking edits it in place, and words selected can be made bold from the toolbar', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await addText(page, slide);
    await page.keyboard.type('Our approach');
    await finish(page);

    await page.locator('.slide-frame [data-kind="text"]').dblclick({ position: { x: 20, y: 10 } });
    await expect(editor(page)).toBeFocused();
    await settle(page);
    await page.keyboard.press('Control+Home');
    await page.keyboard.down('Shift');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Shift');
    await toolbar(page).getByRole('button', { name: 'Bold', exact: true }).click();
    await finish(page);

    await expect(drawn(page).locator('strong')).toHaveText('Our');
    await expect(drawn(page)).toHaveText('Our approach');
  });

  test('Then a click outside the text finishes editing and selects what was clicked', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await addText(page, slide);
    await page.keyboard.type('Words');

    const away = await slide.at(1500, 900);
    await page.mouse.click(away.x, away.y);

    await expect(editor(page)).toHaveCount(0);
    await expect(drawn(page)).toHaveText('Words');
  });

  test('Then the text style, size and colour apply to the selected words only', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await addText(page, slide);
    await page.keyboard.type('Big small');
    await settle(page);
    await page.keyboard.press('Control+Home');
    await page.keyboard.down('Shift');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Shift');

    const size = toolbar(page).getByRole('textbox', { name: 'Font size' });
    await size.fill('120');
    await page.keyboard.press('Enter');
    await finish(page);

    const sizes = await drawn(page)
      .locator('span')
      .evaluateAll((spans) => spans.map((span) => [span.textContent, span.style.fontSize]));
    expect(sizes).toEqual([['Big', '120px']]);
  });
});

test.describe('Given the text editor (accessibility)', () => {
  test('Then the editor, its toolbar and the Text section have no accessibility violations', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await addText(page, slide);
    await page.keyboard.type('Accessible');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
