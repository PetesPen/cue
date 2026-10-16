import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { Deck } from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore, deckWithSlides } from './test-helpers';

afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

async function openWithNotes(store: DeckStore, ...notes: string[]) {
  const base = deckWithSlides(notes.length);
  const deck: Deck = {
    ...base,
    slides: base.slides.map((slide, i) => ({ ...slide, notes: notes[i] ?? '' })),
  };
  await store.save(deck);
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  return screen;
}

const savedNotes = async (store: DeckStore) =>
  (await store.load('deck'))?.slides.map((slide) => slide.notes);

// SL-6: speaker notes

test('Given a slide, When notes are typed, Then they are saved with that slide within 2 seconds', async () => {
  const store = createTestStore();
  const screen = await openWithNotes(store, '');

  await screen.getByRole('textbox', { name: 'Speaker notes text' }).fill('Open with the problem.');

  await expect.poll(() => savedNotes(store), { timeout: 2000 }).toEqual(['Open with the problem.']);
});

test('Given two slides with different notes, When the slide changes, Then each shows its own notes', async () => {
  const store = createTestStore();
  const screen = await openWithNotes(store, 'First notes', 'Second notes');
  const field = screen.getByRole('textbox', { name: 'Speaker notes text' });
  await expect.element(field).toHaveValue('First notes');

  await screen.getByRole('option', { name: 'Slide 2', exact: true }).click();

  await expect.element(field).toHaveValue('Second notes');
});

test('Given notes typed and no pause, When another slide is chosen at once, Then they are saved on the slide they were typed on', async () => {
  const store = createTestStore();
  const screen = await openWithNotes(store, '', 'Keep me');

  await screen.getByRole('textbox', { name: 'Speaker notes text' }).fill('For slide one');
  await screen.getByRole('option', { name: 'Slide 2', exact: true }).click();

  await expect
    .poll(() => savedNotes(store), { timeout: 3000 })
    .toEqual(['For slide one', 'Keep me']);
});

test('Given notes with several lines, When they are saved, Then the line breaks are kept', async () => {
  const store = createTestStore();
  const screen = await openWithNotes(store, '');

  await screen.getByRole('textbox', { name: 'Speaker notes text' }).fill('One\nTwo\n\nFour');

  await expect.poll(() => savedNotes(store), { timeout: 2000 }).toEqual(['One\nTwo\n\nFour']);
});

test('Given the notes field, When the letter t is typed, Then it is text and does not arm the text tool', async () => {
  const store = createTestStore();
  const screen = await openWithNotes(store, '');
  const field = screen.getByRole('textbox', { name: 'Speaker notes text' });

  await field.click();
  await userEvent.keyboard('tea time');

  await expect.element(field).toHaveValue('tea time');
  await expect
    .element(screen.getByRole('button', { name: 'Text', exact: true }))
    .toHaveAttribute('aria-pressed', 'false');
});

test('Given a slide with notes saved, When the deck is opened again, Then the notes are there', async () => {
  const store = createTestStore();
  const screen = await openWithNotes(store, 'Remember this');

  await expect
    .element(screen.getByRole('textbox', { name: 'Speaker notes text' }))
    .toHaveValue('Remember this');
});
