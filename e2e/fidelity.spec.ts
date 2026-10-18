import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { clickCount, parseDeck, type Deck } from '../src/model';
import { autumnLaunch, type Json } from '../tests/fixtures/autumnLaunch';
import { awkwardDeck } from '../tests/fixtures/awkwardDeck';
import { exportPage, openPage, settled as pageSettled } from './support/exported';
import { pictureFile, png } from './support/pictures';
import { seedDeck } from './support/seed';
import { settled as showSettled } from './support/show';

// Sprint 10: the exported page looks like the editor (SV-5). The same slides are drawn three ways in one
// engine, all at 1920 x 1080: in the editor, in the audience window, and in the exported web page. Where
// every element and every line of text sits must agree to within one pixel, the layers must be in the
// same order, and the pixels must agree but for a few edge pixels. Engines are never compared with each
// other: they draw text differently.

test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(600_000);

const DECK = 'autumn-launch';

/** One pixel of the 1920 x 1080 slide. */
const POSITION_TOLERANCE = 1;
/** A pixel counts as different when a colour channel is further apart than this... */
const CHANNEL_TOLERANCE = 24;
/** ...and the slides agree when no more than this share of pixels is. */
const PIXEL_SHARE = 0.002;

interface Measured {
  readonly ids: string[];
  readonly boxes: Record<string, number[]>;
  readonly lines: Record<string, number[][]>;
}

/** Where every element and line of text of the slide at `selector` sits, in slide pixels. Runs in the page. */
function measure(selector: string): Measured {
  const surface = document.querySelector(selector);
  if (!surface) throw new Error(`no slide at ${selector}`);
  const origin = surface.getBoundingClientRect();
  const scale = origin.width / 1920;
  const round = (n: number) => Math.round(n * 10) / 10;
  const relative = (r: DOMRect) => [
    round((r.left - origin.left) / scale),
    round((r.top - origin.top) / scale),
    round(r.width / scale),
    round(r.height / scale),
  ];
  const ids: string[] = [];
  const boxes: Record<string, number[]> = {};
  const lines: Record<string, number[][]> = {};
  for (const node of surface.querySelectorAll<HTMLElement>(':scope > .cue-element')) {
    const id = node.dataset.elementId ?? '';
    ids.push(id);
    boxes[id] = relative(node.getBoundingClientRect());
    const rects: number[][] = [];
    for (const body of node.querySelectorAll('.cue-text')) {
      const range = document.createRange();
      range.selectNodeContents(body);
      for (const rect of range.getClientRects()) if (rect.width > 0) rects.push(relative(rect));
    }
    rects.sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0) || (a[0] ?? 0) - (b[0] ?? 0));
    lines[id] = rects;
  }
  return { ids, boxes, lines };
}

/** What is different between two measurements, in words; nothing when they agree. */
function differences(where: string, a: Measured, b: Measured): string[] {
  const found: string[] = [];
  if (a.ids.join() !== b.ids.join()) {
    found.push(`${where}: the layers are in a different order: ${a.ids.join()} / ${b.ids.join()}`);
    return found;
  }
  const far = (x: number[], y: number[]) =>
    x.length !== y.length ||
    x.some((value, at) => Math.abs(value - (y[at] ?? 0)) > POSITION_TOLERANCE);
  for (const id of a.ids) {
    if (far(a.boxes[id] ?? [], b.boxes[id] ?? [])) {
      found.push(`${where}: ${id} is at ${String(a.boxes[id])} / ${String(b.boxes[id])}`);
    }
    const x = a.lines[id] ?? [];
    const y = b.lines[id] ?? [];
    if (x.length !== y.length) {
      found.push(
        `${where}: ${id} has ${String(x.length)} / ${String(y.length)} lines or runs of text`,
      );
    } else {
      x.forEach((line, at) => {
        if (far(line, y[at] ?? [])) {
          found.push(`${where}: ${id} text ${String(at)} is at ${String(line)} / ${String(y[at])}`);
        }
      });
    }
  }
  return found;
}

/** How many pixels of two PNGs differ, counted in a page of the same browser. */
async function pixelsApart(
  helper: Page,
  a: Buffer,
  b: Buffer,
): Promise<{ apart: number; total: number }> {
  return helper.evaluate(
    async ({ first, second, tolerance }) => {
      const draw = async (data: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('no canvas');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height);
      };
      const one = await draw(first);
      const two = await draw(second);
      if (one.width !== two.width || one.height !== two.height) {
        return { apart: one.width * one.height, total: one.width * one.height };
      }
      let apart = 0;
      for (let at = 0; at < one.data.length; at += 4) {
        const worst = Math.max(
          Math.abs((one.data[at] ?? 0) - (two.data[at] ?? 0)),
          Math.abs((one.data[at + 1] ?? 0) - (two.data[at + 1] ?? 0)),
          Math.abs((one.data[at + 2] ?? 0) - (two.data[at + 2] ?? 0)),
        );
        if (worst > tolerance) apart += 1;
      }
      return { apart, total: one.width * one.height };
    },
    { first: a.toString('base64'), second: b.toString('base64'), tolerance: CHANNEL_TOLERANCE },
  );
}

/** Wait until nothing is moving: two frames for the effects to start, then every animation finished. */
async function still(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            done();
          });
        });
      }),
  );
  // An animation that does not finish is a finding, not a reason to wait for the end of the test.
  const unfinished = await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
      ).then(() => ''),
      new Promise<string>((late) => {
        setTimeout(() => {
          late(
            JSON.stringify(
              document.getAnimations().map((a) => [a.playState, a.pending, a.currentTime]),
            ) + document.visibilityState,
          );
        }, 8000);
      }),
    ]),
  );
  expect(unfinished, 'animations that never finished').toBe('');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The window of the show, at 1920 x 1080: one slide, no hint. */
async function openShow(context: BrowserContext): Promise<Page> {
  const show = await context.newPage();
  await show.setViewportSize({ width: 1920, height: 1080 });
  await show.goto(`/#/show/${DECK}/single`);
  await show.addStyleTag({ content: '.audience-hint { display: none !important; }' });
  return show;
}

/** The editor, with a canvas large enough to draw the slide at 1920 wide. */
async function openEditor(context: BrowserContext): Promise<Page> {
  const editor = await context.newPage();
  await editor.setViewportSize({ width: 3000, height: 1700 });
  await editor.goto(`/#/deck/${DECK}`);
  await editor.addStyleTag({ content: '.slide-frame { width: 1920px !important; }' });
  return editor;
}

/** Go to a slide of the page, then play `click` clicks. */
async function pageTo(page: Page, slide: number, click: number): Promise<void> {
  const root = page.locator('#cue-root');
  await page.keyboard.press('Home');
  if (slide > 0) {
    for (const digit of String(slide + 1)) await page.keyboard.press(digit);
    await page.keyboard.press('Enter');
  }
  await expect(root).toHaveAttribute('data-slide', String(slide + 1));
  for (let played = 1; played <= click; played += 1) {
    await page.keyboard.press('Space');
    await expect(root).toHaveAttribute('data-click', String(played));
    await still(page);
  }
  await pageSettled(page);
  await still(page);
}

/** Go to a slide of the show, then play `click` clicks. */
async function showTo(show: Page, deck: Deck, slide: number, click: number): Promise<void> {
  await show.keyboard.press('Home');
  if (slide > 0) {
    for (const digit of String(slide + 1)) await show.keyboard.press(digit);
    await show.keyboard.press('Enter');
  }
  await expect(showSettled(show, deck.slides[slide]?.id ?? '')).toHaveCount(1);
  for (let played = 1; played <= click; played += 1) {
    await show.keyboard.press('Space');
    await still(show);
  }
  await still(show);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const decks: { name: string; json: () => Json; picture: boolean }[] = [
  { name: 'Autumn Launch with a picture', json: autumnLaunch, picture: true },
  { name: 'the awkward deck', json: awkwardDeck, picture: false },
];

for (const { name, json, picture } of decks) {
  test(`Given ${name}, When each slide and click is drawn in the editor, the audience window and the exported page, Then everything is where the editor has it, opacity included (SV-5, TR-3)`, async ({
    page,
    browser,
  }, info) => {
    const deck = parseDeck(JSON.parse(JSON.stringify(json())));
    await seedDeck(page, json(), DECK);
    if (picture) {
      await page
        .locator('input[type="file"]')
        .setInputFiles([pictureFile('logo.png', 'image/png', png(120, 80))]);
      await expect(page.locator('.slide-frame [data-kind="image"]')).toHaveCount(1);
      await expect(page.getByText('Saved', { exact: true })).toBeVisible();
      await page.waitForTimeout(800);
    }
    // The deck as it is in the store now (it has the picture), for the slides' ids and steps.
    const path = await exportPage(page, info.outputPath('fidelity.html'));
    const exported = await openPage(browser, path, { viewport: { width: 1920, height: 1080 } });
    await exported.page.addStyleTag({ content: '.cp-bar { display: none !important; }' });
    // The editor tab lets go of the deck, so that the editor below can take it (one tab per deck, SV-7).
    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: /Your decks/ })).toBeVisible();
    const helper = await page.context().newPage();
    await helper.goto('about:blank');

    const problems: string[] = [];
    const counts = { states: 0, worst: 0 };
    const surface = {
      page: '.cp-frame .cue-slide',
      show: '.audience .cue-slide',
      editor: '.slide-frame .cue-slide',
    };
    // A clip of the slide's own box: no wait for the element to hold still, which WebKit never saw.
    const shoot = async (view: Page, selector: string) => {
      const box = await view.locator(selector).boundingBox();
      if (!box) throw new Error(`no slide at ${selector}`);
      return view.screenshot({ clip: box });
    };

    // The editor first, and then let it go: it draws each slide as it opens (animated things faded, which
    // a show does not), so it is compared where the slide has nothing animated.
    const editor = await openEditor(page.context());
    const inEditor: Measured[] = [];
    const editorShots = new Map<number, Buffer>();
    for (const [index, slide] of deck.slides.entries()) {
      await editor.getByRole('option', { name: `Slide ${String(index + 1)}`, exact: true }).click();
      await expect(editor.locator(`${surface.editor}[data-slide-id="${slide.id}"]`)).toHaveCount(1);
      await still(editor);
      inEditor.push(await editor.evaluate(measure, surface.editor));
      if (slide.animations.length === 0)
        editorShots.set(index, await shoot(editor, surface.editor));
    }
    await editor.close();

    const show = await openShow(page.context());
    for (const [index, slide] of deck.slides.entries()) {
      for (let click = 0; click <= clickCount(slide); click += 1) {
        const where = `${name}, slide ${String(index + 1)}, click ${String(click)}`;
        await pageTo(exported.page, index, click);
        await showTo(show, deck, index, click);
        const inPage = await exported.page.evaluate(measure, surface.page);
        const inShow = await show.evaluate(measure, surface.show);
        counts.states += 1;

        problems.push(...differences(`${where} (audience / page)`, inShow, inPage));
        const fromEditor = inEditor[index];
        if (click === 0 && fromEditor) {
          problems.push(...differences(`${where} (editor / page)`, fromEditor, inPage));
        }

        const fromPage = await shoot(exported.page, surface.page);
        const fromShow = await shoot(show, surface.show);
        const apart = await pixelsApart(helper, fromShow, fromPage);
        counts.worst = Math.max(counts.worst, apart.apart / apart.total);
        if (apart.apart / apart.total > PIXEL_SHARE) {
          problems.push(
            `${where}: ${String(apart.apart)} of ${String(apart.total)} pixels differ (audience / page)`,
          );
        }
        const editorShot = editorShots.get(index);
        if (click === 0 && editorShot) {
          const against = await pixelsApart(helper, editorShot, fromPage);
          if (against.apart / against.total > PIXEL_SHARE) {
            problems.push(
              `${where}: ${String(against.apart)} of ${String(against.total)} pixels differ (editor / page)`,
            );
          }
        }
      }
    }
    console.info(
      `[fidelity] ${name}: ${String(counts.states)} states in three renderers, at most ${String(Math.round(counts.worst * 100000) / 1000)}% of pixels apart`,
    );
    expect(problems).toEqual([]);
    expect(counts.states).toBeGreaterThan(deck.slides.length);
    await exported.close();
  });
}

// SV-5, the second criterion: saving a deck to a file, opening it and saving it again gives the same deck.
test('Given a deck saved to a file, When the file is opened and saved again, Then it is the same deck, with the same pictures', async ({
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

  const exportFile = async (where: Page, path: string) => {
    await where.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = where.getByRole('dialog', { name: 'Export deck' });
    await dialog.getByRole('radio', { name: /Editable deck file/ }).click();
    const button = dialog.getByRole('button', { name: 'Export deck file' });
    await expect(button).toBeEnabled();
    const download = where.waitForEvent('download');
    await button.click();
    await (await download).saveAs(path);
    return path;
  };
  const first = await exportFile(page, info.outputPath('first.slides'));

  const elsewhere = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const other = await elsewhere.newPage();
  await other.goto('/');
  await other.getByLabel('Deck file').setInputFiles(first);
  await expect(other.getByRole('option', { name: 'Slide 12', exact: true })).toBeVisible();
  await expect(other.locator('.slide-frame [data-kind="image"] img')).toHaveCount(1);
  const second = await exportFile(other, info.outputPath('second.slides'));
  await elsewhere.close();

  const read = (path: string) => unzipSync(readFileSync(path));
  const one = read(first);
  const two = read(second);
  const deckOf = (files: Record<string, Uint8Array>): Record<string, unknown> => {
    const manifest: unknown = JSON.parse(strFromU8(files['deck.json'] ?? new Uint8Array()));
    const deck: unknown = isRecord(manifest) ? manifest.deck : undefined;
    if (!isRecord(deck)) throw new Error('the file has no deck');
    return deck;
  };
  const { id: idOne, createdAt: createdOne, updatedAt: updatedOne, ...sameOne } = deckOf(one);
  const { id: idTwo, createdAt: createdTwo, updatedAt: updatedTwo, ...sameTwo } = deckOf(two);
  // Opening makes a new deck (a new id and time); everything else of the deck is the same.
  expect(idTwo).not.toBe(idOne);
  expect(typeof createdOne === 'number' && typeof createdTwo === 'number').toBe(true);
  expect(typeof updatedOne === 'number' && typeof updatedTwo === 'number').toBe(true);
  expect(sameTwo).toEqual(sameOne);
  // The same pictures, the same fonts, byte for byte.
  expect(Object.keys(two).sort()).toEqual(Object.keys(one).sort());
  for (const name of Object.keys(one).filter((file) => file !== 'deck.json')) {
    expect(Buffer.from(two[name] ?? []).equals(Buffer.from(one[name] ?? []))).toBe(true);
  }
});
