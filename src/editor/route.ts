import { useSyncExternalStore } from 'react';
import { parseRoute, routeHash, type Route } from '@/model';

// The addresses themselves are in `model` (the show reads them too); here they are put to use.
export { parseRoute, routeHash };
export type { Route };

export function navigate(route: Route): void {
  window.location.hash = routeHash(route);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

const currentHash = () => window.location.hash;

/** The route in the address bar, updating when it changes. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, currentHash);
  return parseRoute(hash);
}
