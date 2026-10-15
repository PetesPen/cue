import type { DeckStore } from '@/storage';
import { EditorScreen } from './EditorScreen';
import { Home } from './Home';
import { useRoute } from './route';
import { DeckStoreProvider } from './StoreContext';
import './controls.css';

/** Cue's two screens, the deck library and the editor, chosen by the address hash. */
export function EditorApp({ store }: { readonly store: DeckStore }) {
  const route = useRoute();
  return (
    <DeckStoreProvider store={store}>
      {route.page === 'deck' ? (
        // Keyed by deck, so opening another deck starts a fresh session.
        <EditorScreen key={route.deckId} deckId={route.deckId} />
      ) : (
        <Home />
      )}
    </DeckStoreProvider>
  );
}
