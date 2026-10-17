import { useEffect, useMemo, useState } from 'react';
import { routeHash, startShow, type Deck, type ShowView } from '@/model';
import { setImageSource } from '@/render';
import { ImageCache, type DeckStore } from '@/storage';
import { AudienceWindow } from './AudienceWindow';
import { createShowChannel } from './channel';
import { closeAudienceWindow } from './open';
import { preloadDeck } from './preload';
import { PresenterView } from './PresenterView';
import { Show } from './show';
import './present.css';

type Loaded =
  | { readonly phase: 'loading' }
  | { readonly phase: 'missing' }
  | { readonly phase: 'unreadable' }
  | { readonly phase: 'ready'; readonly deck: Deck };

/**
 * A window of a show at `#/show/<deck>…` (PM-1, PM-2): the presenter view (the editor tab during a
 * show), the audience window, or the whole show in one window. The deck is read once, here, and held for
 * the whole show; each window draws it with the shared renderer, so what the audience sees is what the
 * Preview showed.
 */
export function ShowApp({
  store,
  deckId,
  view,
  slide,
}: {
  readonly store: DeckStore;
  readonly deckId: string;
  readonly view: ShowView;
  /** The slide the show starts at, from 0. */
  readonly slide: number;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ phase: 'loading' });
  // The pictures are loaded as slides need them, and all of them before the show starts.
  const images = useMemo(() => new ImageCache(store), [store]);

  useEffect(() => {
    setImageSource(images);
    return () => {
      setImageSource(undefined);
      images.dispose();
    };
  }, [images]);

  useEffect(() => {
    const stopped = new AbortController();
    const isStopped = () => stopped.signal.aborted;
    void (async () => {
      try {
        const deck = await store.load(deckId);
        if (isStopped()) return;
        if (!deck) {
          setLoaded({ phase: 'missing' });
          return;
        }
        document.title = view === 'audience' ? `Audience · ${deck.title}` : deck.title;
        await preloadDeck(deck, images);
        if (!isStopped()) setLoaded({ phase: 'ready', deck });
      } catch {
        if (!isStopped()) setLoaded({ phase: 'unreadable' });
      }
    })();
    return () => {
      stopped.abort();
    };
  }, [store, deckId, images, view]);

  if (loaded.phase === 'loading') return <p className="show-status">Starting the show…</p>;
  if (loaded.phase !== 'ready') {
    return (
      <main className="show-status">
        <h1>{loaded.phase === 'missing' ? 'This deck isn’t here' : 'This deck can’t be opened'}</h1>
        <p>
          {loaded.phase === 'missing'
            ? 'It may have been deleted from this browser.'
            : 'Its stored data may be damaged, or this browser is not letting Cue use storage.'}
        </p>
        <a href="#/">Back to your decks</a>
      </main>
    );
  }
  return <ShowWindow deck={loaded.deck} view={view} slide={slide} />;
}

/** Back to the editor, exactly where the editor was left; and out of full screen. */
function returnToEditor(deckId: string): void {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  window.location.hash = routeHash({ page: 'deck', deckId });
}

function ShowWindow({
  deck,
  view,
  slide,
}: {
  readonly deck: Deck;
  readonly view: ShowView;
  readonly slide: number;
}) {
  const [ended, setEnded] = useState(false);
  const show = useMemo(
    () =>
      new Show(
        deck,
        startShow(deck, slide),
        view,
        view === 'single' ? undefined : () => createShowChannel(deck.id),
      ),
    [deck, view, slide],
  );

  useEffect(() => {
    const hangUp = show.connect();
    const stopHearing = show.onEnd(() => {
      if (view === 'audience') {
        // A window the show opened can close itself; if the browser says no, say so.
        window.close();
        setTimeout(() => {
          setEnded(true);
        }, 300);
      } else {
        closeAudienceWindow();
        returnToEditor(deck.id);
      }
    });
    return () => {
      stopHearing();
      hangUp();
    };
  }, [show, view, deck.id]);

  if (ended) {
    return (
      <main className="show-status show-status-dark">
        <h1>The show has ended</h1>
        <p>You can close this window.</p>
      </main>
    );
  }
  return view === 'presenter' ? <PresenterView show={show} /> : <AudienceWindow show={show} />;
}
