import { SLIDE_HEIGHT, SLIDE_WIDTH, type Guide } from '@/model';

/**
 * The thin lines drawn while a box snaps to the slide or to another element (EL-6). Overlay only:
 * they are there while the mouse is down and are never in a thumbnail, a Preview or the show.
 */
export function SnapGuides({ guides }: { readonly guides: readonly Guide[] }) {
  if (guides.length === 0) return null;
  return (
    <svg
      className="snap-guides"
      viewBox={`0 0 ${String(SLIDE_WIDTH)} ${String(SLIDE_HEIGHT)}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {guides.map((guide) =>
        guide.axis === 'x' ? (
          <line
            key={`x${String(guide.at)}`}
            x1={guide.at}
            x2={guide.at}
            y1={guide.from}
            y2={guide.to}
          />
        ) : (
          <line
            key={`y${String(guide.at)}`}
            x1={guide.from}
            x2={guide.to}
            y1={guide.at}
            y2={guide.at}
          />
        ),
      )}
    </svg>
  );
}
