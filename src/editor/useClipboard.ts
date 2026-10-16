import { useCallback, useEffect, useRef } from 'react';
import {
  copiesOf,
  createText,
  isShape,
  isTextBox,
  parseElements,
  plainText,
  serialiseElements,
  systemEnv,
  textFromString,
  type Id,
  type SlideElement,
} from '@/model';

/** Copy, cut, paste, duplicate and delete elements (EL-7). */

export const ELEMENTS_MIME = 'application/x-cue-elements';

/** How far a pasted or duplicated copy sits from what it copies, in slide pixels. */
export const PASTE_OFFSET = 24;

/** Where text pasted from another program lands, in slide pixels. */
const TEXT_AT = { x: 160, y: 160 };

/**
 * What was last copied in Cue, kept here as well as on the system clipboard. The menu's Paste uses it
 * (a page may not read the system clipboard unasked), and so does a paste when the browser did not
 * pass on our own format. It outlives the editor, so a copy can be pasted into another deck.
 */
let internal: { elements: readonly SlideElement[] } | undefined;

/** Pasting the same thing again puts each copy a little further on, so they do not hide one another. */
let run: { key: string; count: number } | undefined;

function nextOffset(key: string): number {
  run = run?.key === key ? { key, count: run.count + 1 } : { key, count: 1 };
  return PASTE_OFFSET * run.count;
}

/** Forget what was copied (for tests). */
export function clearInternalClipboard(): void {
  internal = undefined;
  run = undefined;
}

/** The words of the elements, one paragraph each, for pasting into other programs. */
export function wordsOf(elements: readonly SlideElement[]): string {
  return elements
    .flatMap((element) => {
      const doc = isTextBox(element) ? element.doc : isShape(element) ? element.text : undefined;
      return doc ? [plainText(doc)] : [];
    })
    .join('\n');
}

const wordsKey = (elements: readonly SlideElement[]) => serialiseElements(elements);

/** Typing in a field or an editor has its own cut, copy and paste. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

interface Params {
  /** The selected elements, as saved. */
  readonly selected: readonly SlideElement[];
  readonly addElements: (elements: readonly SlideElement[]) => void;
  readonly removeElements: (ids: readonly Id[]) => void;
  readonly select: (ids: readonly Id[]) => void;
  /** A new text box from pasted words: given its height from its text. */
  readonly fitted: (element: SlideElement) => SlideElement;
  /** Give the slide the keyboard again after a menu. */
  readonly focusCanvas: () => void;
}

export interface Clipboard {
  readonly copy: () => void;
  readonly cut: () => void;
  readonly paste: () => void;
  readonly duplicate: () => void;
  readonly remove: () => void;
  /** Something copied in Cue can be pasted. */
  readonly canPaste: () => boolean;
}

export function useClipboard(params: Params): Clipboard {
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  });

  /** Put copies of these on the slide, on top, offset, and select them. */
  const place = useCallback((elements: readonly SlideElement[], offset: number) => {
    const { addElements, select, focusCanvas } = latest.current;
    const copies = copiesOf(elements, systemEnv.newId, offset);
    addElements(copies);
    select(copies.map((copy) => copy.id));
    focusCanvas();
  }, []);

  const pasteInternal = useCallback(() => {
    if (!internal) return;
    place(internal.elements, nextOffset(wordsKey(internal.elements)));
  }, [place]);

  const copy = useCallback(() => {
    const { selected } = latest.current;
    if (selected.length === 0) return;
    internal = { elements: selected };
    // Also on the system clipboard, through the copy event below. `execCommand` is the one way to
    // fire that event from a menu click with our own data type in it; the async clipboard API takes
    // only a few types.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('copy');
  }, []);

  const remove = useCallback(() => {
    const { selected, removeElements, focusCanvas } = latest.current;
    if (selected.length === 0) return;
    removeElements(selected.map((element) => element.id));
    focusCanvas();
  }, []);

  const cut = useCallback(() => {
    copy();
    remove();
  }, [copy, remove]);

  const duplicate = useCallback(() => {
    const { selected } = latest.current;
    if (selected.length > 0) place(selected, PASTE_OFFSET);
  }, [place]);

  useEffect(() => {
    // Ctrl+C and Ctrl+X, and Copy from the menu, arrive as events that carry the clipboard.
    function onCopy(event: ClipboardEvent) {
      if (isTyping(event.target)) return;
      const { selected } = latest.current;
      if (selected.length === 0 || !event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData(ELEMENTS_MIME, serialiseElements(selected));
      event.clipboardData.setData('text/plain', wordsOf(selected));
      internal = { elements: selected };
    }

    function onCut(event: ClipboardEvent) {
      if (isTyping(event.target) || latest.current.selected.length === 0) return;
      onCopy(event);
      remove();
    }

    function onPaste(event: ClipboardEvent) {
      if (isTyping(event.target) || !event.clipboardData) return;
      event.preventDefault();
      const ours = event.clipboardData.getData(ELEMENTS_MIME);
      const elements = ours === '' ? undefined : parseElements(ours);
      if (elements) {
        place(elements, nextOffset(ours));
        return;
      }
      const words = event.clipboardData.getData('text/plain');
      // Our own copy, when the browser dropped our format: its words match what was copied.
      if (internal && words === wordsOf(internal.elements)) {
        pasteInternal();
        return;
      }
      if (words.trim() === '') {
        pasteInternal();
        return;
      }
      const { addElements, select, fitted, focusCanvas } = latest.current;
      const box = fitted(createText(systemEnv.newId(), TEXT_AT, textFromString(words)));
      addElements([box]);
      select([box.id]);
      focusCanvas();
    }

    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, [place, pasteInternal, remove]);

  const canPaste = useCallback(() => internal !== undefined, []);

  return { copy, cut, paste: pasteInternal, duplicate, remove, canPaste };
}
