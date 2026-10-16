import { useSyncExternalStore } from 'react';
import type { ShowPlace } from '@/model';
import type { Show } from './show';

/** Where the show is, re-rendering when it moves (from this window or the other). */
export function useShowPlace(show: Show): ShowPlace {
  return useSyncExternalStore(show.subscribe, show.getPlace);
}
