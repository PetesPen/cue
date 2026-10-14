import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createDeck, type Deck, type Env } from '@/model';
import { Autosaver, type SaveState } from './autosave';

let counter = 0;
const env: Env = { newId: () => `id-${String(++counter)}`, now: () => 1000 };
const deckNamed = (title: string): Deck => ({ ...createDeck(env), title });

function setup(save: (deck: Deck) => Promise<void> = () => Promise.resolve()) {
  const saved: Deck[] = [];
  const states: SaveState[] = [];
  const saver = new Autosaver({
    save: async (deck) => {
      await save(deck);
      saved.push(deck);
    },
    onChange: (state) => states.push(state),
  });
  return { saver, saved, states, statuses: () => states.map((s) => s.status) };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Autosaver (SV-1)', () => {
  test('Given a deck is edited, When 2 seconds pass, Then it has been saved and the state is "saved"', async () => {
    const { saver, saved, states } = setup();

    saver.edit(deckNamed('A'));
    expect(saver.state.status).toBe('saving');
    await vi.advanceTimersByTimeAsync(2000);

    expect(saved.map((d) => d.title)).toEqual(['A']);
    expect(saver.state.status).toBe('saved');
    expect(states.map((s) => s.status)).toEqual(['saving', 'saved']);
  });

  test('Given an edit, When it has just happened, Then nothing is written yet and "saving" shows during the wait', async () => {
    const { saver, saved } = setup();

    saver.edit(deckNamed('A'));
    await vi.advanceTimersByTimeAsync(100);

    expect(saved).toHaveLength(0);
    expect(saver.state.status).toBe('saving');
  });

  test('Given several quick edits, When the quiet period ends, Then only the newest deck is written', async () => {
    const { saver, saved } = setup();

    saver.edit(deckNamed('A'));
    await vi.advanceTimersByTimeAsync(200);
    saver.edit(deckNamed('B'));
    await vi.advanceTimersByTimeAsync(200);
    saver.edit(deckNamed('C'));
    await vi.advanceTimersByTimeAsync(2000);

    expect(saved.map((d) => d.title)).toEqual(['C']);
  });

  test('Given an edit every 400 ms without a pause, When 2 seconds pass since the first, Then a save has still happened', async () => {
    const { saver, saved } = setup();

    saver.edit(deckNamed('0'));
    for (let i = 1; i <= 4; i++) {
      await vi.advanceTimersByTimeAsync(400);
      saver.edit(deckNamed(String(i)));
    }
    // 1,600 ms in, with the 1,500 ms cap passed and the quiet period never reached.

    expect(saved.length).toBeGreaterThanOrEqual(1);
  });

  test('Given an edit made while a save is running, When the save ends, Then the newer deck is saved right after', async () => {
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    const { saver, saved } = setup(async () => {
      if (first) {
        first = false;
        await slow;
      }
    });

    saver.edit(deckNamed('A'));
    await vi.advanceTimersByTimeAsync(600);
    saver.edit(deckNamed('B'));
    release();
    await vi.advanceTimersByTimeAsync(2000);

    expect(saved.map((d) => d.title)).toEqual(['A', 'B']);
    expect(saver.state.status).toBe('saved');
  });

  test('Given a pending edit, When flush is called (the tab is closing), Then it is written at once', async () => {
    const { saver, saved } = setup();

    saver.edit(deckNamed('A'));
    await saver.flush();

    expect(saved.map((d) => d.title)).toEqual(['A']);
    expect(saver.state.status).toBe('saved');
  });

  test('Given a full store, When the save fails, Then the state is "failed" for the reason "full" and the deck stays pending', async () => {
    const { saver, saved } = setup(() =>
      Promise.reject(
        Object.assign(new Error('aborted'), {
          name: 'AbortError',
          inner: new DOMException('full', 'QuotaExceededError'),
        }),
      ),
    );

    saver.edit(deckNamed('A'));
    await vi.advanceTimersByTimeAsync(2000);

    expect(saver.state).toEqual({ status: 'failed', reason: 'full' });
    expect(saved).toHaveLength(0);
  });

  test('Given any other failure, When the save fails, Then the reason is "error"', async () => {
    const { saver } = setup(() => Promise.reject(new Error('disk on fire')));

    saver.edit(deckNamed('A'));
    await vi.advanceTimersByTimeAsync(2000);

    expect(saver.state).toEqual({ status: 'failed', reason: 'error' });
  });

  test('Given a failed save, When space is freed and retry is called, Then the deck is saved and the state recovers', async () => {
    let full = true;
    const { saver, saved } = setup(() =>
      full
        ? Promise.reject(Object.assign(new Error('full'), { name: 'QuotaExceededError' }))
        : Promise.resolve(),
    );
    saver.edit(deckNamed('A'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(saver.state.status).toBe('failed');

    full = false;
    await saver.retry();

    expect(saved.map((d) => d.title)).toEqual(['A']);
    expect(saver.state.status).toBe('saved');
  });

  test('Given a failed save, When another edit is made, Then the newest deck is tried again without a retry call', async () => {
    let full = true;
    const { saver, saved } = setup(() =>
      full
        ? Promise.reject(Object.assign(new Error('full'), { name: 'QuotaExceededError' }))
        : Promise.resolve(),
    );
    saver.edit(deckNamed('A'));
    await vi.advanceTimersByTimeAsync(2000);

    full = false;
    saver.edit(deckNamed('B'));
    expect(saver.state.status).toBe('saving');
    await vi.advanceTimersByTimeAsync(2000);

    expect(saved.map((d) => d.title)).toEqual(['B']);
    expect(saver.state.status).toBe('saved');
  });

  test('Given a disposed autosaver, When an edit arrives, Then nothing is saved', async () => {
    const { saver, saved } = setup();

    saver.dispose();
    saver.edit(deckNamed('A'));
    await vi.advanceTimersByTimeAsync(3000);

    expect(saved).toHaveLength(0);
  });
});
