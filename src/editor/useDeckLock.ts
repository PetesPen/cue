import { useEffect, useState } from 'react';

/** How long to wait for the lock before saying the deck is open elsewhere (a quick hand-over is not news). */
export const LOCK_PATIENCE_MS = 120;

/**
 * `checking`: asked, not answered yet. `held`: this tab may edit the deck. `busy`: another tab of this
 * browser has it open.
 */
export type LockState = 'checking' | 'held' | 'busy';

/** The browser's lock manager, or nothing where there is none (or a test has taken it away). */
function webLocks(): LockManager | undefined {
  const locks: unknown = Reflect.get(navigator, 'locks');
  return 'LockManager' in globalThis && locks instanceof LockManager ? locks : undefined;
}

/**
 * One tab edits a deck at a time (SV-7, decision 16). The editor takes a Web Lock named for the deck
 * and keeps it while it is open; a second tab for the same deck waits on the lock, reports that the
 * deck is open elsewhere, and opens it by itself when the first tab closes (the browser lets go of a
 * closed tab's locks). Where there are no Web Locks, nothing changes.
 */
export function useDeckLock(deckId: string): LockState {
  const [state, setState] = useState<LockState>('checking');

  useEffect(() => {
    const locks = webLocks();
    if (!locks) {
      // No Web Locks: there is no way to tell, so edit as before.
      const timer = setTimeout(() => {
        setState('held');
      }, 0);
      return () => {
        clearTimeout(timer);
      };
    }

    const controller = new AbortController();
    let release: (() => void) | undefined;
    const notice = setTimeout(() => {
      setState('busy');
    }, LOCK_PATIENCE_MS);

    locks
      .request(`cue-deck:${deckId}`, { signal: controller.signal }, () => {
        clearTimeout(notice);
        setState('held');
        // Holding the lock means keeping this promise unsettled until the editor closes.
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => undefined); // leaving before the lock came (AbortError) is not a problem

    return () => {
      clearTimeout(notice);
      controller.abort();
      release?.();
    };
  }, [deckId]);

  return state;
}
