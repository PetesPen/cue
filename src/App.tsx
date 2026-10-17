import { lazy, Suspense, useSyncExternalStore } from 'react';
import { EditorApp } from '@/editor';
import { parseRoute } from '@/model';
import { openAudienceWindow } from '@/present/open';
import { createDeckStore } from '@/storage';
import { installer, updater } from './appPwa';
import { SMALL_SCREEN_QUERY, browserScope, missingFeatures } from './browserSupport';
import { SmallScreen, UnsupportedBrowser } from './SmallScreen';
import { UpdateBanner } from './UpdateBanner';

// One store for the whole app. The database opens on first use.
const store = createDeckStore();

// The show windows are fetched only when a show is opened (the editor's first load stays small).
const ShowApp = lazy(() =>
  import('@/present/ShowApp').then((module) => ({ default: module.ShowApp })),
);

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

const currentHash = () => window.location.hash;

function subscribeSize(onChange: () => void): () => void {
  const query = window.matchMedia(SMALL_SCREEN_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

const isSmallScreen = () => window.matchMedia(SMALL_SCREEN_QUERY).matches;

/** What this browser lacks, read once: it does not change while the page is open. */
const missing = missingFeatures(browserScope());

/**
 * The app: the editor, or a window of a show (`#/show/…`). They sit side by side here because the
 * editor and the show never import each other; the editor is given the one thing it needs from the
 * show, opening the audience window from the click that starts it.
 */
export function App() {
  const route = parseRoute(useSyncExternalStore(subscribe, currentHash));
  const small = useSyncExternalStore(subscribeSize, isSmallScreen);
  if (missing.length > 0) return <UnsupportedBrowser missing={missing} />;
  if (route.page === 'show') {
    return (
      <Suspense fallback={null}>
        <ShowApp
          // A new window of the show (another view or deck) starts afresh.
          key={`${route.deckId}:${route.view}`}
          store={store}
          deckId={route.deckId}
          view={route.view}
          slide={route.slide}
        />
      </Suspense>
    );
  }
  // A phone is not for editing; the audience window of a show may be any size, so shows are left alone.
  if (small) return <SmallScreen />;
  return (
    <>
      <EditorApp store={store} openAudience={openAudienceWindow} install={installer} />
      <UpdateBanner updater={updater} />
    </>
  );
}
