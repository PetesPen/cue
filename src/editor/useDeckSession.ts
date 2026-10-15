import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UnsupportedVersionError,
  applyCommand,
  systemEnv,
  type Command,
  type Deck,
  type ElementChange,
  type Env,
  type Id,
  type ReorderMode,
  type Slide,
  type SlideElement,
} from '@/model';
import { Autosaver, type DeckStore, type SaveState } from '@/storage';

type Loaded =
  | { readonly phase: 'loading' }
  | { readonly phase: 'missing' }
  /** `newer`: saved by a newer Cue. Otherwise the stored data is damaged. */
  | { readonly phase: 'unreadable'; readonly newer: boolean }
  | { readonly phase: 'ready'; readonly deck: Deck };

export interface DeckSession {
  readonly phase: Loaded['phase'];
  readonly newer: boolean;
  readonly deck: Deck | undefined;
  readonly currentSlide: Slide | undefined;
  readonly saveState: SaveState;
  readonly selectSlide: (id: Id) => void;
  /** Add a blank slide after the current one and select it (SL-1). */
  readonly addSlide: () => void;
  readonly renameDeck: (title: string) => void;
  /** Put a new element on top of the current slide (ZO-1). */
  readonly addElement: (element: SlideElement) => void;
  /** Change properties of elements on the current slide: one command, one step (decision 18). */
  readonly updateElements: (changes: readonly ElementChange[]) => void;
  readonly reorderElements: (ids: readonly Id[], mode: ReorderMode) => void;
  /** Try saving again after a failed save. */
  readonly retrySave: () => void;
}

/**
 * The open deck: loads it, applies edits as commands, keeps the current slide, and autosaves.
 * Key the component that calls this by deck id, so each deck gets a fresh session.
 */
export function useDeckSession(
  store: DeckStore,
  deckId: string,
  env: Env = systemEnv,
): DeckSession {
  const [loaded, setLoaded] = useState<Loaded>({ phase: 'loading' });
  const [currentSlideId, setCurrentSlideId] = useState<Id | undefined>();
  const [saveState, setSaveState] = useState<SaveState>({ status: 'saved' });
  const saver = useRef<Autosaver | undefined>(undefined);
  const deckRef = useRef<Deck | undefined>(undefined);
  const currentRef = useRef<Id | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const autosaver = new Autosaver({
      save: (deck) => store.save(deck),
      onChange: setSaveState,
    });
    saver.current = autosaver;

    store
      .load(deckId)
      .then((deck) => {
        if (!active) return;
        if (deck === undefined) {
          setLoaded({ phase: 'missing' });
          return;
        }
        deckRef.current = deck;
        currentRef.current = deck.slides[0]?.id;
        setCurrentSlideId(currentRef.current);
        setLoaded({ phase: 'ready', deck });
      })
      .catch((error: unknown) => {
        if (!active) return;
        // A newer deck is named as such; anything else (damaged data, storage not available) is
        // reported as a deck that cannot be opened rather than left as a blank screen.
        setLoaded({ phase: 'unreadable', newer: error instanceof UnsupportedVersionError });
      });

    // A closing tab or window gets one last save (best effort: the browser may cut it short).
    const flush = () => void autosaver.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      // Leaving the deck (to the library, say) saves what is pending first.
      void autosaver.flush().then(() => {
        autosaver.dispose();
      });
    };
  }, [store, deckId]);

  const dispatch = useCallback((command: Command) => {
    const deck = deckRef.current;
    if (deck === undefined) return;
    const next = applyCommand(deck, command).deck;
    deckRef.current = next;
    setLoaded({ phase: 'ready', deck: next });
    saver.current?.edit(next);
  }, []);

  const selectSlide = useCallback((id: Id) => {
    currentRef.current = id;
    setCurrentSlideId(id);
  }, []);

  const addSlide = useCallback(() => {
    const afterSlideId = currentRef.current;
    if (afterSlideId === undefined) return;
    const slideId = env.newId();
    dispatch({ type: 'addSlide', slideId, afterSlideId, at: env.now() });
    selectSlide(slideId);
  }, [dispatch, env, selectSlide]);

  const renameDeck = useCallback(
    (title: string) => {
      dispatch({ type: 'renameDeck', title, at: env.now() });
    },
    [dispatch, env],
  );

  const addElement = useCallback(
    (element: SlideElement) => {
      const slideId = currentRef.current;
      if (slideId === undefined) return;
      dispatch({ type: 'addElement', slideId, element, at: env.now() });
    },
    [dispatch, env],
  );

  const updateElements = useCallback(
    (changes: readonly ElementChange[]) => {
      const slideId = currentRef.current;
      if (slideId === undefined || changes.length === 0) return;
      dispatch({ type: 'updateElements', slideId, changes, at: env.now() });
    },
    [dispatch, env],
  );

  const reorderElements = useCallback(
    (ids: readonly Id[], mode: ReorderMode) => {
      const slideId = currentRef.current;
      if (slideId === undefined || ids.length === 0) return;
      dispatch({ type: 'reorderElements', slideId, ids, mode, at: env.now() });
    },
    [dispatch, env],
  );

  const retrySave = useCallback(() => {
    void saver.current?.retry();
  }, []);

  const deck = loaded.phase === 'ready' ? loaded.deck : undefined;
  const currentSlide = deck?.slides.find((slide) => slide.id === currentSlideId) ?? deck?.slides[0];

  return {
    phase: loaded.phase,
    newer: loaded.phase === 'unreadable' && loaded.newer,
    deck,
    currentSlide,
    saveState,
    selectSlide,
    addSlide,
    renameDeck,
    addElement,
    updateElements,
    reorderElements,
    retrySave,
  };
}
