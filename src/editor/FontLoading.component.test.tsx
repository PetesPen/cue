import { afterEach, expect, test } from 'vitest';
import { createTestStore } from './test-helpers';
import { edit, openWith, resetEditorTest, selectAll, textBox, toolbar } from './text-test-helpers';

afterEach(resetEditorTest);

// EL-2: fonts are loaded when they are needed, not all at once. This is its own file so that no other
// test has opened the font picker first: the picker shows every font in its own typeface, which loads
// them all, once.

const loaded = (family: string) =>
  [...document.fonts].some(
    (face) => face.family.replaceAll('"', '') === family && face.status === 'loaded',
  );

test('Given a deck in one font, When it opens, Then the other fonts are not loaded; choosing one loads it', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await expect.poll(() => loaded('Instrument Sans')).toBe(true);
  expect(loaded('Caveat')).toBe(false);
  expect(loaded('DM Serif Display')).toBe(false);
  await edit('t');
  await selectAll();

  await toolbar(screen)
    .getByRole('button', { name: /^Font:/ })
    .click();
  await screen.getByRole('option', { name: /^Caveat/ }).click();

  await expect.poll(() => loaded('Caveat')).toBe(true);
});
