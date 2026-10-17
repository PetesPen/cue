import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { FakeRegistry } from './fakeLocks';
import { lockName } from './locks';
import { watchGone } from './presence';

const GRACE = 1000;
const NAME = lockName('deck', 'presenter');

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('noticing that a window is gone (PM-3)', () => {
  test('Given a window that holds its lock, When time passes, Then it is not gone', async () => {
    const registry = new FakeRegistry();
    registry.window().hold(NAME);
    const onGone = vi.fn();

    watchGone(registry.window(), NAME, onGone, GRACE);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(onGone).not.toHaveBeenCalled();
  });

  test('Given a window that dies, When the grace has passed, Then it is gone, once', async () => {
    const registry = new FakeRegistry();
    const holder = registry.window();
    holder.hold(NAME);
    const onGone = vi.fn();
    watchGone(registry.window(), NAME, onGone, GRACE);

    holder.kill();
    await vi.advanceTimersByTimeAsync(GRACE - 1);
    expect(onGone).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);

    expect(onGone).toHaveBeenCalledTimes(1);
  });

  test('Given a window that is reloaded, When it takes its lock again within the grace, Then it is not gone', async () => {
    const registry = new FakeRegistry();
    const before = registry.window();
    before.hold(NAME);
    const onGone = vi.fn();
    watchGone(registry.window(), NAME, onGone, GRACE);

    before.kill();
    await vi.advanceTimersByTimeAsync(GRACE / 2);
    registry.window().hold(NAME);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(onGone).not.toHaveBeenCalled();
    expect(registry.held()).toEqual([NAME]);
  });

  test('Given a window that comes back and dies again, Then the second death is noticed', async () => {
    const registry = new FakeRegistry();
    const first = registry.window();
    first.hold(NAME);
    const onGone = vi.fn();
    watchGone(registry.window(), NAME, onGone, GRACE);

    first.kill();
    await vi.advanceTimersByTimeAsync(GRACE / 2);
    const second = registry.window();
    second.hold(NAME);
    await vi.advanceTimersByTimeAsync(GRACE * 3);
    second.kill();
    await vi.advanceTimersByTimeAsync(GRACE * 2);

    expect(onGone).toHaveBeenCalledTimes(1);
  });

  test('Given a name nobody holds, When it is watched, Then it is gone once the grace has passed', async () => {
    const registry = new FakeRegistry();
    const onGone = vi.fn();

    watchGone(registry.window(), NAME, onGone, GRACE);
    await vi.advanceTimersByTimeAsync(GRACE + 10);

    expect(onGone).toHaveBeenCalledTimes(1);
  });

  test('Given a watch that is stopped, When the window dies, Then nothing is said', async () => {
    const registry = new FakeRegistry();
    const holder = registry.window();
    holder.hold(NAME);
    const onGone = vi.fn();
    const stop = watchGone(registry.window(), NAME, onGone, GRACE);

    stop();
    holder.kill();
    await vi.advanceTimersByTimeAsync(GRACE * 5);

    expect(onGone).not.toHaveBeenCalled();
  });

  test('Given a watch stopped during the grace, Then nothing is said either', async () => {
    const registry = new FakeRegistry();
    const holder = registry.window();
    holder.hold(NAME);
    const onGone = vi.fn();
    const stop = watchGone(registry.window(), NAME, onGone, GRACE);

    holder.kill();
    await vi.advanceTimersByTimeAsync(GRACE / 2);
    stop();
    await vi.advanceTimersByTimeAsync(GRACE * 5);

    expect(onGone).not.toHaveBeenCalled();
  });
});

describe('lock names', () => {
  test('Given a deck, Then each role has its own name', () => {
    expect(lockName('a', 'presenter')).toBe('cue-show:a:presenter');
    expect(lockName('a', 'audience')).toBe('cue-show:a:audience');
    expect(lockName('b', 'audience')).not.toBe(lockName('a', 'audience'));
  });
});
