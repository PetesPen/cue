import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore, deckWithSlides } from './test-helpers';

afterEach(() => {
  closeTestStores();
  vi.restoreAllMocks();
  window.location.hash = '';
});

const HOUR = 3_600_000;

/** Saves decks that were last edited at different times: id and title first, then hours ago. */
async function seed(store: DeckStore, decks: [id: string, title: string, hoursAgo: number][]) {
  for (const [id, title, hoursAgo] of decks) {
    await store.save({ ...deckWithSlides(2, title, id), updatedAt: Date.now() - hoursAgo * HOUR });
  }
}

async function openLibrary(store: DeckStore) {
  window.location.hash = '#/';
  return render(<EditorApp store={store} />);
}

const titlesShown = () =>
  [...document.querySelectorAll('.deck-title')].map((element) => element.textContent);

// SV-2

test('Given no decks, When the library opens, Then it says "No decks yet" and offers a new deck', async () => {
  const screen = await openLibrary(createTestStore());

  await expect.element(screen.getByRole('heading', { name: 'No decks yet' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'New deck' }).first()).toBeVisible();
});

test('Given several decks, When the library opens, Then they are listed newest edit first with slide count and date', async () => {
  const store = createTestStore();
  await seed(store, [
    ['old', 'Q3 review', 72],
    ['new', 'Autumn Launch', 2],
    ['mid', 'Team offsite', 30],
  ]);

  const screen = await openLibrary(store);

  await expect.element(screen.getByText('Autumn Launch')).toBeVisible();
  expect(titlesShown()).toEqual(['Autumn Launch', 'Team offsite', 'Q3 review']);
  await expect.element(screen.getByText('2 slides · Edited 2 hours ago')).toBeVisible();
  await expect.element(screen.getByText('2 slides · Edited yesterday')).toBeVisible();
  await expect.element(screen.getByText('2 slides · Edited 3 days ago')).toBeVisible();
  await expect.element(screen.getByRole('heading', { name: /Your decks · 3/ })).toBeVisible();
});

test('Given a deck, When the library opens, Then its card shows a thumbnail of its first slide', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Autumn Launch', 1]]);

  const screen = await openLibrary(store);

  await expect.element(screen.getByText('Autumn Launch')).toBeVisible();
  expect(document.querySelector('.deck-thumb .cue-slide')?.getAttribute('data-slide-id')).toBe(
    'a-1',
  );
});

test('Given a deck card, When it is clicked, Then the deck opens in the editor', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Autumn Launch', 1]]);
  const screen = await openLibrary(store);

  await screen.getByRole('link', { name: /Autumn Launch/ }).click();

  expect(window.location.hash).toBe('#/deck/a');
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
});

test('Given the library, When New deck is chosen, Then a deck with one slide is stored and opened in the editor', async () => {
  const store = createTestStore();
  const screen = await openLibrary(store);

  await screen.getByRole('button', { name: 'New deck' }).first().click();

  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  const [stored] = await store.list();
  expect(stored).toMatchObject({ title: 'Untitled deck', slideCount: 1 });
  expect(window.location.hash).toBe(`#/deck/${stored?.id ?? ''}`);
});

test('Given a deck card, When its options button is pressed, Then the menu offers Open, Rename, Duplicate, Export and Delete', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Team offsite', 1]]);
  const screen = await openLibrary(store);

  await screen.getByRole('button', { name: 'Options for Team offsite' }).click();

  const items = screen.getByRole('menuitem');
  await expect.element(items.first()).toBeVisible();
  expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(5);
  expect([...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent)).toEqual([
    'Open',
    'Rename',
    'Duplicate',
    'Export…',
    'Delete',
  ]);
});

test('Given the menu is open, When Down is pressed, Then focus moves along the items and wraps', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Team offsite', 1]]);
  const screen = await openLibrary(store);
  await screen.getByRole('button', { name: 'Options for Team offsite' }).click();
  await expect.element(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus();

  await userEvent.keyboard('{ArrowDown}');
  await expect.element(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
  await userEvent.keyboard('{ArrowUp}{ArrowUp}');
  await expect.element(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
});

test('Given the menu is open, When Escape is pressed, Then it closes and focus returns to the options button', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Team offsite', 1]]);
  const screen = await openLibrary(store);
  const options = screen.getByRole('button', { name: 'Options for Team offsite' });
  await options.click();

  await userEvent.keyboard('{Escape}');

  await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();
  await expect.element(options).toHaveFocus();
});

test('Given the menu is open, When the page is clicked elsewhere, Then it closes', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Team offsite', 1]]);
  const screen = await openLibrary(store);
  await screen.getByRole('button', { name: 'Options for Team offsite' }).click();

  await screen.getByRole('heading', { name: /Your decks/ }).click();

  await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();
});

test('Given a deck, When Rename is chosen and a new name saved, Then the library shows it and it moves to the top', async () => {
  const store = createTestStore();
  await seed(store, [
    ['a', 'Old name', 5],
    ['b', 'Other deck', 1],
  ]);
  const screen = await openLibrary(store);
  await screen.getByRole('button', { name: 'Options for Old name' }).click();
  await screen.getByRole('menuitem', { name: 'Rename' }).click();

  const field = screen.getByLabelText('Deck name');
  await expect.element(field).toHaveValue('Old name');
  await field.fill('Pitch v2');
  await screen.getByRole('button', { name: 'Rename' }).click();

  await expect.poll(titlesShown).toEqual(['Pitch v2', 'Other deck']);
});

test('Given the rename dialog, When Cancel is pressed, Then nothing changes and focus returns to the options button', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Old name', 1]]);
  const screen = await openLibrary(store);
  const options = screen.getByRole('button', { name: 'Options for Old name' });
  await options.click();
  await screen.getByRole('menuitem', { name: 'Rename' }).click();

  await screen.getByRole('button', { name: 'Cancel' }).click();

  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  await expect.element(options).toHaveFocus();
  expect(titlesShown()).toEqual(['Old name']);
});

test('Given a deck, When Duplicate is chosen, Then a copy appears beside it', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Q3 review', 5]]);
  const screen = await openLibrary(store);
  await screen.getByRole('button', { name: 'Options for Q3 review' }).click();

  await screen.getByRole('menuitem', { name: 'Duplicate' }).click();

  await expect.poll(titlesShown).toEqual(['Copy of Q3 review', 'Q3 review']);
  expect((await store.list()).map((deck) => deck.slideCount)).toEqual([2, 2]);
});

test('Given a deck, When Delete is chosen, Then it asks for confirmation naming the deck, and Cancel keeps it', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Team offsite', 1]]);
  const screen = await openLibrary(store);
  await screen.getByRole('button', { name: 'Options for Team offsite' }).click();
  await screen.getByRole('menuitem', { name: 'Delete' }).click();

  await expect
    .element(screen.getByRole('dialog', { name: 'Delete “Team offsite”?' }))
    .toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await screen.getByRole('button', { name: 'Cancel' }).click();

  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  expect(titlesShown()).toEqual(['Team offsite']);
  expect(await store.list()).toHaveLength(1);
});

test('Given the delete confirmation, When Escape is pressed, Then the deck is kept', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Team offsite', 1]]);
  const screen = await openLibrary(store);
  await screen.getByRole('button', { name: 'Options for Team offsite' }).click();
  await screen.getByRole('menuitem', { name: 'Delete' }).click();

  await userEvent.keyboard('{Escape}');

  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  expect(await store.list()).toHaveLength(1);
});

test('Given the delete confirmation, When Delete deck is pressed, Then the deck is gone and the empty state returns', async () => {
  const store = createTestStore();
  await seed(store, [['a', 'Team offsite', 1]]);
  const screen = await openLibrary(store);
  await screen.getByRole('button', { name: 'Options for Team offsite' }).click();
  await screen.getByRole('menuitem', { name: 'Delete' }).click();

  await screen.getByRole('button', { name: 'Delete deck' }).click();

  await expect.element(screen.getByRole('heading', { name: 'No decks yet' })).toBeVisible();
  expect(await store.list()).toEqual([]);
});

// SV-1

test('Given storage at 90% of the quota, When the library opens, Then a warning shows the real numbers', async () => {
  vi.spyOn(navigator.storage, 'estimate').mockResolvedValue({ usage: 0.9e9, quota: 1e9 });

  const screen = await openLibrary(createTestStore());

  await expect.element(screen.getByText('Storage is almost full.')).toBeVisible();
  await expect.element(screen.getByText(/0\.9 of about 1 GB used/)).toBeVisible();
});

test('Given the browser reports storage use, When the library opens, Then "Stored on this device" shows it', async () => {
  vi.spyOn(navigator.storage, 'estimate').mockResolvedValue({ usage: 38e6, quota: 10e9 });

  const screen = await openLibrary(createTestStore());

  await expect.element(screen.getByText('Stored on this device · 38 MB used')).toBeVisible();
});

test('Given storage that cannot be read, When the library opens, Then it says so instead of showing an empty library', async () => {
  const store: DeckStore = {
    ...createTestStore(),
    list: () => Promise.reject(new Error('blocked')),
  };

  const screen = await openLibrary(store);

  await expect.element(screen.getByText('Your decks can’t be read.')).toBeVisible();
  await expect
    .element(screen.getByRole('heading', { name: 'No decks yet' }))
    .not.toBeInTheDocument();
});
