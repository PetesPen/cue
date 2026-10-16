import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { Deck, Transition } from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from '../EditorApp';
import { closeTestStores, createTestStore, deckWithSlides } from '../test-helpers';

afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

// TN-1: choose a transition.

async function openWith(store: DeckStore, transitions: Partial<Transition>[]) {
  const base = deckWithSlides(transitions.length);
  const deck: Deck = {
    ...base,
    slides: base.slides.map((slide, i) => ({
      ...slide,
      transition: { ...slide.transition, ...transitions[i] },
    })),
  };
  await store.save(deck);
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  return screen;
}

const stored = async (store: DeckStore) =>
  (await store.load('deck'))?.slides.map((slide) => slide.transition.kind);
const badges = () =>
  [...document.querySelectorAll('.rail-item')].map(
    (item) => item.querySelector('.rail-transition') !== null,
  );

async function openTransition(screen: Awaited<ReturnType<typeof openWith>>, slide: number) {
  await screen.getByRole('option', { name: `Slide ${String(slide)}`, exact: true }).click();
  await screen.getByRole('tab', { name: 'Transition' }).click();
}

test('Given a slide after the first, When the Transition tab is opened, Then None, Fade, Slide, Push and Zoom are offered and None is the choice', async () => {
  const screen = await openWith(createTestStore(), [{}, {}]);

  await openTransition(screen, 2);

  await expect.element(screen.getByText('Slide 2 transition')).toBeVisible();
  await expect.element(screen.getByText('Plays when this slide appears.')).toBeVisible();
  const effects = screen.getByRole('group', { name: 'Effect' });
  const names = ['None', 'Fade', 'Slide', 'Push', 'Zoom'];
  for (const name of names) {
    await expect.element(effects.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect
    .element(effects.getByRole('button', { name: 'None', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  expect(badges()).toEqual([false, false]);
});

test('Given an effect, When it is chosen, Then it is the choice, saved with the slide, and the thumbnail shows the small arrow', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [{}, {}]);
  await openTransition(screen, 2);

  await screen
    .getByRole('group', { name: 'Effect' })
    .getByRole('button', { name: 'Push', exact: true })
    .click();

  await expect
    .element(
      screen
        .getByRole('group', { name: 'Effect' })
        .getByRole('button', { name: 'Push', exact: true }),
    )
    .toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => stored(store), { timeout: 3000 }).toEqual(['none', 'push']);
  expect(badges()).toEqual([false, true]);
});

test('Given a transition chosen, When Undo is pressed, Then the slide has none again, in one step, and the arrow goes', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [{}, {}]);
  await openTransition(screen, 2);
  await screen
    .getByRole('group', { name: 'Effect' })
    .getByRole('button', { name: 'Zoom', exact: true })
    .click();
  await expect.poll(badges).toEqual([false, true]);
  await userEvent.hover(screen.getByRole('button', { name: 'Undo' }));
  await expect
    .poll(() => screen.getByRole('tooltip').element().textContent)
    .toBe('Undo Change transitionCtrlZ');

  await screen.getByRole('button', { name: 'Undo' }).click();

  await expect.poll(badges).toEqual([false, false]);
  await expect.poll(() => stored(store), { timeout: 3000 }).toEqual(['none', 'none']);
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('Given slides with their own transitions, When the slide changes, Then the panel shows each one', async () => {
  const screen = await openWith(createTestStore(), [{}, { kind: 'fade' }, { kind: 'zoom' }]);

  await openTransition(screen, 2);
  const effects = screen.getByRole('group', { name: 'Effect' });
  await expect
    .element(effects.getByRole('button', { name: 'Fade', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await screen.getByRole('option', { name: 'Slide 3', exact: true }).click();

  await expect.element(screen.getByText('Slide 3 transition')).toBeVisible();
  await expect
    .element(effects.getByRole('button', { name: 'Zoom', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  expect(badges()).toEqual([false, true, true]);
});

test('Given the first slide, When the Transition tab is opened, Then it says there is no incoming transition and offers no choice', async () => {
  const screen = await openWith(createTestStore(), [{}, {}]);

  await openTransition(screen, 1);

  await expect.element(screen.getByText('Slide 1 transition')).toBeVisible();
  await expect.element(screen.getByText(/no incoming transition/)).toBeVisible();
  expect(document.querySelector('.tn-tiles')).toBeNull();
});

test('Given a slide with a transition, When it is duplicated, Then the copy has the same transition and its arrow', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [{}, { kind: 'slide', from: 'left' }]);
  await openTransition(screen, 2);

  await userEvent.keyboard('{Control>}{Shift>}d{/Shift}{/Control}');

  await expect.poll(() => stored(store), { timeout: 3000 }).toEqual(['none', 'slide', 'slide']);
  expect(badges()).toEqual([false, true, true]);
});

test('Given the Fade tile, When it is chosen again, Then nothing is saved as a new step', async () => {
  const screen = await openWith(createTestStore(), [{}, { kind: 'fade' }]);
  await openTransition(screen, 2);

  await screen
    .getByRole('group', { name: 'Effect' })
    .getByRole('button', { name: 'Fade', exact: true })
    .click();

  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});
