import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { UnsupportedVersionError } from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import {
  closeTestStores,
  createTestStore,
  deckWithSlides,
  railSlideIds,
  selectedSlideId,
} from './test-helpers';

afterEach(() => {
  closeTestStores();
  vi.restoreAllMocks();
  window.location.hash = '';
});

async function openEditor(store: DeckStore, slides: number, title?: string) {
  const deck = deckWithSlides(slides, title);
  await store.save(deck);
  window.location.hash = `#/deck/${deck.id}`;
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  return { deck, screen };
}

const slidesStored = async (store: DeckStore) => (await store.load('deck'))?.slides.length;

// UX-1

test('Given the editor, When a deck opens, Then the slide rail, canvas, notes and inspector are all there', async () => {
  const { screen } = await openEditor(createTestStore(), 2);

  await expect.element(screen.getByRole('listbox', { name: 'Slides' })).toBeVisible();
  await expect.element(screen.getByRole('group', { name: 'Slide 1 of 2' })).toBeVisible();
  await expect.element(screen.getByRole('region', { name: 'Speaker notes' })).toBeVisible();
  await expect.element(screen.getByRole('complementary', { name: 'Inspector' })).toBeVisible();
});

test('Given the top bar, When it is read, Then it holds the deck title, Add slide and the save status', async () => {
  const { screen } = await openEditor(createTestStore(), 1, 'Q3 review');

  await expect.element(screen.getByLabelText('Deck title')).toHaveValue('Q3 review');
  await expect.element(screen.getByRole('button', { name: 'Add slide' })).toBeVisible();
  await expect.element(screen.getByText('Saved')).toBeVisible();
});

// SL-1

test('Given three slides with the second selected, When Add slide is clicked, Then a blank slide goes directly after the second and is selected', async () => {
  const { screen } = await openEditor(createTestStore(), 3);
  await screen.getByRole('option', { name: 'Slide 2' }).click();

  await screen.getByRole('button', { name: 'Add slide' }).click();

  const ids = railSlideIds();
  expect(ids).toHaveLength(4);
  expect(ids.filter((id) => id.startsWith('deck-'))).toEqual(['deck-1', 'deck-2', 'deck-3']);
  expect(ids.indexOf(selectedSlideId() ?? '')).toBe(2);
  expect(ids[2]).not.toMatch(/^deck-/);
  await expect.element(screen.getByRole('group', { name: 'Slide 3 of 4' })).toBeVisible();
});

test('Given the rail footer, When New slide is clicked, Then a slide is added after the current one', async () => {
  const { screen } = await openEditor(createTestStore(), 2);

  await screen.getByRole('button', { name: 'New slide' }).click();

  expect(railSlideIds()).toHaveLength(3);
  await expect
    .element(screen.getByRole('option', { name: 'Slide 2' }))
    .toHaveAttribute('aria-selected', 'true');
});

test('Given the editor, When Ctrl+M is pressed, Then a slide is added after the current one', async () => {
  const { screen } = await openEditor(createTestStore(), 2);

  await userEvent.keyboard('{Control>}m{/Control}');

  expect(railSlideIds()).toHaveLength(3);
  await expect
    .element(screen.getByRole('option', { name: 'Slide 2' }))
    .toHaveAttribute('aria-selected', 'true');
});

test('Given the editor, When Cmd+M is pressed, Then a slide is added too (where the browser lets the page see it)', async () => {
  await openEditor(createTestStore(), 1);

  await userEvent.keyboard('{Meta>}m{/Meta}');

  expect(railSlideIds()).toHaveLength(2);
});

test('Given the title field has focus, When Ctrl+M is pressed, Then a slide is still added', async () => {
  const { screen } = await openEditor(createTestStore(), 1);
  await screen.getByLabelText('Deck title').click();

  await userEvent.keyboard('{Control>}m{/Control}');

  expect(railSlideIds()).toHaveLength(2);
});

test('Given a slide was just added, When it appears, Then keyboard focus is on the canvas, ready to edit', async () => {
  const { screen } = await openEditor(createTestStore(), 1);

  await screen.getByRole('button', { name: 'Add slide' }).click();

  await expect.element(screen.getByRole('group', { name: 'Slide 2 of 2' })).toHaveFocus();
});

test('Given a new deck, When it opens, Then it has exactly one blank slide', async () => {
  const { screen } = await openEditor(createTestStore(), 1);

  expect(railSlideIds()).toHaveLength(1);
  await expect
    .element(screen.getByRole('option', { name: 'Slide 1' }))
    .toHaveAttribute('aria-selected', 'true');
});

// SL-2

test('Given any number of slides, When the rail shows, Then every slide has a thumbnail and its number', async () => {
  const { screen } = await openEditor(createTestStore(), 5);

  for (let n = 1; n <= 5; n++) {
    await expect.element(screen.getByRole('option', { name: `Slide ${String(n)}` })).toBeVisible();
  }
  expect(document.querySelectorAll('.rail-item .cue-slide')).toHaveLength(5);
  expect([...document.querySelectorAll('.rail-number')].map((el) => el.textContent)).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5',
  ]);
});

test('Given the second slide is clicked, When the rail shows, Then only it is marked as current and the canvas follows', async () => {
  const { screen } = await openEditor(createTestStore(), 3);

  await screen.getByRole('option', { name: 'Slide 2' }).click();

  await expect
    .element(screen.getByRole('option', { name: 'Slide 2' }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(screen.getByRole('option', { name: 'Slide 1' }))
    .toHaveAttribute('aria-selected', 'false');
  await expect.element(screen.getByRole('group', { name: 'Slide 2 of 3' })).toBeVisible();
  expect(document.querySelector('.slide-frame .cue-slide')?.getAttribute('data-slide-id')).toBe(
    'deck-2',
  );
});

test('Given the rail has focus, When Down and Up are pressed, Then the selection moves, the canvas follows, and it stops at the ends', async () => {
  const { screen } = await openEditor(createTestStore(), 3);
  await screen.getByRole('option', { name: 'Slide 1' }).click();

  await userEvent.keyboard('{ArrowDown}');
  await expect.element(screen.getByRole('group', { name: 'Slide 2 of 3' })).toBeVisible();
  await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
  await expect.element(screen.getByRole('group', { name: 'Slide 3 of 3' })).toBeVisible();
  await userEvent.keyboard('{ArrowUp}');
  await expect.element(screen.getByRole('group', { name: 'Slide 2 of 3' })).toBeVisible();
  await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
  await expect.element(screen.getByRole('group', { name: 'Slide 1 of 3' })).toBeVisible();
});

test('Given the rail has focus, When End and Home are pressed, Then the last and first slides are selected', async () => {
  const { screen } = await openEditor(createTestStore(), 4);
  await screen.getByRole('option', { name: 'Slide 2' }).click();

  await userEvent.keyboard('{End}');
  await expect.element(screen.getByRole('option', { name: 'Slide 4' })).toHaveFocus();
  await userEvent.keyboard('{Home}');
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toHaveFocus();
});

test('Given the rail, When it is read, Then only the current slide is in the Tab order', async () => {
  const { screen } = await openEditor(createTestStore(), 3);

  await expect
    .element(screen.getByRole('option', { name: 'Slide 1' }))
    .toHaveAttribute('tabindex', '0');
  await expect
    .element(screen.getByRole('option', { name: 'Slide 2' }))
    .toHaveAttribute('tabindex', '-1');
});

// SV-1

test('Given an edit, When it has just happened, Then "Saving…" shows, and within 2 seconds the deck is stored and it reads "Saved"', async () => {
  const store = createTestStore();
  const { screen } = await openEditor(store, 1);

  await screen.getByRole('button', { name: 'Add slide' }).click();
  await expect.element(screen.getByText('Saving…')).toBeVisible();

  await expect.poll(() => slidesStored(store), { timeout: 2000 }).toBe(2);
  await expect.element(screen.getByText('Saved')).toBeVisible();
});

test('Given edits, When the editor is left straight away, Then they are saved anyway', async () => {
  const store = createTestStore();
  await openEditor(store, 1);

  await userEvent.keyboard('{Control>}m{/Control}');
  window.location.hash = '#/';

  await expect.poll(() => slidesStored(store), { timeout: 2000 }).toBe(2);
});

test('Given a save that fails because the store is full, When it happens, Then a banner says changes cannot be saved and the edit stays on screen', async () => {
  const real = createTestStore();
  const full = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  const save = vi.fn<DeckStore['save']>().mockRejectedValue(full);
  const store: DeckStore = { ...real, save };
  await real.save(deckWithSlides(1));
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();

  await screen.getByRole('button', { name: 'Add slide' }).click();

  await expect
    .element(screen.getByText('Changes can’t be saved.'), { timeout: 4000 })
    .toBeVisible();
  await expect.element(screen.getByText('Not saved')).toBeVisible();
  await expect
    .element(screen.getByRole('link', { name: 'Manage storage' }))
    .toHaveAttribute('target', '_blank');
  expect(railSlideIds()).toHaveLength(2);
  expect(await slidesStored(real)).toBe(1);
});

test('Given the store is full, When space is freed and Try again is pressed, Then the deck saves and the banner goes', async () => {
  const real = createTestStore();
  let full = true;
  const store: DeckStore = {
    ...real,
    save: (deck, images) =>
      full
        ? Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'))
        : real.save(deck, images),
  };
  await real.save(deckWithSlides(1));
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  await screen.getByRole('button', { name: 'Add slide' }).click();
  await expect
    .element(screen.getByText('Changes can’t be saved.'), { timeout: 4000 })
    .toBeVisible();

  full = false;
  await screen.getByRole('button', { name: 'Try again' }).click();

  await expect.poll(() => slidesStored(real), { timeout: 2000 }).toBe(2);
  await expect.element(screen.getByText('Changes can’t be saved.')).not.toBeInTheDocument();
  await expect.element(screen.getByText('Saved')).toBeVisible();
});

test('Given a save that fails for another reason, When it happens, Then the banner offers only Try again', async () => {
  const real = createTestStore();
  const store: DeckStore = { ...real, save: () => Promise.reject(new Error('disk on fire')) };
  await real.save(deckWithSlides(1));
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();

  await screen.getByRole('button', { name: 'Add slide' }).click();

  await expect
    .element(screen.getByText('Changes can’t be saved.'), { timeout: 4000 })
    .toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect
    .element(screen.getByRole('link', { name: 'Manage storage' }))
    .not.toBeInTheDocument();
});

test('Given storage at 90% of the quota, When the editor opens, Then a warning shows the real numbers', async () => {
  vi.spyOn(navigator.storage, 'estimate').mockResolvedValue({ usage: 0.9e9, quota: 1e9 });

  const { screen } = await openEditor(createTestStore(), 1);

  await expect.element(screen.getByText('Storage is almost full.')).toBeVisible();
  await expect.element(screen.getByText(/0\.9 of about 1 GB used/)).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Manage storage' })).toBeVisible();
});

test('Given storage at 89% of the quota, When the editor opens, Then there is no warning', async () => {
  vi.spyOn(navigator.storage, 'estimate').mockResolvedValue({ usage: 0.89e9, quota: 1e9 });

  const { screen } = await openEditor(createTestStore(), 1);

  await expect.element(screen.getByText('Saved')).toBeVisible();
  await expect.element(screen.getByText('Storage is almost full.')).not.toBeInTheDocument();
});

// SV-2

test('Given the title in the header, When it is edited in place, Then the new title is shown and stored', async () => {
  const store = createTestStore();
  const { screen } = await openEditor(store, 1);

  await screen.getByLabelText('Deck title').fill('Pitch v2');

  await expect
    .element(screen.getByRole('heading', { name: 'Pitch v2', level: 1 }))
    .toBeInTheDocument();
  await expect
    .poll(async () => (await store.load('deck'))?.title, { timeout: 2000 })
    .toBe('Pitch v2');
});

test('Given a title edit, When the library is opened straight away, Then it already lists the new title', async () => {
  const { screen } = await openEditor(createTestStore(), 1, 'Old name');

  await screen.getByLabelText('Deck title').fill('New name');
  await screen.getByRole('link', { name: 'All decks' }).click();

  await expect.element(screen.getByText('New name')).toBeVisible();
  await expect.element(screen.getByText('Old name')).not.toBeInTheDocument();
});

test('Given the title is cleared, When the field loses focus, Then it reads "Untitled deck"', async () => {
  const { screen } = await openEditor(createTestStore(), 1);
  const field = screen.getByLabelText('Deck title');

  await field.fill('');
  await userEvent.keyboard('{Enter}');

  await expect.element(field).toHaveValue('Untitled deck');
});

test('Given the deck is open, When the page is read, Then the tab title carries the deck title', async () => {
  await openEditor(createTestStore(), 1, 'Q3 review');

  await expect.poll(() => document.title).toBe('Q3 review · Cue');
});

// Decks that cannot be shown

test('Given a deck that is not stored, When its address is opened, Then the screen says so and links back to the library', async () => {
  window.location.hash = '#/deck/gone';
  const screen = await render(<EditorApp store={createTestStore()} />);

  await expect.element(screen.getByRole('heading', { name: 'This deck isn’t here' })).toBeVisible();
  await expect
    .element(screen.getByRole('link', { name: 'Back to your decks' }))
    .toHaveAttribute('href', '#/');
});

test('Given a deck saved by a newer Cue, When it is opened, Then the screen says it needs a newer version', async () => {
  const store: DeckStore = {
    ...createTestStore(),
    load: () => Promise.reject(new UnsupportedVersionError(2)),
  };
  window.location.hash = '#/deck/future';
  const screen = await render(<EditorApp store={store} />);

  await expect
    .element(screen.getByRole('heading', { name: 'This deck needs a newer version of Cue' }))
    .toBeVisible();
});
