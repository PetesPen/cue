import { useRef, useState, type PointerEvent, type RefObject } from 'react';

/** A pointer must move this far (screen pixels) before a press on a row becomes a drag. */
const DRAG_THRESHOLD = 5;

export interface ListDrag {
  readonly id: string;
  /** Where the dragged row would land, as its place in the order afterwards. */
  readonly toIndex: number;
  /** Where the drop line shows, in pixels from the top of the list's content. */
  readonly lineTop: number;
}

interface Options {
  /** The rows, in order. */
  readonly ids: readonly string[];
  /** The row elements, by id. */
  readonly rows: RefObject<Map<string, HTMLElement>>;
  /** The element the drop line is placed in (it scrolls and is `position: relative`). */
  readonly list: RefObject<HTMLElement | null>;
  readonly onMove: (id: string, toIndex: number) => void;
}

/**
 * Drag rows of a vertical list to a new place, with a line showing where the row will land (the way
 * the slide rail does it, SL-3; used for the animation steps, AN-5). A press must move a few pixels
 * before it is a drag, so a click still selects; Escape cancels. `ignoreClick` says that the click
 * that ends a drag is not a click on a row.
 */
export function useListDrag({ ids, rows, list, onMove }: Options) {
  const [drag, setDrag] = useState<ListDrag | undefined>();
  const ignoreClick = useRef(false);

  /** Where a row dragged to this height would land, and where to draw the line. */
  function placeFor(id: string, clientY: number): ListDrag {
    const from = ids.indexOf(id);
    const box = list.current?.getBoundingClientRect();
    const rects = ids.map((each) => rows.current.get(each)?.getBoundingClientRect());
    // The slot is how many rows are wholly above the pointer's height: 0 puts it first.
    let slot = 0;
    for (const rect of rects) if (rect && clientY > rect.top + rect.height / 2) slot += 1;
    const toIndex = slot > from ? slot - 1 : slot;
    const edge = rects[slot]?.top ?? rects.at(-1)?.bottom ?? 0;
    const lineTop = box && list.current ? edge - box.top + list.current.scrollTop - 1 : 0;
    return { id, toIndex, lineTop };
  }

  function startDrag(event: PointerEvent<HTMLElement>, id: string) {
    if (event.button !== 0) return;
    const startY = event.clientY;
    let dragging = false;
    let last: ListDrag | undefined;

    const move = (e: globalThis.PointerEvent) => {
      if (!dragging && Math.abs(e.clientY - startY) < DRAG_THRESHOLD) return;
      dragging = true;
      last = placeFor(id, e.clientY);
      setDrag(last);
    };
    const end = (commit: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', onKey, true);
      setDrag(undefined);
      if (!dragging) return;
      ignoreClick.current = true;
      window.setTimeout(() => {
        ignoreClick.current = false;
      }, 0);
      if (commit && last && last.toIndex !== ids.indexOf(id)) onMove(id, last.toIndex);
    };
    const up = () => {
      end(true);
    };
    const cancel = () => {
      end(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      end(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', onKey, true);
  }

  return { drag, startDrag, ignoreClick };
}
