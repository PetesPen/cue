import { useSyncExternalStore } from 'react';

/** Two screens, chosen by the address hash so refresh and links work with no server setting. */
export type Route = { readonly page: 'home' } | { readonly page: 'deck'; readonly deckId: string };

const DECK_PREFIX = '#/deck/';

export function parseRoute(hash: string): Route {
  if (hash.startsWith(DECK_PREFIX)) {
    const deckId = decodeURIComponent(hash.slice(DECK_PREFIX.length));
    if (deckId !== '') return { page: 'deck', deckId };
  }
  return { page: 'home' };
}

export function routeHash(route: Route): string {
  return route.page === 'home' ? '#/' : `${DECK_PREFIX}${encodeURIComponent(route.deckId)}`;
}

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
