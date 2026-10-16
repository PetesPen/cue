import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UnsupportedVersionError,
  applyCommand,
  canRedo,
  canUndo,
  emptyHistory,
  record,
  redo as redoStep,
  redoLabel,
  systemEnv,
  undo as undoStep,
  undoLabel,
  type Command,
  type Deck,
  type ElementChange,
  type Env,
  type History,
  type Id,
  type ReorderMode,
  type Slide,
  type SlideElement,
} from '@/model';
import { Autosaver, type DeckStore, type SaveState } from '@/storage';
import { idsOf, labelFor } from './historyLabels';

type Loaded =
  | { readonly phase: 'loading' }
  | { readonly phase: 'missing' }
  /** `newer`: saved by a newer Cue. Otherwise the stored data is damaged. */
  | { readonly phase: 'unreadable'; readonly newer: boolean }
  | { readonly phase: 'ready'; readonly deck: Deck };

/** What an edit is called in the undo button, and which edits that follow it join it (EL-8). */
export interface EditMeta {
  readonly label?: string;
  readonly mergeKey?: string;
}

/** Where to look after an undo or a redo: the slide, and the elements to select on it. */
export interface View {
  readonly slideId: Id | undefined;
  readonly ids: readonly Id[];
}

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
  readonly addElement: (element: SlideElement, meta?: EditMeta) => void;
  /** Change properties of elements on the current slide: one command, one step (decision 18). */
  readonly updateElements: (changes: readonly ElementChange[], meta?: EditMeta) => void;
  readonly reorderElements: (ids: readonly Id[], mode: ReorderMode) => void;
  /** Put new elements on top of the current slide, in order (paste, duplicate). */
  readonly addElements: (elements: readonly SlideElement[], meta?: EditMeta) => void;
  /** The speaker notes of a slide (SL-6). */
  readonly setNotes: (slideId: Id, notes: string) => void;
  /** Take elements off the current slide (delete, cut). */
  readonly removeElements: (ids: readonly Id[], meta?: EditMeta) => void;
  /** Undo and redo the last step (EL-8); each says where to look afterwards, or nothing if there was nothing to do. */
  readonly undo: () => View | undefined;
  readonly redo: () => View | undefined;
  readonly history: History;
  /** Counts the undos and redos, so a field that keeps its own copy of the deck can start again after one. */
  readonly revision: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoLabel: string | undefined;
  readonly redoLabel: string | undefined;
  /**
   * Something that holds typed words not yet given to the deck (the notes, a text being edited)
   * registers a function that does so. They run before the deck is saved when the tab is closed or
   * the deck is left. Returns the way to unregister.
   */
  readonly registerFlush: (flush: () => void) => () => void;
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
  const flushers = useRef(new Set<() => void>());
  // The history lives as long as the deck is open and is empty when it is opened (EL-8).
  const historyRef = useRef<History>(emptyHistory);
  const [history, setHistory] = useState<History>(emptyHistory);
  const [revision, setRevision] = useState(0);

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

    // A closing tab or window gets one last save (best effort: the browser may cut it short), after
    // whatever is still being typed has been given to the deck.
    const waiting = flushers.current;
    const flush = () => {
      for (const pending of waiting) pending();
      void autosaver.flush();
    };
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
      for (const pending of waiting) pending();
      void autosaver.flush().then(() => {
        autosaver.dispose();
      });
    };
  }, [store, deckId]);

  const dispatch = useCallback((command: Command, meta: EditMeta = {}) => {
    const deck = deckRef.current;
    if (deck === undefined) return;
    const applied = applyCommand(deck, command);
    deckRef.current = applied.deck;
    const mergeKey =
      meta.mergeKey ??
      (command.type === 'setNotes'
        ? `notes:${command.slideId}`
        : command.type === 'renameDeck'
          ? 'title'
          : undefined);
    historyRef.current = record(historyRef.current, {
      label: meta.label ?? labelFor(command),
      patches: applied.patches,
      inverse: applied.inverse,
      slideId: 'slideId' in command ? command.slideId : undefined,
      ids: idsOf(command),
      mergeKey,
      at: command.at,
    });
    setHistory(historyRef.current);
    setLoaded({ phase: 'ready', deck: applied.deck });
    saver.current?.edit(applied.deck);
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
    (element: SlideElement, meta?: EditMeta) => {
      const slideId = currentRef.current;
      if (slideId === undefined) return;
      dispatch({ type: 'addElement', slideId, element, at: env.now() }, meta);
    },
    [dispatch, env],
  );

  const updateElements = useCallback(
    (changes: readonly ElementChange[], meta?: EditMeta) => {
      const slideId = currentRef.current;
      if (slideId === undefined || changes.length === 0) return;
      dispatch({ type: 'updateElements', slideId, changes, at: env.now() }, meta);
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

  const addElements = useCallback(
    (elements: readonly SlideElement[], meta?: EditMeta) => {
      const slideId = currentRef.current;
      if (slideId === undefined || elements.length === 0) return;
      dispatch({ type: 'addElements', slideId, elements, at: env.now() }, meta);
    },
    [dispatch, env],
  );

  const setNotes = useCallback(
    (slideId: Id, notes: string) => {
      dispatch({ type: 'setNotes', slideId, notes, at: env.now() });
    },
    [dispatch, env],
  );

  const removeElements = useCallback(
    (ids: readonly Id[], meta?: EditMeta) => {
      const slideId = currentRef.current;
      if (slideId === undefined || ids.length === 0) return;
      dispatch({ type: 'removeElements', slideId, ids, at: env.now() }, meta);
    },
    [dispatch, env],
  );

  /** Undo or redo one step, and say where to look afterwards. */
  const step = useCallback((which: 'undo' | 'redo'): View | undefined => {
    const deck = deckRef.current;
    if (deck === undefined) return undefined;
    const stepped = (which === 'undo' ? undoStep : redoStep)(historyRef.current, deck);
    if (stepped === undefined) return undefined;
    const before = deck.slides.findIndex((slide) => slide.id === currentRef.current);
    deckRef.current = stepped.deck;
    historyRef.current = stepped.history;
    setHistory(stepped.history);
    setRevision((was) => was + 1);
    setLoaded({ phase: 'ready', deck: stepped.deck });
    saver.current?.edit(stepped.deck);

    // Show the slide the step was about; if it is gone (an added slide, undone), stay near where you were.
    const slides = stepped.deck.slides;
    const wanted = stepped.entry.slideId;
    const show =
      slides.find((slide) => slide.id === wanted) ??
      slides.find((slide) => slide.id === currentRef.current) ??
      slides[Math.min(Math.max(before, 0), slides.length - 1)];
    if (show !== undefined) {
      currentRef.current = show.id;
      setCurrentSlideId(show.id);
    }
    const there = new Set(show?.elements.map((element) => element.id));
    return { slideId: show?.id, ids: stepped.entry.ids.filter((id) => there.has(id)) };
  }, []);
  const undo = useCallback(() => step('undo'), [step]);
  const redo = useCallback(() => step('redo'), [step]);

  const registerFlush = useCallback((flush: () => void) => {
    flushers.current.add(flush);
    return () => {
      flushers.current.delete(flush);
    };
  }, []);

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
    removeElements,
    addElements,
    setNotes,
    undo,
    redo,
    history,
    revision,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    undoLabel: undoLabel(history),
    redoLabel: redoLabel(history),
    registerFlush,
    retrySave,
  };
}
