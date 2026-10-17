import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { Deck, Transition, TransitionKind } from '@/model';
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

// TN-4: preview a transition.

const layerIds = () =>
  [...document.querySelectorAll<HTMLElement>('.canvas .cue-layer .cue-slide')].map(
    (slide) => slide.dataset.slideId,
  );

test('Given slide 3 with Slide chosen, When Preview transition is pressed, Then slide 2 is replaced by slide 3 coming in, and the canvas ends on slide 3', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [{}, {}, { kind: 'slide', duration: 0.3 }]);
  await openTransition(screen, 3);

  await expect.element(screen.getByText('Slide 2')).toBeVisible();
  await expect.element(screen.getByText('Slide 3', { exact: true }).last()).toBeVisible();
  await screen.getByRole('button', { name: 'Preview transition' }).click();

  // Two slides are on the canvas while it plays: slide 2 and slide 3 over it.
  await expect.poll(layerIds).toEqual(['deck-2', 'deck-3']);
  // And at the end only slide 3 is left, where the editor draws it.
  await expect.poll(layerIds).toEqual(['deck-3']);
  await expect.element(screen.getByRole('button', { name: 'Preview transition' })).toBeEnabled();
  expect(await stored(store)).toEqual(['none', 'none', 'slide']);
});

test('Given a transition playing, When the canvas is clicked or Esc is pressed, Then it lands at once on the selected slide', async () => {
  const screen = await openWith(createTestStore(), [{}, { kind: 'push', duration: 3 }]);
  await openTransition(screen, 2);
  await screen.getByRole('button', { name: 'Preview transition' }).click();
  await expect.poll(layerIds).toHaveLength(2);
  await expect.element(screen.getByRole('button', { name: 'Preview transition' })).toBeDisabled();

  await userEvent.click(must('.slide-frame'));

  await expect.poll(layerIds).toEqual(['deck-2']);

  await screen.getByRole('button', { name: 'Preview transition' }).click();
  await expect.poll(layerIds).toHaveLength(2);
  await userEvent.keyboard('{Escape}');

  await expect.poll(layerIds).toEqual(['deck-2']);
});

test('Given a transition playing, When the Animate tab is opened, Then it lands at once', async () => {
  const screen = await openWith(createTestStore(), [{}, { kind: 'fade', duration: 3 }]);
  await openTransition(screen, 2);
  await screen.getByRole('button', { name: 'Preview transition' }).click();
  await expect.poll(layerIds).toHaveLength(2);

  await screen.getByRole('tab', { name: 'Animate' }).click();

  await expect.poll(layerIds).toEqual(['deck-2']);
});

test('Given a slide with no transition, When the Transition tab is open, Then the preview is offered but cannot be pressed', async () => {
  const screen = await openWith(createTestStore(), [{}, {}]);

  await openTransition(screen, 2);

  await expect.element(screen.getByRole('button', { name: 'Preview transition' })).toBeDisabled();
});

test('Given the first slide, When the Transition tab is open, Then the bar offers no preview', async () => {
  const screen = await openWith(createTestStore(), [{ kind: 'fade' }, {}]);

  await openTransition(screen, 1);

  expect(document.querySelector('[aria-label="Transition preview"]')).toBeNull();
  expect(screen.getByRole('button', { name: 'Preview transition' }).elements()).toHaveLength(0);
});

test('Given a preview that has played, Then the deck has no new step in its history', async () => {
  const screen = await openWith(createTestStore(), [{}, { kind: 'fade', duration: 0.2 }]);
  await openTransition(screen, 2);

  await screen.getByRole('button', { name: 'Preview transition' }).click();
  await expect.poll(layerIds).toEqual(['deck-2']);

  await expect.element(screen.getByRole('button', { name: /^Undo/ })).toBeDisabled();
});

function must(selector: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`nothing matches ${selector}`);
  return node;
}

// TN-2: direction and duration. TN-3: apply to all slides.

const storedTransitions = async (store: DeckStore) =>
  (await store.load('deck'))?.slides.map((slide) => slide.transition);
const group = (screen: Awaited<ReturnType<typeof openWith>>, name: string) =>
  screen.getByRole('group', { name });

test('Given Slide, When the Transition tab is open, Then Direction offers four arrows with From the right chosen, and the caption says so', async () => {
  const screen = await openWith(createTestStore(), [{}, { kind: 'slide' }]);

  await openTransition(screen, 2);

  const direction = group(screen, 'Direction');
  for (const name of ['From the left', 'From the right', 'From the top', 'From the bottom']) {
    await expect.element(direction.getByRole('button', { name })).toBeVisible();
  }
  await expect
    .element(direction.getByRole('button', { name: 'From the right' }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect.element(screen.getByText('New slide comes in from the right.')).toBeVisible();
  await expect.element(screen.getByRole('slider', { name: 'Duration' })).toBeVisible();
});

test('Given Slide, When a direction is chosen, Then it is saved, the caption follows, and one Undo puts it back', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [{}, { kind: 'push' }]);
  await openTransition(screen, 2);

  await group(screen, 'Direction').getByRole('button', { name: 'From the top' }).click();

  await expect.element(screen.getByText('New slide comes in from the top.')).toBeVisible();
  await expect
    .poll(async () => (await storedTransitions(store))?.[1]?.from, { timeout: 3000 })
    .toBe('top');
  await userEvent.keyboard('{Control>}z{/Control}');
  await expect.element(screen.getByText('New slide comes in from the right.')).toBeVisible();
});

test.each<[TransitionKind, boolean]>([
  ['fade', true],
  ['zoom', true],
  ['none', false],
])(
  'Given %s, Then the Duration slider is %s and there is no Direction',
  async (kind, hasDuration) => {
    const screen = await openWith(createTestStore(), [{}, { kind }]);

    await openTransition(screen, 2);

    expect(document.querySelector('[aria-label="Direction"]')).toBeNull();
    expect(screen.getByRole('slider', { name: 'Duration' }).elements()).toHaveLength(
      hasDuration ? 1 : 0,
    );
  },
);

test('Given the Duration slider, When it is moved with the keyboard, Then it runs from 0.2 to 3 s in tenths and saves one step when let go', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [{}, { kind: 'fade' }]);
  await openTransition(screen, 2);
  const slider = screen.getByRole('slider', { name: 'Duration' });
  await expect.element(slider).toHaveAttribute('min', '0.2');
  await expect.element(slider).toHaveAttribute('max', '3');
  await expect.element(screen.getByText('0.6 s').first()).toBeVisible();

  slider.element().focus();
  await userEvent.keyboard('{ArrowRight}{ArrowRight}');
  await userEvent.tab();

  await expect
    .poll(async () => (await storedTransitions(store))?.[1]?.duration, { timeout: 3000 })
    .toBe(0.8);
  await expect.element(screen.getByText('0.8 s').first()).toBeVisible();
});

test('Given a transition on slide 2, When Apply to all slides is pressed, Then every slide but the first has it, and one Undo takes it back', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [{}, { kind: 'push', from: 'left', duration: 1.4 }, {}, {}]);
  await openTransition(screen, 2);

  await screen.getByRole('button', { name: 'Apply to all slides' }).click();

  await expect
    .poll(
      async () =>
        (await storedTransitions(store))?.map((t) => `${t.kind}/${t.from}/${String(t.duration)}`),
      { timeout: 3000 },
    )
    .toEqual(['none/right/0.6', 'push/left/1.4', 'push/left/1.4', 'push/left/1.4']);
  expect(badges()).toEqual([false, true, true, true]);
  await userEvent.keyboard('{Control>}z{/Control}');
  await expect
    .poll(async () => (await storedTransitions(store))?.map((t) => t.kind), { timeout: 3000 })
    .toEqual(['none', 'push', 'none', 'none']);
});

test('Given a slide with a transition, When Reset to none is pressed, Then the slide has none, and the button is off for a slide that has none', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [{}, { kind: 'zoom' }, {}]);
  await openTransition(screen, 2);

  await screen.getByRole('button', { name: 'Reset to none' }).click();

  await expect
    .poll(async () => (await storedTransitions(store))?.map((t) => t.kind), { timeout: 3000 })
    .toEqual(['none', 'none', 'none']);
  await expect.element(screen.getByRole('button', { name: 'Reset to none' })).toBeDisabled();
});

test('Given the first slide, When the Transition tab is open, Then there is nothing to apply or reset', async () => {
  const screen = await openWith(createTestStore(), [{}, {}]);

  await openTransition(screen, 1);

  expect(screen.getByRole('button', { name: 'Apply to all slides' }).elements()).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Reset to none' }).elements()).toHaveLength(0);
});

test('Given Slide from the top and 3 s, When Preview transition plays, Then the new slide comes in from the top for that long', async () => {
  const screen = await openWith(createTestStore(), [
    {},
    { kind: 'slide', from: 'top', duration: 3 },
  ]);
  await openTransition(screen, 2);

  await screen.getByRole('button', { name: 'Preview transition' }).click();

  await expect.poll(layerIds).toHaveLength(2);
  const [animation] =
    document.querySelectorAll<HTMLElement>('.canvas .cue-layer')[1]?.getAnimations() ?? [];
  expect(animation?.effect?.getTiming().duration).toBe(3000);
  const effect = animation?.effect;
  expect(effect instanceof KeyframeEffect ? effect.getKeyframes()[0]?.transform : undefined).toBe(
    'translate(0px, -100%)',
  );
});
