import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { Id, Slide } from '@/model';
import { SlideView } from './SlideView';

interface SlideRailProps {
  readonly slides: readonly Slide[];
  readonly currentId: Id;
  readonly onSelect: (id: Id) => void;
  readonly onAdd: () => void;
}

/**
 * The thumbnail rail (SL-1, SL-2). A listbox: one stop in the Tab order, Up and Down move the
 * selection (and the canvas follows), Home and End jump to the ends.
 */
export function SlideRail({ slides, currentId, onSelect, onAdd }: SlideRailProps) {
  const items = useRef(new Map<Id, HTMLElement>());

  useEffect(() => {
    items.current.get(currentId)?.scrollIntoView({ block: 'nearest' });
  }, [currentId]);

  function onKeyDown(event: KeyboardEvent, index: number) {
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
    if (target === undefined) return;
    event.preventDefault();
    const next = slides[Math.min(slides.length - 1, Math.max(0, target))];
    if (!next) return;
    onSelect(next.id);
    items.current.get(next.id)?.focus();
  }

  return (
    <aside className="slide-rail" aria-label="Slide panel">
      <div className="rail-header">
        <span className="section-label">Slides</span>
        <span className="caption">{slides.length}</span>
      </div>
      <div className="rail-list" role="listbox" aria-label="Slides" aria-orientation="vertical">
        {slides.map((slide, index) => {
          const selected = slide.id === currentId;
          return (
            <div
              key={slide.id}
              ref={(element) => {
                if (element) items.current.set(slide.id, element);
                else items.current.delete(slide.id);
              }}
              className="rail-item"
              role="option"
              aria-label={`Slide ${String(index + 1)}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                onSelect(slide.id);
              }}
              onKeyDown={(event) => {
                onKeyDown(event, index);
              }}
            >
              <span className="rail-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="rail-thumb">
                <SlideView slide={slide} />
              </span>
            </div>
          );
        })}
      </div>
      <div className="rail-footer">
        <button type="button" className="new-slide-button" onClick={onAdd}>
          New slide
        </button>
      </div>
    </aside>
  );
}
