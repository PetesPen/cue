import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * Installing Cue as an app (UX-7). The app gives the editor this where the browser can install it; the
 * library shows an "Install Cue" action while `available()` is true, and nothing otherwise.
 */
export interface InstallApi {
  readonly available: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
  readonly install: () => Promise<void>;
}

export const InstallContext = createContext<InstallApi | undefined>(undefined);

const never = () => false;
const quiet = () => () => undefined;

/** Whether Cue can be installed here, and how. Nothing where it cannot (or inside the installed app). */
export function useInstall(): { readonly install: () => Promise<void> } | undefined {
  const api = useContext(InstallContext);
  const available = useSyncExternalStore(api?.subscribe ?? quiet, api?.available ?? never);
  return api && available ? { install: api.install } : undefined;
}
