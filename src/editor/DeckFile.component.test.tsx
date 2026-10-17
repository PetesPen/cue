import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { Deck } from '@/model';
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

test('Given a deck card, When Export… is chosen, Then the dialog offers the deck file, shows its size, and Export deck file saves it', async () => {
  const store = createTestStore();
  await store.save({ ...deckWithSlides(2, 'Team offsite'), id: 'a' });
  const downloads = catchDownloads();
  const screen = await openLibrary(store);

  await screen.getByRole('button', { name: 'Options for Team offsite' }).click();
  await screen.getByRole('menuitem', { name: 'Export…' }).click();

  const dialog = screen.getByRole('dialog', { name: 'Export deck' });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByText('Team offsite · 2 slides')).toBeVisible();
  await expect.element(dialog.getByText('Coming soon')).toBeVisible();
  await expect.element(dialog.getByText('Coming later')).toBeVisible();
  await expect.element(dialog.getByText('Made on your device. Nothing is uploaded.')).toBeVisible();
  await expect.element(dialog.getByRole('radio', { name: /Standalone web page/ })).toBeDisabled();
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
  await expect.element(dialog.getByText(/about/)).toBeVisible();

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
  await expect.element(dialog.getByText(/\.slides · about/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Export deck file' }).click();

  // The file holds the added slide, which the store never got.
  expect((await unpackDeck(await downloads.read())).deck.slides).toHaveLength(2);
  expect((await real.load('deck'))?.slides).toHaveLength(1);
});

test('Given storage nearly full, When the editor opens, Then the banner says to back up, and offers Export deck', async () => {
  vi.spyOn(navigator.storage, 'estimate').mockResolvedValue({ usage: 0.9e9, quota: 1e9 });
  const screen = await openEditor(createTestStore(), deckWithSlides(1));

  await expect.element(screen.getByText(/Back up your decks, then delete/)).toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: 'Export deck', exact: true }))
    .toBeVisible();
});
