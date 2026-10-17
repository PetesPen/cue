import type { Locks } from './locks';

/** How long a window that has let go of its lock may take to come back (a reload) before it is gone. */
export const GRACE_MS = 4000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Notice that the window holding `name` is gone (PM-3). Waiting for the lock means waiting behind
 * whoever holds it; when it is free, the holder has died, or never held it. A window that reloads lets go
 * and takes the lock again within a moment, so the answer is not given until `graceMs` have passed and
 * the lock is still nobody's. Returns how to stop watching. `onGone` is called once.
 */
export function watchGone(
  locks: Locks,
  name: string,
  onGone: () => void,
  graceMs: number = GRACE_MS,
): () => void {
  const stop = new AbortController();
  const stopped = () => stop.signal.aborted;
  void (async () => {
    while (!stopped()) {
      if (!(await locks.whenFree(name, stop.signal))) return;
      await sleep(graceMs, stop.signal);
      if (stopped()) return;
      if (await locks.free(name)) {
        if (!stopped()) onGone();
        return;
      }
    }
  })();
  return () => {
    stop.abort();
  };
}
