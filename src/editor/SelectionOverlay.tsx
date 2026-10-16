import {
  HANDLES,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  boundsOf,
  groupBounds,
  lineEnds,
  type Box,
  type Rect,
  type SlideElement,
} from '@/model';
import { boxOf } from './gestures';
import { isLineElement } from './shapeLabels';

/**
 * The selection chrome (design: Main): a green outline with white square handles, a round handle to
 * turn it, and a chip above it that names what is selected and, while you drag, shows the numbers.
 * Everything is placed in percentages of the slide, so it needs no knowledge of the zoom.
 */

const pctX = (x: number) => `${String((x / SLIDE_WIDTH) * 100)}%`;
const pctY = (y: number) => `${String((y / SLIDE_HEIGHT) * 100)}%`;

function boxStyle(box: Box) {
  return {
    left: pctX(box.x),
    top: pctY(box.y),
    width: pctX(box.width),
    height: pctY(box.height),
    transform: box.rotation === 0 ? undefined : `rotate(${String(box.rotation)}deg)`,
  };
}

interface Props {
  /** The selected elements as they are now, including a drag in progress. */
  readonly elements: readonly SlideElement[];
  /** What the chip says: the name and fade, or the numbers of the drag. */
  readonly chip: string;
  readonly marquee: Rect | undefined;
}

export function SelectionOverlay({ elements, chip, marquee }: Props) {
  const boxes = elements.map(boxOf);
  const only = elements.length === 1 ? elements[0] : undefined;
  const bounds = boxes.length > 0 ? groupBounds(boxes) : undefined;

  return (
    <div className="sel-overlay" aria-hidden="true">
      {marquee && (
        <div
          className="sel-marquee"
          style={{
            left: pctX(marquee.x),
            top: pctY(marquee.y),
            width: pctX(marquee.width),
            height: pctY(marquee.height),
          }}
        />
      )}

      {only && isLineElement(only) ? (
        <LineHandles box={boxOf(only)} />
      ) : (
        bounds && (
          <>
            {elements.length > 1 &&
              boxes.map((box, index) => (
                <div key={elements[index]?.id} className="sel-member" style={boxStyle(box)} />
              ))}
            <div
              className="sel-box"
              style={boxStyle(only ? boxOf(only) : { ...bounds, rotation: 0 })}
            >
              {HANDLES.map((handle) => (
                <span key={handle} className={`handle handle-${handle}`} data-handle={handle} />
              ))}
              <span className="handle handle-rotate" data-handle="rotate" />
            </div>
          </>
        )
      )}

      {bounds && (
        <span
          className="sel-chip"
          style={{ left: pctX(boundsOf({ ...bounds, rotation: 0 }).x), top: pctY(bounds.y) }}
        >
          {chip}
        </span>
      )}
    </div>
  );
}

/** A line is selected by its two ends, which are also how it is resized and turned. */
function LineHandles({ box }: { readonly box: Box }) {
  const { start, end } = lineEnds(box);
  return (
    <>
      <span
        className="handle handle-end"
        data-handle="start"
        style={{ left: pctX(start.x), top: pctY(start.y) }}
      />
      <span
        className="handle handle-end"
        data-handle="end"
        style={{ left: pctX(end.x), top: pctY(end.y) }}
      />
    </>
  );
}
