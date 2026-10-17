import { useEffect, useMemo } from 'react';
import { setImageSource } from '@/render';
import { ImageCache, type DeckStore } from '@/storage';
import { EditorScreen } from './EditorScreen';
import { ImageCacheContext } from './imageCache';
import { PresentContext, type OpenAudience } from './PresentContext';
import { Home } from './Home';
import { useRoute } from './route';
import { DeckStoreProvider } from './StoreContext';
import './controls.css';

/** Cue's two screens, the deck library and the editor, chosen by the address hash. */
export function EditorApp({
  store,
  openAudience,
}: {
  readonly store: DeckStore;
  /** Opens the audience window of a show (PM-1). Without it the editor has no Present button. */
  readonly openAudience?: OpenAudience;
}) {
  const route = useRoute();
  // The pictures are loaded as slides need them; the slide renderer asks this cache for them (EL-4).
  const images = useMemo(() => new ImageCache(store), [store]);
  useEffect(() => {
    setImageSource(images);
    // At start, photos no deck shows (left by a half-finished save, or by a deleted deck) are removed.
    void store.sweepUnusedImages().catch(() => undefined);
    return () => {
      setImageSource(undefined);
      images.dispose();
    };
  }, [images, store]);

  return (
    <ImageCacheContext value={images}>
      <DeckStoreProvider store={store}>
        <PresentContext value={openAudience}>
          {route.page === 'deck' ? (
            // Keyed by deck, so opening another deck starts a fresh session.
            <EditorScreen key={route.deckId} deckId={route.deckId} />
          ) : (
            <Home />
          )}
        </PresentContext>
      </DeckStoreProvider>
    </ImageCacheContext>
  );
}
