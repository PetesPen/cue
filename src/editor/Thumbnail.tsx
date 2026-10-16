import { useEffect, useRef, useState } from 'react';
import type { Slide } from '@/model';
import { SlideView } from './SlideView';

/** How far beyond the visible part of the rail a thumbnail is drawn ahead of being scrolled to. */
const DRAW_AHEAD = '400px 0px';

/**
 * A slide's thumbnail in the rail (UX-3). A deck of 50 slides has 50 thumbnails, and each is a full
 * drawing of its slide, so only the ones near the visible part of the rail are drawn; the rest are a
 * blank of the slide's own colour, at the same size, until they are scrolled near. Once drawn, a
 * thumbnail stays (it is kept up to date like any other).
 */
export function Thumbnail({
  slide,
  eager = false,
}: {
  readonly slide: Slide;
  /** Draw at once: the first thumbnails, which are on screen when the rail opens. */
  readonly eager?: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);

  useEffect(() => {
    const element = holder.current;
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { root: element.closest('.rail-list'), rootMargin: DRAW_AHEAD },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [near]);

  return (
    <div ref={holder} className="rail-thumb-body" data-drawn={near}>
      {near ? (
        <SlideView slide={slide} />
      ) : (
        <div className="rail-thumb-blank" style={{ background: slide.background }} />
      )}
    </div>
  );
}
