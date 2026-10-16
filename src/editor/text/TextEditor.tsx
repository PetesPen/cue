import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Editor } from '@tiptap/core';
import { Selection, TextSelection } from '@tiptap/pm/state';
import {
  DEFAULT_LINE_HEIGHT,
  DEFAULT_TEXT_STYLE,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  isShape,
  isTextBox,
  sanitiseRichText,
  type Point,
  type RichText,
  type SlideElement,
} from '@/model';
import { toEditorContent } from './content';
import { wordsFormat } from './editing';
import { textExtensions } from './extensions';
import type { TextFormat } from './format';
import { selectionFormat } from './selection';
import { FloatingToolbar } from './Toolbar';

/** How much the slide is shrunk on screen: the width of its frame over 1920. */
function useScale(layer: React.RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = layer.current;
    if (!element) return;
    const measure = () => {
      setScale(element.clientWidth / SLIDE_WIDTH);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [layer]);
  return scale;
}

export interface TextEditorProps {
  /** The element being edited, as the slide shows it now (its box follows the text as it grows). */
  readonly element: SlideElement;
  /** The text to start from. */
  readonly doc: RichText;
  /** Where the pointer was when editing started (screen pixels), to put the cursor there. */
  readonly at?: Point | undefined;
  /** The text changed: every change, for showing the box's new height and for saving soon. */
  readonly onDraft: (doc: RichText) => void;
  /** Editing is over (Escape). */
  readonly onFinish: () => void;
  /** What the toolbar and the Design panel show and do for the selected words. */
  readonly onFormat: (format: TextFormat | undefined) => void;
  /** The editor is showing, so the slide may stop drawing this text itself. */
  readonly onReady: () => void;
  /** Fonts the deck uses, listed first in the font picker. */
  readonly deckFonts: readonly string[];
  readonly label: string;
}

/**
 * The text of one element, edited in place (EL-1). It is drawn in the same 1920 x 1080 space, with the
 * same structure and CSS as the static renderer, over the element's own box, so words do not move
 * when editing starts or ends. TipTap is loaded only when this is first shown.
 */
export default function TextEditor({
  element,
  doc,
  at,
  onDraft,
  onFinish,
  onFormat,
  onReady,
  deckFonts,
  label,
}: TextEditorProps) {
  const layer = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const scale = useScale(layer);
  const [format, setFormat] = useState<TextFormat | undefined>();
  const latest = useRef({ onDraft, onFormat, onReady });
  useEffect(() => {
    latest.current = { onDraft, onFormat, onReady };
  });
  const start = useRef({ doc, at });

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let lastSummary = '';
    const publish = (self: Editor) => {
      const summary = selectionFormat(self.state);
      const key = JSON.stringify(summary);
      if (key === lastSummary) return;
      lastSummary = key;
      const next = wordsFormat(self, summary);
      setFormat(next);
      latest.current.onFormat(next);
    };
    const created = new Editor({
      element,
      extensions: textExtensions(),
      content: toEditorContent(start.current.doc),
      editorProps: {
        attributes: {
          class: 'cue-text',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': label,
          style: `font-family: "${DEFAULT_TEXT_STYLE.fontFamily}"; font-size: ${String(DEFAULT_TEXT_STYLE.fontSize)}px; color: ${DEFAULT_TEXT_STYLE.color}; line-height: ${String(DEFAULT_LINE_HEIGHT)}`,
        },
      },
      onUpdate: ({ editor: self }) => {
        latest.current.onDraft(sanitiseRichText(self.getJSON()));
      },
      onTransaction: ({ editor: self }) => {
        publish(self);
      },
    });

    // Put the cursor where the pointer was, or at the end, and focus now: TipTap's own focus waits a
    // frame, and keys pressed in that frame would be lost.
    const pointer = start.current.at;
    const place = pointer ? created.view.posAtCoords({ left: pointer.x, top: pointer.y }) : null;
    const caret = place
      ? TextSelection.near(created.state.doc.resolve(place.pos))
      : Selection.atEnd(created.state.doc);
    created.view.dispatch(created.state.tr.setSelection(caret));
    created.view.focus();

    publish(created);
    latest.current.onReady();
    return () => {
      latest.current.onFormat(undefined);
      created.destroy();
    };
    // The editor is made once for this element; a different element is a different mount (keyed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onFinish();
      return;
    }
    // Keys that are text editing are not the canvas's: arrows, Delete, Tab, letters. Ctrl and Cmd
    // shortcuts still reach the app (Ctrl+M adds a slide); the app ignores the ones that edit text.
    if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
  }

  const box = element;
  const shape = isShape(box);
  const style = {
    left: `${String(box.x)}px`,
    top: `${String(box.y)}px`,
    width: `${String(box.width)}px`,
    height: `${String(box.height)}px`,
    transform: box.rotation === 0 ? undefined : `rotate(${String(box.rotation)}deg)`,
    opacity: box.opacity === 1 ? undefined : box.opacity,
    ...(isTextBox(box)
      ? {
          padding: `${String(box.padding)}px`,
          border: `${String(box.border.width)}px solid transparent`,
        }
      : {}),
  };

  return (
    <>
      <div ref={layer} className="text-layer">
        <div
          className="text-scaler"
          style={{
            width: `${String(SLIDE_WIDTH)}px`,
            height: `${String(SLIDE_HEIGHT)}px`,
            transform: `scale(${String(scale)})`,
          }}
        >
          {/* The keys are handled here; the editor inside is the interactive part. */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            className={shape ? 'text-edit-box cue-shape-text' : 'text-edit-box cue-text-box'}
            data-text-surface=""
            style={style}
            onKeyDown={onKeyDown}
          >
            <div ref={host} className="text-host" />
          </div>
        </div>
      </div>
      {format && (
        <FloatingToolbar
          format={format}
          deckFonts={deckFonts}
          element={element}
          onFinish={onFinish}
        />
      )}
    </>
  );
}
