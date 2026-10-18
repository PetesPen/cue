import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { clickCount, forward, parseDeck, startShow, type ShowPlace } from '../src/model';
import { autumnLaunch } from '../tests/fixtures/autumnLaunch';
import { exportPage, openPage, settled, type Watched } from './support/exported';
import { pictureFile, png } from './support/pictures';
import { seedDeck } from './support/seed';

// Sprint 10: the standalone web page (SV-4). A deck is exported through the dialog and the file is
// opened from disk in a browser with no network, which refuses any request but the file itself.

test.use({ viewport: { width: 1440, height: 900 } });
test.slow();

const DECK = 'autumn-launch';

/** Autumn Launch with a picture on its first slide, ready in the editor. */
async function openAutumnWithPicture(page: Page): Promise<void> {
  await seedDeck(page, autumnLaunch(), DECK);
  await page
    .locator('input[type="file"]')
    .setInputFiles([pictureFile('logo.png', 'image/png', png(120, 80))]);
  await expect(page.locator('.slide-frame [data-kind="image"]')).toHaveCount(1);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.waitForTimeout(800);
}

const placeOf = async (opened: Watched): Promise<ShowPlace> => ({
  slide: Number(await opened.root.getAttribute('data-slide')) - 1,
  click: Number(await opened.root.getAttribute('data-click')),
  blank: 'none',
});

/** Nothing outside the file was asked for, nothing was logged, and the policy had nothing to refuse. */
async function expectQuiet(opened: Watched): Promise<void> {
  // The file, and what is made from it (`data:` and `blob:`), are not the network.
  expect(opened.requests.filter((url) => /^(https?|wss?|ftp):/.test(url))).toEqual([]);
  expect(opened.errors).toEqual([]);
  expect(await opened.violations()).toEqual([]);
}

test.describe('Given Autumn Launch exported as a web page and opened with the network off (SV-4)', () => {
  test('Then every slide and click plays, as the show plays them, and nothing outside the file is asked for', async ({
    page,
    browser,
  }, info) => {
    await openAutumnWithPicture(page);
    const path = await exportPage(page, info.outputPath('autumn.html'));
    const deck = parseDeck(autumnLaunch());

    const opened = await openPage(browser, path);
    await expect(opened.page).toHaveTitle('Autumn Launch');
    await expect(opened.root.locator('.cp-count')).toHaveText('1 / 12');

    // The picture is drawn, from the file, and so is the font that is only in the file.
    await expect
      .poll(() =>
        opened.page.evaluate(
          () => document.querySelector<HTMLImageElement>('.cue-image')?.naturalWidth ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        opened.page.evaluate(() =>
          document.fonts.ready.then(() =>
            [...document.fonts]
              .filter((face) => face.status === 'loaded')
              .map((face) => face.family),
          ),
        ),
      )
      .toContain('Instrument Sans');

    // From the first slide to the last, one press at a time, in the order the show has.
    let expected = startShow(deck);
    const total = deck.slides.reduce(
      (sum, slide) => sum + clickCount(slide),
      deck.slides.length - 1,
    );
    for (let press = 0; press < total; press += 1) {
      expected = forward(deck, expected);
      await opened.page.keyboard.press('ArrowRight');
      await expect(opened.root).toHaveAttribute('data-slide', String(expected.slide + 1));
      await expect(opened.root).toHaveAttribute('data-click', String(expected.click));
      await settled(opened.page);
      // Every element of the slide is drawn.
      await expect(opened.page.locator('.cue-layer .cue-element')).toHaveCount(
        deck.slides[expected.slide]?.elements.length ?? 0,
      );
    }
    expect(expected.slide).toBe(11);
    // At the end, one more press stays.
    await opened.page.keyboard.press('ArrowRight');
    expect((await placeOf(opened)).slide).toBe(11);

    await expectQuiet(opened);
    await opened.close();
  });

  test('Then the keys of the show work: back, Home, End, a number, blank and white, and the key list', async ({
    page,
    browser,
  }, info) => {
    await openAutumnWithPicture(page);
    const path = await exportPage(page, info.outputPath('keys.html'));
    const opened = await openPage(browser, path);
    const key = (name: string) => opened.page.keyboard.press(name);

    await key('End');
    await expect(opened.root).toHaveAttribute('data-slide', '12');
    await key('ArrowLeft');
    // Back shows the slide before as it was left, every click played.
    await expect(opened.root).toHaveAttribute('data-slide', '11');
    await key('Home');
    await expect(opened.root).toHaveAttribute('data-slide', '1');
    await key('3');
    await key('Enter');
    await expect(opened.root).toHaveAttribute('data-slide', '3');
    await expect(opened.root).toHaveAttribute('data-click', '0');
    // Slide 3 has three clicks; they play before the page moves on.
    await key('Space');
    await key('Space');
    await expect(opened.root).toHaveAttribute('data-click', '2');
    await key('Backspace');
    await expect(opened.root).toHaveAttribute('data-click', '1');

    await key('b');
    await expect(opened.root).toHaveAttribute('data-blank', 'black');
    await expect(opened.page.locator('.cp-blank')).toBeVisible();
    await key('w');
    await expect(opened.root).toHaveAttribute('data-blank', 'white');
    await key('ArrowRight');
    await expect(opened.root).toHaveAttribute('data-blank', 'none');
    await expect(opened.root).toHaveAttribute('data-click', '1');

    await key('?');
    await expect(opened.page.getByRole('dialog', { name: 'Keyboard and touch' })).toBeVisible();
    await expect(opened.page.getByText('Go to a slide: type its number, then Enter')).toBeVisible();
    await key('Escape');
    await expect(opened.page.getByRole('dialog')).toHaveCount(0);

    await expectQuiet(opened);
    await opened.close();
  });

  test('Then the notes show on N beside the slide, with where the show is and what comes next', async ({
    page,
    browser,
  }, info) => {
    await openAutumnWithPicture(page);
    const path = await exportPage(page, info.outputPath('notes.html'));
    const opened = await openPage(browser, path, { hash: '#3' });
    await expect(opened.root).toHaveAttribute('data-slide', '3');

    await opened.page.keyboard.press('n');
    const notes = opened.page.getByRole('complementary', { name: 'Speaker notes' });
    await expect(notes).toBeVisible();
    await expect(notes).toContainText('Notes · Slide 3 of 12');
    await expect(notes).toContainText('Open with the customer problem');
    await expect(notes).toContainText('Next · Click 1 of 3');
    // The slide is still all there, beside the notes.
    const frame = await opened.page.locator('.cp-frame').boundingBox();
    expect(frame?.width ?? 0).toBeGreaterThan(600);
    await opened.page.keyboard.press('Space');
    await expect(notes).toContainText('Next · Click 2 of 3');
    await opened.page.keyboard.press('n');
    await expect(notes).toBeHidden();
    await opened.close();
  });

  test('Then, without "Include speaker notes", the file has no notes at all and the page has no Notes button', async ({
    page,
    browser,
  }, info) => {
    await openAutumnWithPicture(page);
    const path = await exportPage(page, info.outputPath('quiet.html'), { notes: false });
    // Not a word of them is in the file.
    const text = readFileSync(path, 'utf8');
    expect(text).not.toContain('Open with the customer problem');
    expect(text).toContain('data-cue-notes="none"');

    const opened = await openPage(browser, path);
    await expect(opened.page.getByRole('button', { name: 'Notes' })).toBeHidden();
    await opened.page.keyboard.press('n');
    await expect(opened.page.getByRole('complementary')).toBeHidden();
    await opened.close();
  });

  test('Then the file has the fonts it uses with their licences, and no others', async ({
    page,
  }, info) => {
    await openAutumnWithPicture(page);
    const path = await exportPage(page, info.outputPath('licences.html'));
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('Instrument Sans');
    expect(text).toContain('SIL OPEN FONT LICENSE');
    const faces = (text.match(/@font-face[^}]*}/g) ?? []).join(' ');
    expect(faces).toContain("font-family: 'Instrument Sans'");
    expect(faces).not.toContain('Caveat');
    expect(faces).not.toContain('JetBrains Mono');
    const licences = /id="cue-licences">([^<]*)</.exec(text)?.[1] ?? '';
    expect(licences).toContain('Instrument Sans');
    expect(licences).not.toContain('Caveat');
    expect(text).toContain("default-src 'none'");
  });
});

test.describe('Given the page in windows of different sizes (SV-4)', () => {
  test('Then the slide fits at 16:9 on a desktop, a laptop and a phone, and the bar is there', async ({
    page,
    browser,
  }, info) => {
    await openAutumnWithPicture(page);
    const path = await exportPage(page, info.outputPath('sizes.html'));

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 600 },
      { width: 390, height: 844 },
    ]) {
      const opened = await openPage(browser, path, { viewport });
      await settled(opened.page);
      const frame = await opened.page.locator('.cp-frame').boundingBox();
      expect(frame).not.toBeNull();
      const { width, height } = frame ?? { width: 0, height: 1 };
      expect(width / height).toBeCloseTo(16 / 9, 1);
      expect(width).toBeLessThanOrEqual(viewport.width + 1);
      expect(height).toBeLessThanOrEqual(viewport.height + 1);
      // The slide is drawn at the size of its frame.
      const slide = await opened.page.locator('.cue-slide').first().boundingBox();
      expect(Math.abs((slide?.width ?? 0) - width)).toBeLessThan(2);
      await expect(opened.page.getByRole('navigation', { name: 'Slide controls' })).toBeVisible();
      await opened.close();
    }
  });

  test('Then a tap on the right of the slide moves on and a tap on the left goes back (a touch screen)', async ({
    page,
    browser,
  }, info) => {
    await openAutumnWithPicture(page);
    const path = await exportPage(page, info.outputPath('touch.html'));
    const opened = await openPage(browser, path, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const area = await opened.page.locator('.cp-area').boundingBox();
    if (!area) throw new Error('no slide area');
    const high = area.y + 40;

    await opened.page.touchscreen.tap(area.x + area.width * 0.85, high);
    await expect(opened.root).toHaveAttribute('data-slide', '2');
    await opened.page.touchscreen.tap(area.x + area.width * 0.1, high);
    await expect(opened.root).toHaveAttribute('data-slide', '1');
    await expectQuiet(opened);
    await opened.close();
  });
});

test.describe('Given a deck whose text tries to break out of the page (SV-4)', () => {
  test('Then the page holds it as text: nothing runs, and the title and notes read back exactly', async ({
    page,
    browser,
  }, info) => {
    const nasty = '</script><script>window.__ran = true</script><!-- "quotes" & <b>markup</b>';
    const deck = autumnLaunch();
    Reflect.set(deck, 'title', nasty);
    const slides = Reflect.get(deck, 'slides');
    const first: unknown = Array.isArray(slides) ? slides[0] : undefined;
    if (typeof first === 'object' && first !== null) Reflect.set(first, 'notes', nasty);
    await seedDeck(page, deck, DECK);
    const path = await exportPage(page, info.outputPath('nasty.html'));

    const opened = await openPage(browser, path);
    await expect(opened.page).toHaveTitle(nasty);
    expect(await opened.page.evaluate(() => '__ran' in window)).toBe(false);
    await opened.page.keyboard.press('n');
    await expect(opened.page.getByRole('region', { name: 'Notes text' })).toHaveText(nasty);
    await expectQuiet(opened);
    await opened.close();
  });
});

test.describe('Given the page (SV-4)', () => {
  test('Then axe finds nothing on the slide, with the notes open, and with the key list open', async ({
    page,
    browser,
  }, info) => {
    await openAutumnWithPicture(page);
    const path = await exportPage(page, info.outputPath('axe.html'));
    const opened = await openPage(browser, path);
    await settled(opened.page);

    // The bar is shown: it appears when something moves, and the page starts with it.
    await opened.page.mouse.move(400, 400);
    await expect(opened.root).toHaveAttribute('data-bar', 'shown');
    expect((await new AxeBuilder({ page: opened.page }).analyze()).violations).toEqual([]);

    await opened.page.keyboard.press('n');
    await expect(opened.page.getByRole('complementary')).toBeVisible();
    expect((await new AxeBuilder({ page: opened.page }).analyze()).violations).toEqual([]);

    await opened.page.keyboard.press('?');
    await expect(opened.page.getByRole('dialog')).toBeVisible();
    expect((await new AxeBuilder({ page: opened.page }).analyze()).violations).toEqual([]);
    await opened.close();
  });

  test('Then the Export dialog has no accessibility violations', async ({ page }) => {
    await openAutumnWithPicture(page);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export deck' });
    await expect(dialog.getByRole('button', { name: 'Export web page' })).toBeEnabled();
    expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  });
});
