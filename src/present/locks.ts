/**
 * The three things a show needs from the browser's Web Locks (PM-3, SP-1): hold a name for as long as a
 * window lives, ask whether a name is free right now, and wait until it is. A window that dies (closed,
 * crashed, killed) lets go of what it held, with no timers and no message, and that works in a window
 * nobody is looking at. Kept this small so tests can stand in a pretend one.
 */
export interface Locks {
  /** Hold `name` until the returned function is called, or this page goes away. */
  readonly hold: (name: string) => () => void;
  /** Whether nobody holds `name` at this moment. */
  readonly free: (name: string) => Promise<boolean>;
  /** Resolves true once `name` is free (it waits behind whoever holds it), or false when aborted. */
  readonly whenFree: (name: string, signal: AbortSignal) => Promise<boolean>;
}

/** The browser's own locks, or nothing where there are none (an insecure page, a very old browser). */
export function browserLocks(): Locks | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const manager: unknown = Reflect.get(navigator, 'locks');
  if (manager === undefined || manager === null) return undefined;
  const locks = navigator.locks;
  return {
    hold(name) {
      let released = false;
      let release = () => {
        released = true;
      };
      void locks
        .request(
          name,
          () =>
            new Promise<void>((resolve) => {
              release = resolve;
              if (released) resolve();
            }),
        )
        .catch(() => undefined);
      return () => {
        release();
      };
    },
    async free(name) {
      try {
        return await locks.request(name, { ifAvailable: true }, (lock) => lock !== null);
      } catch {
        return false;
      }
    },
    async whenFree(name, signal) {
      try {
        return await locks.request(name, { signal }, () => true);
      } catch {
        return false;
      }
    },
  };
}

/** The name a show window holds: one per deck and role, so each window can tell the other is gone. */
export function lockName(deckId: string, role: 'presenter' | 'audience'): string {
  return `cue-show:${deckId}:${role}`;
}
