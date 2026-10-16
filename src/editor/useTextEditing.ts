import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyText,
  isEmptyText,
  isTextBox,
  type ElementChange,
  type Id,
  type Point,
  type RichText,
  type Slide,
} from '@/model';
import { ensureFonts, measureTextHeight } from '@/render';
import { textOf, type TextFormat } from './text/format';
import type { EditMeta } from './useDeckSession';

/** Typing is saved to the deck after this long without a key, and always when editing ends. */
export const BURST_MS = 600;

export interface TextEditing {
  /** The element being edited and where the pointer was, or nothing. */
  readonly editing: { readonly id: Id; readonly at: Point | undefined } | undefined;
  /** The editor is on screen, so the slide stops drawing that element's own text. */
  readonly ready: boolean;
  readonly start: (id: Id, at?: Point) => void;
  /** End editing: saves what was typed (an empty new text box is removed instead). */
  readonly finish: () => void;
  readonly onDraft: (doc: RichText) => void;
  /** Give what is typed to the deck now, without ending the editing (before an undo). */
  readonly saveNow: () => void;
  /** The deck changed under the editor (an undo): start the editor again from what the deck holds. */
  readonly reload: () => void;
  /** Changes each time the editor is reloaded, to key the editor by. */
  readonly version: number;
  readonly markReady: () => void;
  /** The height a text box has with the text typed so far, to show before it is saved. */
  readonly height: ElementChange | undefined;
  readonly format: TextFormat | undefined;
  readonly setFormat: (format: TextFormat | undefined) => void;
}

interface Params {
  /** The slide as saved. */
  readonly slide: Slide;
  /** Save a change to elements of the slide: one command (heights are fitted by the caller). */
  readonly save: (changes: readonly ElementChange[], meta?: EditMeta) => void;
  readonly remove: (ids: readonly Id[]) => void;
  /** Have what is typed saved when the tab is closed or the deck is left. */
  readonly registerFlush: (flush: () => void) => () => void;
}

/**
 * Editing the text of one element in place (EL-1). While the editor is open it holds the text; this
 * saves it to the deck in bursts (after a pause, and when editing ends), each burst one command, and
 * works out the height a text box needs as it grows. Decision 18: what is shown while typing is a
 * draft; the deck gets whole steps.
 */
export function useTextEditing({ slide, save, remove, registerFlush }: Params): TextEditing {
  const [editing, setEditing] = useState<TextEditing['editing']>();
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState<ElementChange | undefined>();
  const [format, setFormat] = useState<TextFormat | undefined>();
  const [version, setVersion] = useState(0);

  const pending = useRef<{ id: Id; doc: RichText } | undefined>(undefined);
  const saved = useRef<string | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);
  const measuring = useRef(0);
  const current = useRef<Id | undefined>(undefined);
  const latest = useRef({ slide, save, remove });
  useEffect(() => {
    latest.current = { slide, save, remove };
  });

  const flush = useCallback((final: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const id = current.current;
    if (id === undefined) return;
    const typed = pending.current;
    if (final) pending.current = undefined;
    const { slide: now, save: saveNow, remove: removeNow } = latest.current;
    const element = now.elements.find((e) => e.id === id);
    if (!element) return;
    const stored = textOf(element);
    // A text box with no words in it is not kept, whether it was emptied or never filled.
    if (final && isTextBox(element) && isEmptyText(typed?.doc ?? stored ?? emptyText())) {
      removeNow([id]);
      return;
    }
    if (!typed) return;
    const json = JSON.stringify(typed.doc);
    if (json === saved.current || (stored && json === JSON.stringify(stored))) return;
    if (!stored && isEmptyText(typed.doc)) return;
    saved.current = json;
    // Bursts of typing a second apart or less are one step to undo.
    saveNow([{ id, props: isTextBox(element) ? { doc: typed.doc } : { text: typed.doc } }], {
      label: 'Edit text',
      mergeKey: `text:${id}`,
    });
  }, []);

  const saveNow = useCallback(() => {
    flush(false);
  }, [flush]);

  const reload = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = undefined;
    saved.current = undefined;
    measuring.current += 1;
    setHeight(undefined);
    setReady(false);
    setVersion((was) => was + 1);
  }, []);

  const finish = useCallback(() => {
    flush(true);
    current.current = undefined;
    measuring.current += 1;
    setEditing(undefined);
    setReady(false);
    setHeight(undefined);
    setFormat(undefined);
  }, [flush]);

  const start = useCallback(
    (id: Id, at?: Point) => {
      if (current.current !== undefined && current.current !== id) flush(true);
      if (current.current === id) return;
      current.current = id;
      saved.current = undefined;
      pending.current = undefined;
      setReady(false);
      setHeight(undefined);
      setEditing({ id, at });
    },
    [flush],
  );

  const onDraft = useCallback(
    (doc: RichText) => {
      const id = current.current;
      if (id === undefined) return;
      pending.current = { id, doc };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        flush(false);
      }, BURST_MS);

      const element = latest.current.slide.elements.find((e) => e.id === id);
      if (!element || !isTextBox(element)) return;
      measuring.current += 1;
      const token = measuring.current;
      // A font just chosen may still be loading: measure once it has, never in a fallback font.
      void ensureFonts(doc).then(() => {
        if (token !== measuring.current) return;
        setHeight({ id, props: { height: measureTextHeight({ ...element, doc }) } });
      });
    },
    [flush],
  );

  const markReady = useCallback(() => {
    setReady(true);
  }, []);

  // The tab closing or the deck being left saves what is typed, without ending the editing.
  useEffect(
    () =>
      registerFlush(() => {
        flush(false);
      }),
    [registerFlush, flush],
  );

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  return {
    editing,
    ready,
    start,
    finish,
    onDraft,
    saveNow,
    reload,
    version,
    markReady,
    height,
    format,
    setFormat,
  };
}
