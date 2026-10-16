import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  clickOfStep,
  isShape,
  resolve,
  type MoveStep,
  type Slide,
  type SlideElement,
} from '@/model';
import { elementName } from './labels';

interface MoveGhostProps {
  readonly slide: Slide;
  /** The Move step whose end is shown, with a drag in progress already applied. */
  readonly step: MoveStep;
  readonly element: SlideElement;
  /** A drag in progress: shown, not saved (decision 18). */
  readonly onDraft: (end: { readonly x: number; readonly y: number } | undefined) => void;
  /** The end is set: one step to undo. */
  readonly onCommit: (end: { readonly x: number; readonly y: number }, nudged: boolean) => void;
}

const pctX = (x: number) => `${String((x / SLIDE_WIDTH) * 100)}%`;
const pctY = (y: number) => `${String((y / SLIDE_HEIGHT) * 100)}%`;

/**
 * The end of a Move on the canvas (AN-3; design: Editor-Animate): a dashed copy of the element where
 * it will end, labelled "Ends here · drag", and a dotted arrow from where it starts. Drag the copy to
 * set the end; with the keyboard, the arrow keys move it (Shift: ten times as far). Overlay only: it
 * is not in thumbnails, in Preview or in the show.
 */
export function MoveGhost({ slide, step, element, onDraft, onCommit }: MoveGhostProps) {
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | {
        readonly x0: number;
        readonly y0: number;
        readonly startX: number;
        readonly startY: number;
        readonly scale: number;
        moved: boolean;
        end: { x: number; y: number };
      }
    | undefined
  >(undefined);

  // Where the element is when this step begins: its own place, or where an earlier Move left it.
  const index = slide.animations.indexOf(step);
  const earlier = resolve(slide, Math.max(0, clickOfStep(slide.animations, index) - 1)).positions;
  const start = earlier.get(step.element) ?? { x: element.x, y: element.y };
  const from = { x: start.x + element.width / 2, y: start.y + element.height / 2 };
  const to = { x: step.x + element.width / 2, y: step.y + element.height / 2 };
  const name = elementName(element);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    // The ghost is picked up here; the slide behind must not start a selection of its own.
    event.stopPropagation();
    const width = host.current?.getBoundingClientRect().width ?? 0;
    if (width === 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is already gone: the drag simply follows the events it still gets.
    }
    drag.current = {
      x0: step.x,
      y0: step.y,
      startX: event.clientX,
      startY: event.clientY,
      scale: width / SLIDE_WIDTH,
      moved: false,
      end: { x: step.x, y: step.y },
    };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    const dx = (event.clientX - current.startX) / current.scale;
    const dy = (event.clientY - current.startY) / current.scale;
    if (!current.moved && Math.hypot(dx, dy) < 3) return;
    current.moved = true;
    current.end = { x: Math.round(current.x0 + dx), y: Math.round(current.y0 + dy) };
    onDraft(current.end);
  }

  function finish(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    const current = drag.current;
    drag.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!current?.moved) return;
    onDraft(undefined);
    if (commit) onCommit(current.end, false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!event.key.startsWith('Arrow') || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    const by = event.shiftKey ? 10 : 1;
    const dx = event.key === 'ArrowLeft' ? -by : event.key === 'ArrowRight' ? by : 0;
    const dy = event.key === 'ArrowUp' ? -by : event.key === 'ArrowDown' ? by : 0;
    onCommit({ x: step.x + dx, y: step.y + dy }, true);
  }

  return (
    <div ref={host} className="move-overlay">
      <svg
        className="move-path"
        viewBox={`0 0 ${String(SLIDE_WIDTH)} ${String(SLIDE_HEIGHT)}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="move-arrow-head"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M1 1 9 5 1 9" className="move-path-head" />
          </marker>
        </defs>
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          className="move-path-line"
          markerEnd="url(#move-arrow-head)"
        />
      </svg>
      <button
        type="button"
        className="move-ghost"
        aria-label={`End of the move of ${name}: X ${String(step.x)}, Y ${String(step.y)}. Drag it, or use the arrow keys.`}
        style={{
          left: pctX(step.x),
          top: pctY(step.y),
          width: pctX(element.width),
          height: pctY(element.height),
          transform: element.rotation === 0 ? undefined : `rotate(${String(element.rotation)}deg)`,
          borderRadius: isShape(element) && element.shape === 'ellipse' ? '50%' : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => {
          finish(event, true);
        }}
        onPointerCancel={(event) => {
          finish(event, false);
        }}
        onKeyDown={onKeyDown}
      />
      <span
        className="move-label"
        aria-hidden="true"
        style={{ left: pctX(step.x + element.width / 2), top: pctY(step.y + element.height) }}
      >
        Ends here · drag
      </span>
    </div>
  );
}
