import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import type { Id, Slide } from '@/model';
import { ContextMenu, type MenuItem } from './Menu';
import { SlideView } from './SlideView';

interface SlideRailProps {
  readonly slides: readonly Slide[];
  readonly currentId: Id;
  readonly onSelect: (id: Id) => void;
  readonly onAdd: () => void;
  /** Put a slide at another place; `toIndex` is its place afterwards, from 0 (SL-3). */
  readonly onMove: (id: Id, toIndex: number) => void;
  readonly onDuplicate: (id: Id) => void;
  readonly onDelete: (id: Id) => void;
}

/** A pointer must move this far (screen pixels) before a press on a thumbnail becomes a drag. */
const DRAG_THRESHOLD = 5;

interface Drag {
  readonly id: Id;
  /** Where the dragged slide would land, as its place in the order afterwards. */
  readonly toIndex: number;
  /** Where the line shows, in pixels from the top of the list's content. */
  readonly lineTop: number;
}

/**
 * The thumbnail rail (SL-1, SL-2, SL-3, SL-4). A listbox: one stop in the Tab order, Up and Down move
 * the selection (and the canvas follows), Home and End jump to the ends. A thumbnail can be dragged
 * to a new place, with a line showing where it will land; the same can be done with Ctrl+Shift+Up and
 * Down. Ctrl+D duplicates the slide and Delete deletes it; the right-click menu has all four.
 */
export function SlideRail({
  slides,
  currentId,
  onSelect,
  onAdd,
  onMove,
  onDuplicate,
  onDelete,
}: SlideRailProps) {
  const items = useRef(new Map<Id, HTMLElement>());
  const list = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | undefined>();
  const [menu, setMenu] = useState<{ id: Id; x: number; y: number } | undefined>();
  // A drag ends with a click on the thumbnail the pointer lets go over; that click is not a selection.
  const ignoreClick = useRef(false);

  useEffect(() => {
    items.current.get(currentId)?.scrollIntoView({ block: 'nearest' });
  }, [currentId]);

  /** Where a slide dragged to this height would land, and where to draw the line. */
  function placeFor(id: Id, clientY: number): Drag {
    const from = slides.findIndex((slide) => slide.id === id);
    const box = list.current?.getBoundingClientRect();
    const rects = slides.map((slide) => items.current.get(slide.id)?.getBoundingClientRect());
    // The slot is how many thumbnails are wholly above the pointer's height: 0 puts it first.
    let slot = 0;
    for (const rect of rects) if (rect && clientY > rect.top + rect.height / 2) slot += 1;
    const toIndex = slot > from ? slot - 1 : slot;
    const edge = rects[slot]?.top ?? rects.at(-1)?.bottom ?? 0;
    const lineTop = box && list.current ? edge - box.top + list.current.scrollTop - 6 : 0;
    return { id, toIndex, lineTop };
  }

  function onPointerDown(event: PointerEvent<HTMLElement>, id: Id) {
    if (event.button !== 0 || menu) return;
    const startY = event.clientY;
    let dragging = false;
    let last: Drag | undefined;

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
      const from = slides.findIndex((slide) => slide.id === id);
      if (commit && last && last.toIndex !== from) {
        onSelect(id);
        onMove(id, last.toIndex);
      }
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

  function onKeyDown(event: KeyboardEvent, index: number, id: Id) {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      event.stopPropagation();
      const to = index + (event.key === 'ArrowUp' ? -1 : 1);
      if (to >= 0 && to < slides.length) {
        onMove(id, to);
        // The slide keeps the focus in its new place once the rail has been drawn again.
        window.setTimeout(() => items.current.get(id)?.focus(), 0);
      }
      return;
    }
    if (modifier && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) onDuplicate(id);
      return;
    }
    if (!modifier && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      event.stopPropagation();
      onDelete(id);
      return;
    }

    const target =
      event.key === 'ArrowDown'
        ? index + 1
        : event.key === 'ArrowUp'
          ? index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? slides.length - 1
              : undefined;
    if (target === undefined || modifier) return;
    event.preventDefault();
    const next = slides[Math.min(slides.length - 1, Math.max(0, target))];
    if (!next) return;
    onSelect(next.id);
    items.current.get(next.id)?.focus();
  }

  function openMenu(event: MouseEvent, id: Id) {
    event.preventDefault();
    onSelect(id);
    setMenu({ id, x: event.clientX, y: event.clientY });
  }

  const menuIndex = menu ? slides.findIndex((slide) => slide.id === menu.id) : -1;
  const menuItems: MenuItem[] = menu
    ? [
        {
          id: 'duplicate',
          label: 'Duplicate slide',
          shortcut: 'Ctrl+D',
          keyShortcuts: 'Control+D Meta+D',
          onSelect: () => {
            onDuplicate(menu.id);
          },
        },
        {
          id: 'delete',
          label: 'Delete slide',
          shortcut: 'Del',
          keyShortcuts: 'Delete',
          danger: true,
          onSelect: () => {
            onDelete(menu.id);
          },
        },
        {
          id: 'up',
          label: 'Move up',
          shortcut: 'Ctrl+Shift+↑',
          keyShortcuts: 'Control+Shift+ArrowUp',
          separated: true,
          disabled: menuIndex <= 0,
          onSelect: () => {
            onMove(menu.id, menuIndex - 1);
          },
        },
        {
          id: 'down',
          label: 'Move down',
          shortcut: 'Ctrl+Shift+↓',
          keyShortcuts: 'Control+Shift+ArrowDown',
          disabled: menuIndex >= slides.length - 1,
          onSelect: () => {
            onMove(menu.id, menuIndex + 1);
          },
        },
      ]
    : [];

  return (
    <aside className="slide-rail" aria-label="Slide panel">
      <div className="rail-header">
        <span className="section-label">Slides</span>
        <span className="caption">{slides.length}</span>
      </div>
      <div
        ref={list}
        className="rail-list"
        role="listbox"
        aria-label="Slides"
        aria-orientation="vertical"
      >
        {slides.map((slide, index) => {
          const selected = slide.id === currentId;
          return (
            <div
              key={slide.id}
              ref={(element) => {
                if (element) items.current.set(slide.id, element);
                else items.current.delete(slide.id);
              }}
              className={drag?.id === slide.id ? 'rail-item rail-item-dragged' : 'rail-item'}
              role="option"
              aria-label={`Slide ${String(index + 1)}`}
              aria-selected={selected}
              aria-keyshortcuts="Control+D Delete Control+Shift+ArrowUp Control+Shift+ArrowDown"
              tabIndex={selected ? 0 : -1}
              onPointerDown={(event) => {
                onPointerDown(event, slide.id);
              }}
              onClick={() => {
                if (!ignoreClick.current) onSelect(slide.id);
              }}
              onContextMenu={(event) => {
                openMenu(event, slide.id);
              }}
              onKeyDown={(event) => {
                onKeyDown(event, index, slide.id);
              }}
            >
              <span className="rail-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="rail-thumb">
                <SlideView slide={slide} />
                {slide.animations.length > 0 && <span className="rail-dot" aria-hidden="true" />}
              </span>
            </div>
          );
        })}
        {drag && drag.toIndex !== slides.findIndex((slide) => slide.id === drag.id) && (
          <div
            className="rail-drop-line"
            style={{ top: `${String(drag.lineTop)}px` }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="rail-footer">
        <button type="button" className="new-slide-button" onClick={onAdd}>
          New slide
        </button>
      </div>
      {menu && (
        <ContextMenu
          label="Slide actions"
          items={menuItems}
          x={menu.x}
          y={menu.y}
          onClose={(restoreFocus) => {
            const id = menu.id;
            setMenu(undefined);
            if (restoreFocus) items.current.get(id)?.focus();
          }}
        />
      )}
    </aside>
  );
}
