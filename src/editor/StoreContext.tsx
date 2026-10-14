import { createContext, useContext, type ReactNode } from 'react';
import type { DeckStore } from '@/storage';

const StoreContext = createContext<DeckStore | null>(null);

/** Gives every screen the one deck store, so tests can hand in a store of their own. */
export function DeckStoreProvider({
  store,
  children,
}: {
  readonly store: DeckStore;
  readonly children: ReactNode;
}) {
  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useDeckStore(): DeckStore {
  const store = useContext(StoreContext);
  if (store === null) throw new Error('useDeckStore needs a DeckStoreProvider above it');
  return store;
}
