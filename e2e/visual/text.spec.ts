import { expect, test, type Page } from '@playwright/test';
import { FOREST, GREEN, MINT, SAGE, YELLOW, openSeededDeck } from './support';

// Screenshot tests for text (sprint 3): how text looks in each font with mixed styles, lists and
// colours; how a shape holds text; how fading fades text with the element; how the text editor, its
// toolbar, the font picker and the colour picker look. They run only in the pinned container; the
// reference images are made by the "Update screenshots" workflow and reviewed by Peter (decision 13).

function run(text: string, ...marks: object[]) {
  return marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text };
}
const style = (fontFamily?: string, fontSize?: number, color?: string) => ({
  type: 'textStyle',
  attrs: {
    ...(fontFamily ? { fontFamily } : {}),
    ...(fontSize ? { fontSize } : {}),
    ...(color ? { color } : {}),
  },
});
const para = (attrs: object | undefined, ...content: object[]) => ({
  type: 'paragraph',
  ...(attrs ? { attrs } : {}),
  content,
});
const doc = (...content: object[]) => ({ type: 'doc', content });

function textBox(seed: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  doc: object;
  opacity?: number;
  fill?: string;
  padding?: number;
  border?: { color: string; width: number; dash: string };
}) {
  return {
    kind: 'text',
    rotation: 0,
    opacity: 1,
    fill: 'none',
    padding: 0,
    border: { color: FOREST, width: 0, dash: 'solid' },
    ...seed,
  };
}

function shapeWithText(seed: {
  id: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  text: object;
  opacity?: number;
}) {
  return {
    kind: 'shape',
    rotation: 0,
    opacity: 1,
    border: { color: FOREST, width: 0, dash: 'solid' },
    cornerRadius: 0,
    ...seed,
  };
}

const frame = (page: Page) => page.getByRole('group', { name: /^Slide 1 of/ });

/** Wait for every font the slide uses, so no text is photographed in a fallback face. */
async function fontsReady(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.locator('[data-fonts="loading"]')).toHaveCount(0);
}

test.describe('Given text on a slide', () => {
  test('When fonts, sizes, styles, lists and colours are mixed, Then the slide looks like text-styles.png', async ({
    page,
  }) => {
    await openSeededDeck(page, [
      textBox({
        id: 'title',
        x: 100,
        y: 70,
        width: 1700,
        height: 130,
        doc: doc(
          para(
            undefined,
            run('Our ', style('Bricolage Grotesque', 110)),
            run('approach', style('Bricolage Grotesque', 110, GREEN), { type: 'bold' }),
          ),
        ),
      }),
      textBox({
        id: 'body',
        x: 100,
        y: 260,
        width: 880,
        height: 400,
        doc: doc(
          para(
            { lineHeight: 1.4 },
            run('Plain, ', style(undefined, 36)),
            run('bold, ', style(undefined, 36), { type: 'bold' }),
            run('italic, ', style(undefined, 36), { type: 'italic' }),
            run('underlined and ', style(undefined, 36), { type: 'underline' }),
            run('struck', style(undefined, 36), { type: 'strike' }),
            run(' text, with a line long enough to wrap onto a second line.', style(undefined, 36)),
          ),
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [para(undefined, run('Listen first', style(undefined, 36)))],
              },
              {
                type: 'listItem',
                content: [
                  para(undefined, run('Then build', style(undefined, 36))),
                  {
                    type: 'orderedList',
                    content: [
                      {
                        type: 'listItem',
                        content: [para(undefined, run('Small', style(undefined, 36)))],
                      },
                      {
                        type: 'listItem',
                        content: [para(undefined, run('Often', style(undefined, 36)))],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ),
      }),
      textBox({
        id: 'hand',
        x: 1060,
        y: 260,
        width: 760,
        height: 120,
        doc: doc(
          para({ align: 'center' }, run('Hand written note', style('Caveat', 84, '#B3261E'))),
        ),
      }),
      textBox({
        id: 'serif',
        x: 1060,
        y: 400,
        width: 760,
        height: 90,
        doc: doc(para({ align: 'right' }, run('A serif headline', style('DM Serif Display', 64)))),
      }),
      textBox({
        id: 'mono',
        x: 1060,
        y: 520,
        width: 760,
        height: 70,
        doc: doc(para(undefined, run('const cue = "mono";', style('JetBrains Mono', 40, GREEN)))),
      }),
      shapeWithText({
        id: 'badge',
        shape: 'ellipse',
        x: 140,
        y: 760,
        width: 500,
        height: 240,
        fill: FOREST,
        text: doc(
          para(undefined, run('Inside a shape', style('Figtree', 56, '#FFFFFF'), { type: 'bold' })),
        ),
      }),
      shapeWithText({
        id: 'card',
        shape: 'roundedRectangle',
        x: 760,
        y: 760,
        width: 1060,
        height: 240,
        fill: SAGE,
        text: doc(
          para(undefined, run('Centred in the card', style('Space Grotesk', 52))),
          para(undefined, run('on two lines of text', style('Space Grotesk', 36, '#5B6F61'))),
        ),
      }),
    ]);
    await fontsReady(page);

    await expect(frame(page)).toHaveScreenshot('text-styles.png');
  });

  test('When a text box has a fill, a border and padding, and another is faded over a block, Then it looks like text-boxes.png', async ({
    page,
  }) => {
    await openSeededDeck(page, [
      shapeWithText({
        id: 'block',
        shape: 'rectangle',
        x: 80,
        y: 520,
        width: 1760,
        height: 420,
        fill: YELLOW,
        text: doc(para(undefined)),
      }),
      textBox({
        id: 'padded',
        x: 140,
        y: 120,
        width: 760,
        height: 220,
        fill: MINT,
        padding: 40,
        border: { color: FOREST, width: 8, dash: 'solid' },
        doc: doc(
          para(undefined, run('A box with a fill, a border and padding', style(undefined, 52))),
        ),
      }),
      textBox({
        id: 'full',
        x: 140,
        y: 580,
        width: 760,
        height: 80,
        doc: doc(para(undefined, run('Fully solid text', style(undefined, 56)))),
      }),
      textBox({
        id: 'half',
        x: 140,
        y: 700,
        width: 760,
        height: 80,
        opacity: 0.5,
        doc: doc(para(undefined, run('Half faded text', style(undefined, 56)))),
      }),
      textBox({
        id: 'ghost',
        x: 1000,
        y: 700,
        width: 760,
        height: 80,
        opacity: 0.25,
        doc: doc(para(undefined, run('A quarter solid', style(undefined, 56)))),
      }),
    ]);
    await fontsReady(page);

    await expect(frame(page)).toHaveScreenshot('text-boxes.png');
  });
});

test.describe('Given the text editor', () => {
  const seeded = () => [
    textBox({
      id: 'title',
      x: 160,
      y: 360,
      width: 1000,
      height: 140,
      doc: doc(
        para(
          undefined,
          run('Our ', style('Bricolage Grotesque', 110)),
          run('approach', style('Bricolage Grotesque', 110, GREEN)),
        ),
      ),
    }),
  ];

  async function openEditor(page: Page) {
    await openSeededDeck(page, seeded());
    await fontsReady(page);
    await page.locator('.slide-frame [data-kind="text"]').dblclick({ position: { x: 60, y: 30 } });
    await expect(page.locator('.text-edit-box .ProseMirror')).toBeFocused();
    await page.waitForTimeout(300);
    // Select the last word, as in the Editor-Text board.
    await page.keyboard.press('Control+End');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Control+ArrowLeft');
    await page.keyboard.up('Shift');
  }

  test('When a word is selected, Then the box, the toolbar and the Text section look like text-editing.png', async ({
    page,
  }) => {
    await openEditor(page);
    await expect(page.getByRole('toolbar', { name: 'Text formatting' })).toBeVisible();

    await expect(page).toHaveScreenshot('text-editing.png');
  });

  test('When the font picker is open, Then it looks like font-picker.png', async ({ page }) => {
    await openEditor(page);
    await page
      .getByRole('toolbar', { name: 'Text formatting' })
      .getByRole('button', { name: /^Font:/ })
      .click();
    await expect(page.getByRole('listbox', { name: 'Fonts' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    await expect(page).toHaveScreenshot('font-picker.png');
  });

  test('When the colour picker is open, Then it looks like colour-picker.png', async ({ page }) => {
    await openEditor(page);
    await page
      .getByRole('toolbar', { name: 'Text formatting' })
      .getByRole('button', { name: 'Text colour' })
      .click();
    await expect(page.locator('.cp-area')).toBeVisible();

    await expect(page).toHaveScreenshot('colour-picker.png');
  });
});
