import { strToU8, unzipSync, zipSync } from 'fflate';
import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { createImage, parseDeck, type Deck } from '@/model';
import { packDeck, unpackDeck } from '@/storage/deckFile';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore, deckWithSlides } from './test-helpers';

afterEach(() => {
  closeTestStores();
  vi.restoreAllMocks();
  window.location.hash = '';
});

// SV-3: save a deck to a file, open a file, and what is shown when it cannot be.

const fileOf = (deck: Deck, name = `${deck.title}.slides`) =>
  new File(
    [new Uint8Array(packDeck({ deck, images: [], originals: [], fonts: [] }, Date.now()))],
    name,
  );

async function openLibrary(store: DeckStore) {
  window.location.hash = '#/';
  return render(<EditorApp store={store} />);
}

async function openEditor(store: DeckStore, deck: Deck) {
  await store.save(deck);
  window.location.hash = `#/deck/${deck.id}`;
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  return screen;
}

/** Catch what the page hands to the browser to save, and read it back. */
function catchDownloads() {
  const taken: { name: string; href: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    taken.push({ name: this.download, href: this.href });
  });
  return {
    taken,
    async read(at = 0) {
      const found = taken[at];
      if (!found) throw new Error('nothing was downloaded');
      return new Uint8Array(await (await fetch(found.href)).arrayBuffer());
    },
  };
}

const chooseFile = (screen: Awaited<ReturnType<typeof openLibrary>>) =>
  screen.getByLabelText('Deck file').element();

test('Given the library, Then Open file is beside New deck, and in the empty state', async () => {
  const screen = await openLibrary(createTestStore());

  await expect.element(screen.getByRole('button', { name: 'Open file' }).first()).toBeVisible();
  await expect.element(screen.getByRole('heading', { name: 'No decks yet' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Open file' }).elements()).toHaveLength(2);
});

test('Given a deck file, When it is chosen, Then the deck is added as a new deck and opened', async () => {
  const store = createTestStore();
  const screen = await openLibrary(store);
  const source: Deck = { ...deckWithSlides(3, 'Imported deck'), id: 'from-file' };

  await userEvent.upload(chooseFile(screen), fileOf(source));

  await expect.poll(() => window.location.hash, { timeout: 5000 }).toMatch(/^#\/deck\//);
  const [added] = await store.list();
  expect(added?.title).toBe('Imported deck');
  expect(added?.slideCount).toBe(3);
  expect(added?.id).not.toBe('from-file');
  expect(window.location.hash).toBe(`#/deck/${added?.id ?? ''}`);
});

test('Given a deck already in the library, When a file with the same deck id is opened, Then both decks are there', async () => {
  const store = createTestStore();
  await store.save({ ...deckWithSlides(1, 'Already here'), id: 'same' });
  const screen = await openLibrary(store);

  await userEvent.upload(
    chooseFile(screen),
    fileOf({ ...deckWithSlides(2, 'Same id'), id: 'same' }),
  );

  await expect.poll(async () => (await store.list()).length, { timeout: 5000 }).toBe(2);
  expect((await store.load('same'))?.title).toBe('Already here');
});

test('Given a file that is not a deck, When it is chosen, Then a clear message is shown and nothing changes', async () => {
  const store = createTestStore();
  await store.save(deckWithSlides(1, 'Mine'));
  const screen = await openLibrary(store);
  await expect.element(screen.getByText('Mine')).toBeVisible();

  await userEvent.upload(chooseFile(screen), new File(['not a deck at all'], 'notes.slides'));

  await expect.element(screen.getByRole('alert')).toBeVisible();
  await expect.element(screen.getByText('This file couldn’t be opened')).toBeVisible();
  await expect
    .element(
      screen.getByText(
        /It may be damaged, or it wasn’t made with Cue\. Your decks are untouched\./,
      ),
    )
    .toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Choose another file' })).toBeVisible();
  expect((await store.list()).map((d) => d.title)).toEqual(['Mine']);
  expect(window.location.hash).toBe('#/');
  await screen.getByRole('button', { name: 'Dismiss' }).click();
  await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
});

test('Given a file from a newer Cue, When it is chosen, Then it says a newer version is needed', async () => {
  const store = createTestStore();
  const screen = await openLibrary(store);
  // A file whose deck was made by a newer schema than this Cue knows.
  const { zipSync, strToU8 } = await import('fflate');
  const manifest = {
    format: 'cue-deck',
    formatVersion: 1,
    savedAt: 1,
    deck: { ...deckWithSlides(1, 'From the future'), schemaVersion: 99 },
    images: [],
    originals: [],
    fonts: [],
  };
  const file = new File(
    [new Uint8Array(zipSync({ 'deck.json': strToU8(JSON.stringify(manifest)) }))],
    'x.slides',
  );

  await userEvent.upload(chooseFile(screen), file);

  await expect.element(screen.getByText('This deck needs a newer version of Cue')).toBeVisible();
  expect(await store.list()).toEqual([]);
});

test('Given a deck card, When Export… is chosen, Then the dialog offers the page and the deck file, and Export deck file saves the file', async () => {
  const store = createTestStore();
  await store.save({ ...deckWithSlides(2, 'Team offsite'), id: 'a' });
  const downloads = catchDownloads();
  const screen = await openLibrary(store);

  await screen.getByRole('button', { name: 'Options for Team offsite' }).click();
  await screen.getByRole('menuitem', { name: 'Export…' }).click();

  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByText('Team offsite · 2 slides')).toBeVisible();
  await expect.element(dialog.getByText('Coming later')).toBeVisible();
  await expect.element(dialog.getByText('Made on your device. Nothing is uploaded.')).toBeVisible();
  await expect.element(dialog.getByRole('radio', { name: /Standalone web page/ })).toBeChecked();
  await expect.element(dialog.getByRole('radio', { name: /PDF or images/ })).toBeDisabled();
  await dialog.getByRole('radio', { name: /Editable deck file/ }).click();
  await expect.element(dialog.getByText(/\.slides · about/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Export deck file' }).click();

  expect(downloads.taken.map((d) => d.name)).toEqual(['Team offsite.slides']);
  const opened = await unpackDeck(await downloads.read());
  expect(opened.deck.title).toBe('Team offsite');
  expect(opened.deck.slides).toHaveLength(2);
  await expect.element(dialog).not.toBeInTheDocument();
});

test('Given the Export dialog, When Cancel is pressed, Then nothing is saved', async () => {
  const store = createTestStore();
  await store.save({ ...deckWithSlides(1, 'Team offsite'), id: 'a' });
  const downloads = catchDownloads();
  const screen = await openLibrary(store);
  await screen.getByRole('button', { name: 'Options for Team offsite' }).click();
  await screen.getByRole('menuitem', { name: 'Export…' }).click();
  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await expect.element(dialog.getByText(/.html · about/)).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  expect(downloads.taken).toEqual([]);
});

test('Given a deck that cannot be read, When the library opens, Then it is a card that says so, the others are listed, and Delete removes it', async () => {
  const store = createTestStore();
  await store.save(deckWithSlides(1, 'Readable'));
  const future = deckWithSlides(1, 'From the future', 'future');
  Reflect.set(future, 'schemaVersion', 99);
  await store.save(future);
  const screen = await openLibrary(store);

  await expect.element(screen.getByText('Readable')).toBeVisible();
  await expect.element(screen.getByText('From the future')).toBeVisible();
  await expect.element(screen.getByText(/Saved by a newer version of Cue/)).toBeVisible();
  await screen.getByRole('button', { name: 'Options for From the future' }).click();
  await screen.getByRole('menuitem', { name: 'Delete' }).click();
  await expect
    .element(screen.getByText(/Export a copy first if you might want it back/))
    .toBeVisible();
  await screen.getByRole('button', { name: 'Delete deck' }).click();

  await expect.element(screen.getByText('From the future')).not.toBeInTheDocument();
  expect((await store.list()).map((d) => d.title)).toEqual(['Readable']);
  expect(await store.listUnreadable()).toEqual([]);
});

test('Given the editor, When Export is pressed, Then the dialog opens, and the file holds the notes just typed', async () => {
  const store = createTestStore();
  const downloads = catchDownloads();
  const screen = await openEditor(store, deckWithSlides(2, 'Q3 review'));
  await screen.getByRole('textbox', { name: /notes/i }).fill('Say hello first');

  await screen.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await dialog.getByRole('radio', { name: /Editable deck file/ }).click();
  await expect.element(dialog.getByText(/\.slides · about/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Export deck file' }).click();

  const opened = await unpackDeck(await downloads.read());
  expect(opened.deck.slides[0]?.notes).toBe('Say hello first');
  expect(downloads.taken[0]?.name).toBe('Q3 review.slides');
});

test('Given the editor, When Ctrl+E is pressed, Then the Export dialog opens, and Esc closes it', async () => {
  const screen = await openEditor(createTestStore(), deckWithSlides(1, 'Q3 review'));

  await userEvent.keyboard('{Control>}e{/Control}');

  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await expect.element(dialog).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();
});

test('Given a save that fails, When the banner shows, Then it offers Export deck, which makes the file from the deck in the tab', async () => {
  const real = createTestStore();
  const store: DeckStore = { ...real, save: () => Promise.reject(new Error('full')) };
  await real.save(deckWithSlides(1, 'Unsaved work'));
  const downloads = catchDownloads();
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Add slide' }).click();
  await expect
    .element(screen.getByText('Changes can’t be saved.'), { timeout: 4000 })
    .toBeVisible();

  await screen.getByRole('button', { name: 'Export deck', exact: true }).first().click();
  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await dialog.getByRole('radio', { name: /Editable deck file/ }).click();
  await expect.element(dialog.getByText(/\.slides · about/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Export deck file' }).click();

  // The file holds the added slide, which the store never got.
  expect((await unpackDeck(await downloads.read())).deck.slides).toHaveLength(2);
  expect((await real.load('deck'))?.slides).toHaveLength(1);
});

// SV-4: the standalone web page, from the same dialog.

/** The deck a page holds, read back from the text of the file. */
function deckInPage(page: string): Deck {
  const block = /id="cue-deck">([\s\S]*?)<\/script>/.exec(page)?.[1] ?? '';
  return parseDeck(JSON.parse(block));
}

const text = async (downloads: ReturnType<typeof catchDownloads>, at = 0) =>
  new TextDecoder().decode(await downloads.read(at));

test('Given a deck card, When Export… is chosen, Then the web page is chosen first, with its size, and Export web page saves it', async () => {
  const store = createTestStore();
  await store.save({ ...deckWithSlides(2, 'Team offsite'), id: 'a' });
  const downloads = catchDownloads();
  const screen = await openLibrary(store);

  await screen.getByRole('button', { name: 'Options for Team offsite' }).click();
  await screen.getByRole('menuitem', { name: 'Export…' }).click();

  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await expect.element(dialog.getByText(/\.html · about/)).toBeVisible();
  await expect
    .element(dialog.getByRole('checkbox', { name: /Include speaker notes/ }))
    .toBeChecked();
  await expect.element(dialog.getByText(/Pictures and fonts are included/)).toBeVisible();
  // The other file's size is a guess from the pictures until it is chosen.
  await expect.element(dialog.getByText(/\.slides · about/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Export web page' }).click();

  expect(downloads.taken.map((d) => d.name)).toEqual(['Team offsite.html']);
  const page = await text(downloads);
  expect(page.startsWith('<!doctype html>')).toBe(true);
  expect(page).toContain('Content-Security-Policy');
  expect(deckInPage(page).slides).toHaveLength(2);
  expect(deckInPage(page).title).toBe('Team offsite');
  await expect.element(dialog).not.toBeInTheDocument();
});

test('Given the editor, When the notes are typed and the page is made, Then the page holds them; and without "Include speaker notes", not a word', async () => {
  const store = createTestStore();
  const downloads = catchDownloads();
  const screen = await openEditor(store, deckWithSlides(2, 'Q3 review'));
  await screen.getByRole('textbox', { name: /notes/i }).fill('Say hello first');

  await screen.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await expect.element(dialog.getByText(/\.html · about/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Export web page' }).click();
  const withNotes = await text(downloads, 0);
  expect(deckInPage(withNotes).slides[0]?.notes).toBe('Say hello first');
  expect(withNotes).toContain('data-cue-notes="included"');

  await screen.getByRole('button', { name: 'Export', exact: true }).click();
  const again = screen.getByRole('dialog', { name: 'Export deck' });
  await again.getByRole('checkbox', { name: /Include speaker notes/ }).click();
  await expect.element(again.getByText(/\.html · about/)).toBeVisible();
  await again.getByRole('button', { name: 'Export web page' }).click();
  const without = await text(downloads, 1);
  expect(without).not.toContain('Say hello first');
  expect(without).toContain('data-cue-notes="none"');
  expect(deckInPage(without).slides[0]?.notes).toBe('');
});

test('Given a deck with a picture the store cannot give, When the page is made, Then the dialog says which slide, and nothing is saved', async () => {
  const store = createTestStore();
  const deck = deckWithSlides(2, 'Broken');
  const picture = createImage('pic', 'missing-hash', { x: 0, y: 0, width: 400, height: 300 });
  const withPicture: Deck = {
    ...deck,
    slides: deck.slides.map((slide, index) =>
      index === 1 ? { ...slide, elements: [picture] } : slide,
    ),
  };
  await store.save(withPicture);
  const downloads = catchDownloads();
  const screen = await openLibrary(store);
  await screen.getByRole('button', { name: 'Options for Broken' }).click();
  await screen.getByRole('menuitem', { name: 'Export…' }).click();

  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await expect
    .element(
      dialog.getByRole('alert').getByText(/The picture on slide 2 can’t be read from this browser/),
    )
    .toBeVisible();
  await expect.element(dialog.getByRole('button', { name: 'Export web page' })).toBeDisabled();
  expect(downloads.taken).toEqual([]);
  expect((await store.load(deck.id))?.slides).toHaveLength(2);
});

test('Given a save that fails, When the page is made, Then it is made from the deck in the tab', async () => {
  const real = createTestStore();
  const store: DeckStore = { ...real, save: () => Promise.reject(new Error('full')) };
  await real.save(deckWithSlides(1, 'Unsaved work'));
  const downloads = catchDownloads();
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Add slide' }).click();
  await expect
    .element(screen.getByText('Changes can’t be saved.'), { timeout: 4000 })
    .toBeVisible();

  await screen.getByRole('button', { name: 'Export deck', exact: true }).first().click();
  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await expect.element(dialog.getByText(/\.html · about/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Export web page' }).click();

  expect(deckInPage(await text(downloads)).slides).toHaveLength(2);
});

test('Given storage nearly full, When the editor opens, Then the banner says to back up, and offers Export deck', async () => {
  vi.spyOn(navigator.storage, 'estimate').mockResolvedValue({ usage: 0.9e9, quota: 1e9 });
  const screen = await openEditor(createTestStore(), deckWithSlides(1));

  await expect.element(screen.getByText(/Back up your decks, then delete/)).toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: 'Export deck', exact: true }))
    .toBeVisible();
});

// SV-8: back up all decks, and the reminder to do it.

const DAY = 24 * 60 * 60 * 1000;

/** A deck made `madeDaysAgo` days ago and last edited `editedDaysAgo` days ago. */
const agedDeck = (
  title: string,
  id: string,
  madeDaysAgo: number,
  editedDaysAgo = madeDaysAgo,
): Deck => ({
  ...deckWithSlides(2, title, id),
  createdAt: Date.now() - madeDaysAgo * DAY,
  updatedAt: Date.now() - editedDaysAgo * DAY,
});

test('Given decks never backed up and one made 20 days ago, When the library opens, Then the reminder says so, and Back up all decks saves every deck in one file and clears it', async () => {
  const store = createTestStore();
  await store.save(agedDeck('Old talk', 'old', 20));
  await store.save(agedDeck('New talk', 'new', 1));
  const downloads = catchDownloads();
  const screen = await openLibrary(store);

  await expect.element(screen.getByText('Your decks live only in this browser.')).toBeVisible();
  await expect.element(screen.getByText(/You haven’t backed them up yet/)).toBeVisible();
  await screen.getByRole('button', { name: 'Back up all decks' }).first().click();

  await expect.element(screen.getByText('Backed up 2 decks.')).toBeVisible();
  expect(downloads.taken).toHaveLength(1);
  expect(downloads.taken[0]?.name).toMatch(/^Cue backup \d{4}-\d{2}-\d{2}\.zip$/);
  const files = unzipSync(await downloads.read());
  expect(Object.keys(files).sort()).toEqual([
    'backup.json',
    'decks/New talk.slides',
    'decks/Old talk.slides',
  ]);
  // Every deck is now in a file: nothing is left to remind of.
  await expect
    .element(screen.getByText('Your decks live only in this browser.'))
    .not.toBeInTheDocument();
  expect(Object.keys(await store.listFiled()).sort()).toEqual(['new', 'old']);
  // And nothing in the library changed.
  expect((await store.list()).map((one) => one.title).sort()).toEqual(['New talk', 'Old talk']);
});

test('Given a deck backed up 20 days ago and edited since, When the library opens, Then the reminder counts the days from the backup', async () => {
  const store = createTestStore();
  await store.save(agedDeck('Edited since', 'a', 60, 2));
  await store.markFiled(['a'], Date.now() - 20 * DAY);
  const screen = await openLibrary(store);

  await expect
    .element(screen.getByText(/It has been 20 days since your last backup/))
    .toBeVisible();
});

test('Given decks made today, or filed and not edited since, When the library opens, Then there is no reminder', async () => {
  const store = createTestStore();
  await store.save(agedDeck('Today', 'today', 0));
  await store.save(agedDeck('Filed', 'filed', 90, 40));
  await store.markFiled(['filed'], Date.now() - 20 * DAY);
  const screen = await openLibrary(store);

  await expect.element(screen.getByText('Today')).toBeVisible();
  await expect
    .element(screen.getByText('Your decks live only in this browser.'))
    .not.toBeInTheDocument();
});

test('Given the reminder, When its close button is pressed, Then it goes, and stays away when the library is opened again', async () => {
  const store = createTestStore();
  await store.save(agedDeck('Old talk', 'old', 20));
  const screen = await openLibrary(store);

  await screen.getByRole('button', { name: 'Hide this for 14 days' }).click();

  await expect
    .element(screen.getByText('Your decks live only in this browser.'))
    .not.toBeInTheDocument();
  const until = await store.reminderSnoozedUntil();
  expect(until).toBeGreaterThan(Date.now() + 13 * DAY);
  await screen.unmount();
  const again = await openLibrary(store);
  await expect.element(again.getByText('Old talk')).toBeVisible();
  await expect
    .element(again.getByText('Your decks live only in this browser.'))
    .not.toBeInTheDocument();
});

test('Given the library, Then Back up all decks is there when there are decks, with or without a reminder, and not when there are none', async () => {
  const empty = await openLibrary(createTestStore());
  await expect.element(empty.getByRole('heading', { name: 'No decks yet' })).toBeVisible();
  expect(empty.getByRole('button', { name: 'Back up all decks' }).elements()).toHaveLength(0);
  await empty.unmount();

  const store = createTestStore();
  await store.save(agedDeck('Today', 'today', 0));
  const screen = await openLibrary(store);
  await expect.element(screen.getByRole('button', { name: 'Back up all decks' })).toBeVisible();
});

test('Given a backup, When it is chosen with Open file, Then every deck in it is added as a new deck, the library stays open, and a message says so', async () => {
  const source = createTestStore();
  await source.save(agedDeck('First', 'one', 1));
  await source.save(agedDeck('Second', 'two', 1));
  const downloads = catchDownloads();
  const first = await openLibrary(source);
  await first.getByRole('button', { name: 'Back up all decks' }).first().click();
  await expect.element(first.getByText('Backed up 2 decks.')).toBeVisible();
  const backup = new File([new Uint8Array(await downloads.read())], 'Cue backup.zip');
  await first.unmount();
  closeTestStores();

  const store = createTestStore();
  await store.save(agedDeck('Already here', 'here', 1));
  const screen = await openLibrary(store);
  await userEvent.upload(chooseFile(screen), backup);

  await expect.element(screen.getByText('Added 2 decks from the backup.')).toBeVisible();
  expect(window.location.hash).toBe('#/');
  expect((await store.list()).map((one) => one.title).sort()).toEqual([
    'Already here',
    'First',
    'Second',
  ]);
  await expect.element(screen.getByText('Second')).toBeVisible();
});

test('Given a backup with a deck file that is damaged, When it is chosen, Then that deck is named, and the others are added', async () => {
  const store = createTestStore();
  const screen = await openLibrary(store);
  const good = packDeck(
    { deck: agedDeck('Good one', 'g', 1), images: [], originals: [], fonts: [] },
    Date.now(),
  );
  const backup = new File(
    [
      new Uint8Array(
        zipSync({
          'backup.json': strToU8(
            JSON.stringify({ format: 'cue-backup', formatVersion: 1, decks: [] }),
          ),
          'decks/Good one.slides': good,
          'decks/Broken one.slides': strToU8('not a deck file'),
        }),
      ),
    ],
    'Cue backup.zip',
  );

  await userEvent.upload(chooseFile(screen), backup);

  await expect.element(screen.getByText('Added 1 deck from the backup.')).toBeVisible();
  await expect.element(screen.getByText(/Broken one couldn’t be opened/)).toBeVisible();
  expect((await store.list()).map((one) => one.title)).toEqual(['Good one']);
});

test('Given a deck card, When its deck file is exported, Then the deck counts as backed up and the reminder clears; a web page does not count', async () => {
  const store = createTestStore();
  await store.save(agedDeck('Only deck', 'only', 30));
  catchDownloads();
  const screen = await openLibrary(store);
  await expect.element(screen.getByText('Your decks live only in this browser.')).toBeVisible();

  await screen.getByRole('button', { name: 'Options for Only deck' }).click();
  await screen.getByRole('menuitem', { name: 'Export…' }).click();
  const page = screen.getByRole('dialog', { name: 'Export deck' });
  await expect.element(page.getByText(/\.html · about/)).toBeVisible();
  await page.getByRole('button', { name: 'Export web page' }).click();
  expect(await store.listFiled()).toEqual({});
  await expect.element(screen.getByText('Your decks live only in this browser.')).toBeVisible();

  await screen.getByRole('button', { name: 'Options for Only deck' }).click();
  await screen.getByRole('menuitem', { name: 'Export…' }).click();
  const file = screen.getByRole('dialog', { name: 'Export deck' });
  await file.getByRole('radio', { name: /Editable deck file/ }).click();
  await expect.element(file.getByText(/\.slides · about/)).toBeVisible();
  await file.getByRole('button', { name: 'Export deck file' }).click();

  await expect.poll(async () => Object.keys(await store.listFiled())).toEqual(['only']);
  await expect
    .element(screen.getByText('Your decks live only in this browser.'))
    .not.toBeInTheDocument();
});

test('Given a deck exported from the editor as a file, Then it counts as backed up', async () => {
  const store = createTestStore();
  catchDownloads();
  const screen = await openEditor(store, deckWithSlides(1, 'In the editor', 'editing'));

  await screen.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await dialog.getByRole('radio', { name: /Editable deck file/ }).click();
  await expect.element(dialog.getByText(/\.slides · about/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Export deck file' }).click();

  await expect.poll(async () => Object.keys(await store.listFiled())).toEqual(['editing']);
});
