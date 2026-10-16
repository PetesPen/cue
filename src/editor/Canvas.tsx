import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  HANDLES,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  groupBounds,
  isImage,
  systemEnv,
  type ElementChange,
  type Id,
  type Point,
  type Rect,
  type Slide,
  type SlideElement,
} from '@/model';
import {
  DRAG_THRESHOLD,
  applyDraft,
  boxOf,
  boxesOf,
  changesFor,
  drawnShape,
  drawnText,
  marqueeRect,
  marqueeSelection,
  pickElement,
  type Gesture,
  type Tool,
} from './gestures';
import { SelectionOverlay } from './SelectionOverlay';
import type { EditMeta } from './useDeckSession';
import { SlideView, type SlideViewHandle } from './SlideView';
import { StepBadges } from './animation/StepBadges';
import type { Look } from '@/render';
import { SHAPE_LABELS, canEditText, describeSelection } from './shapeLabels';

/** "an ellipse", "a rectangle". */
function withArticle(label: string): string {
  const lower = label.toLowerCase();
  return `${/^[aeiou]/.test(lower) ? 'an' : 'a'} ${lower}`;
}

/** How near (in screen pixels) a click must be to pick a line. */
const LINE_PICK_DISTANCE = 8;

interface Active {
  readonly gesture: Gesture;
  readonly pointerId: number;
  readonly startClient: Point;
  moved: boolean;
  /** For a click on one of several selected shapes: it becomes the only selection on release. */
  readonly clickedId?: Id;
}

interface CanvasProps {
  /** The slide as it is now, including any draft in progress (see `applyDraft`). */
  readonly slide: Slide;
  readonly label: string;
  readonly selection: readonly Id[];
  readonly onSelect: (ids: readonly Id[]) => void;
  /** The tool that is armed: the next drag draws that shape, or a text box. */
  readonly tool: Tool | undefined;
  readonly onToolDone: () => void;
  readonly onAddElement: (element: SlideElement) => void;
  /** One command per finished gesture or key press (decision 18). */
  readonly onUpdate: (changes: readonly ElementChange[], meta?: EditMeta) => void;
  /** A drag in progress, to be shown but not saved. */
  readonly onDraft: (changes: readonly ElementChange[] | undefined) => void;
  readonly onDrawing: (element: SlideElement | undefined) => void;
  readonly onContextMenu: (at: Point) => void;
  /** Picture files dropped on the slide, and where (client pixels). */
  readonly onDropFiles: (files: readonly File[], at: { x: number; y: number }) => void;
  /** The element whose text is being edited in place, if any (its editor is the `editor` child). */
  readonly editingId: Id | undefined;
  /** Start editing the text of an element; `at` is where the pointer was, to put the cursor there. */
  readonly onEdit: (id: Id, at?: Point) => void;
  readonly onFinishEdit: () => void;
  /** The text editor and its toolbar, drawn over the slide. */
  readonly editor?: ReactNode;
  readonly frameRef: RefObject<HTMLDivElement | null>;
  /** How animations show: faded here in the editor (AN-1), or at a click while previewing (AN-6). */
  readonly look: Look;
  readonly viewRef: RefObject<SlideViewHandle | null>;
  /** Show a numbered badge for each animation step; the active step's is green (Animate tab). */
  readonly badges: { readonly activeStepId: Id | undefined } | undefined;
  /** While Preview plays: a click on the slide plays the next click, and nothing can be picked up. */
  readonly onPreviewAdvance: (() => void) | undefined;
  /** Drawn over the slide while the Animate tab is open: the end of a Move (AN-3). */
  readonly animateOverlay?: ReactNode;
  /** With nothing selected, the up and down arrows go to the previous and next slide (UX-2). */
  readonly onStepSlide: (by: -1 | 1) => void;
}

function readoutFor(gesture: Gesture, changes: readonly ElementChange[], slide: Slide): string {
  // The elements as the new changes leave them (not as the last frame drew them).
  const now = applyDraft(slide, changes, undefined).elements.filter((e) =>
    changes.some((c) => c.id === e.id),
  );
  const bounds = groupBounds(now.map(boxOf));
  const round = (n: number) => String(Math.round(n));
  switch (gesture.kind) {
    case 'move':
      return `X ${round(bounds.x)} · Y ${round(bounds.y)}`;
    case 'resize':
      return `W ${round(bounds.width)} · H ${round(bounds.height)}`;
    case 'lineEnd': {
      const line = now[0];
      return line ? `${round(line.width)} px · ${round(line.rotation)}°` : '';
    }
    case 'rotate':
      return `${round(now[0]?.rotation ?? 0)}°`;
    default:
      return '';
  }
}

/**
 * The slide on the canvas, with direct manipulation (EL-5, EL-3): click and Shift-click to select, a
 * box to select several, drag to move, handles to resize and turn, arrow keys to nudge, and a shape
 * tool to draw. Nothing is saved while a drag is going on: the drag is shown as a draft, and ONE
 * command is committed when it ends (decision 18).
 */
export function Canvas({
  slide,
  label,
  selection,
  onSelect,
  tool,
  onToolDone,
  onAddElement,
  onUpdate,
  onDraft,
  onDrawing,
  onContextMenu,
  onDropFiles,
  editingId,
  onEdit,
  onFinishEdit,
  editor,
  frameRef,
  look,
  viewRef,
  badges,
  onPreviewAdvance,
  animateOverlay,
  onStepSlide,
}: CanvasProps) {
  const active = useRef<Active | undefined>(undefined);
  const [readout, setReadout] = useState<string | undefined>();
  const [marquee, setMarquee] = useState<Rect | undefined>();
  const [dropping, setDropping] = useState(false);

  const selected = slide.elements.filter((element) => selection.includes(element.id));

  /** The pointer in slide pixels, whatever the zoom. */
  function toSlide(event: { clientX: number; clientY: number }): Point {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * SLIDE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * SLIDE_HEIGHT,
    };
  }

  function lineSlop(): number {
    const width = frameRef.current?.getBoundingClientRect().width ?? SLIDE_WIDTH;
    return (LINE_PICK_DISTANCE * SLIDE_WIDTH) / Math.max(width, 1);
  }

  function begin(event: PointerEvent<HTMLDivElement>, gesture: Gesture, clickedId?: Id) {
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = {
      gesture,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      moved: false,
      ...(clickedId === undefined ? {} : { clickedId }),
    };
  }

  function clearGesture() {
    active.current = undefined;
    onDraft(undefined);
    onDrawing(undefined);
    setReadout(undefined);
    setMarquee(undefined);
  }

  /** Is this event inside the text editor or its toolbar? Those handle their own pointer. */
  function inEditor(target: EventTarget): boolean {
    return (
      target instanceof Element && target.closest('[data-text-surface], .text-toolbar') !== null
    );
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (onPreviewAdvance) {
      event.preventDefault();
      onPreviewAdvance();
      return;
    }
    if (editingId !== undefined) {
      if (inEditor(event.target)) return;
      onFinishEdit();
    }
    const point = toSlide(event);
    const handle =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-handle]') : null;

    if (handle?.dataset.handle) {
      const kind = handle.dataset.handle;
      const boxes = boxesOf(selected);
      const first = selected[0];
      if (kind === 'rotate') begin(event, { kind: 'rotate', start: point, boxes });
      else if ((kind === 'start' || kind === 'end') && first) {
        begin(event, {
          kind: 'lineEnd',
          start: point,
          which: kind,
          id: first.id,
          box: boxOf(first),
        });
      } else {
        const resizeHandle = HANDLES.find((h) => h === kind);
        if (resizeHandle) {
          // A picture dragged by a corner keeps its proportions; by a side, it is stretched on purpose.
          const lockAspect =
            selected.length === 1 &&
            first !== undefined &&
            isImage(first) &&
            resizeHandle.length === 2;
          begin(event, { kind: 'resize', start: point, handle: resizeHandle, boxes, lockAspect });
        }
      }
      return;
    }

    if (tool === 'text') {
      begin(event, { kind: 'drawText', start: point, id: systemEnv.newId() });
      return;
    }
    if (tool) {
      begin(event, { kind: 'draw', start: point, shape: tool, id: systemEnv.newId() });
      return;
    }

    const hit = pickElement(slide.elements, point, lineSlop());
    if (!hit) {
      if (!event.shiftKey) onSelect([]);
      begin(event, {
        kind: 'marquee',
        start: point,
        additive: event.shiftKey,
        previous: selection,
      });
      return;
    }

    let next = selection;
    if (event.shiftKey) {
      next = selection.includes(hit.id)
        ? selection.filter((id) => id !== hit.id)
        : [...selection, hit.id];
      onSelect(next);
      if (!next.includes(hit.id)) return;
    } else if (!selection.includes(hit.id)) {
      next = [hit.id];
      onSelect(next);
    }
    const moving = slide.elements.filter((element) => next.includes(element.id));
    begin(event, { kind: 'move', start: point, boxes: boxesOf(moving) }, hit.id);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = active.current;
    if (current?.pointerId !== event.pointerId) return;
    if (!current.moved) {
      const far =
        Math.hypot(event.clientX - current.startClient.x, event.clientY - current.startClient.y) >=
        DRAG_THRESHOLD;
      if (!far) return;
      current.moved = true;
    }
    const point = toSlide(event);
    const { gesture } = current;

    if (gesture.kind === 'marquee') {
      const area = marqueeRect(gesture.start, point);
      setMarquee(area);
      onSelect(marqueeSelection(area, slide.elements, gesture.additive, gesture.previous));
    } else if (gesture.kind === 'draw') {
      const shape = drawnShape(gesture, point, event.shiftKey, true);
      onDrawing(shape);
      setReadout(
        `${SHAPE_LABELS[shape.shape]} · W ${String(Math.round(shape.width))} · H ${String(Math.round(shape.height))}`,
      );
    } else if (gesture.kind === 'drawText') {
      const text = drawnText(gesture, point, true);
      onDrawing(text);
      setReadout(`Text · W ${String(Math.round(text.width))}`);
    } else {
      const changes = changesFor(gesture, point, event.shiftKey);
      onDraft(changes);
      setReadout(readoutFor(gesture, changes, slide));
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = active.current;
    if (current?.pointerId !== event.pointerId) return;
    const { gesture, moved } = current;
    const point = toSlide(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearGesture();

    switch (gesture.kind) {
      case 'move':
        if (moved) onUpdate(changesFor(gesture, point, event.shiftKey), { label: 'Move' });
        else if (current.clickedId && selection.length > 1 && !event.shiftKey) {
          onSelect([current.clickedId]);
        }
        break;
      case 'resize':
      case 'lineEnd':
        if (moved) onUpdate(changesFor(gesture, point, event.shiftKey), { label: 'Resize' });
        break;
      case 'rotate':
        if (moved) onUpdate(changesFor(gesture, point, event.shiftKey), { label: 'Rotate' });
        break;
      case 'draw': {
        const shape = drawnShape(gesture, point, event.shiftKey, moved);
        onAddElement(shape);
        onSelect([shape.id]);
        onToolDone();
        break;
      }
      case 'drawText': {
        const text = drawnText(gesture, point, moved);
        onAddElement(text);
        onSelect([text.id]);
        onToolDone();
        onEdit(text.id);
        break;
      }
      case 'marquee':
        break;
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // While text is edited, the keys are the editor's; while Preview plays, they are Preview's.
    if (editingId !== undefined || onPreviewAdvance) return;

    const only = selected.length === 1 ? selected[0] : undefined;
    if (event.key === 'Enter' && only && canEditText(only) && !active.current) {
      event.preventDefault();
      onEdit(only.id);
      return;
    }

    if (event.key === 'Escape') {
      if (active.current) {
        event.preventDefault();
        clearGesture();
      } else if (tool) {
        event.preventDefault();
        onToolDone();
      } else if (selection.length > 0) {
        event.preventDefault();
        onSelect([]);
      }
      return;
    }

    if (event.key.startsWith('Arrow') && selected.length > 0 && !active.current) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      onUpdate(
        selected.map((e) => ({ id: e.id, props: { x: e.x + dx, y: e.y + dy } })),
        // Presses of the arrow keys close together are one step to undo.
        { label: 'Move', mergeKey: `nudge:${selected.map((e) => e.id).join(',')}` },
      );
      return;
    }

    if (
      (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
      selected.length === 0 &&
      !active.current &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      onStepSlide(event.key === 'ArrowUp' ? -1 : 1);
      return;
    }

    // Tab walks through the shapes, back to front, then leaves the canvas.
    if (event.key === 'Tab' && slide.elements.length > 0) {
      const order = slide.elements.map((e) => e.id);
      const only = selection.length === 1 ? order.indexOf(selection[0] ?? '') : -1;
      const next = event.shiftKey ? (only === -1 ? order.length - 1 : only - 1) : only + 1;
      const id = order[next];
      if (id !== undefined) {
        event.preventDefault();
        onSelect([id]);
      } else if (selection.length > 0) {
        onSelect([]);
      }
    }
  }

  function onDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (editingId !== undefined || tool || onPreviewAdvance || inEditor(event.target)) return;
    const hit = pickElement(slide.elements, toSlide(event), lineSlop());
    if (hit && canEditText(hit)) onEdit(hit.id, { x: event.clientX, y: event.clientY });
  }

  /** Files being dragged over the slide: say they may be dropped here. */
  function onDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (onPreviewAdvance || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropping(true);
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    setDropping(false);
    if (onPreviewAdvance || event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    onDropFiles([...event.dataTransfer.files], { x: event.clientX, y: event.clientY });
  }

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (inEditor(event.target)) return;
    event.preventDefault();
    if (onPreviewAdvance) return;
    const hit = pickElement(slide.elements, toSlide(event), lineSlop());
    if (!hit) onSelect([]);
    else if (!selection.includes(hit.id)) onSelect([hit.id]);
    // The menu itself decides what it offers: on empty slide it is only Paste.
    onContextMenu({ x: event.clientX, y: event.clientY });
  }

  const opacity =
    selected.length === 1 ? ` · ${String(Math.round((selected[0]?.opacity ?? 1) * 100))}%` : '';
  const chip = readout ?? `${describeSelection(selected)}${opacity}`;

  return (
    // The slide is one focus stop: Tab enters it, Tab again walks the shapes, arrow keys nudge.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={frameRef}
      className={
        onPreviewAdvance
          ? 'slide-frame slide-frame-previewing'
          : tool
            ? 'slide-frame slide-frame-drawing'
            : dropping
              ? 'slide-frame slide-frame-dropping'
              : 'slide-frame'
      }
      role="group"
      aria-label={label}
      aria-describedby={tool ? 'drawing-hint' : undefined}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={clearGesture}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      onDragOver={onDragOver}
      onDragLeave={() => {
        setDropping(false);
      }}
      onDrop={onDrop}
      onContextMenu={handleContextMenu}
    >
      <SlideView slide={slide} look={look} handle={viewRef} />
      {badges && !onPreviewAdvance && (
        <StepBadges slide={slide} activeStepId={badges.activeStepId} />
      )}
      {!onPreviewAdvance && animateOverlay}
      {editingId === undefined && !onPreviewAdvance && (selected.length > 0 || marquee) ? (
        <SelectionOverlay elements={selected} chip={chip} marquee={marquee} />
      ) : null}
      {editor}
      {tool && (
        <p id="drawing-hint" className="drawing-hint">
          {tool === 'text'
            ? 'Click or drag on the slide to add text. Esc cancels.'
            : `Drag on the slide to draw ${withArticle(SHAPE_LABELS[tool])}. Esc cancels.`}
        </p>
      )}
      <span className="visually-hidden" role="status" aria-live="polite">
        {selected.length > 0 ? `${describeSelection(selected)} selected` : ''}
      </span>
    </div>
  );
}
