import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SHAPE_KINDS,
  canReorder,
  emptyText,
  isShape,
  isTextBox,
  type ElementChange,
  type Id,
  type Point,
  type ReorderMode,
  type Slide,
  type SlideElement,
} from '@/model';
import { measureTextHeight } from '@/render';
import { isNearlyFull } from '@/storage';
import { Canvas } from './Canvas';
import { DesignPanel } from './DesignPanel';
import { applyDraft, type Tool } from './gestures';
import { PlusIcon, ShapeIcon, TextIcon } from './Icons';
import { Inspector } from './Inspector';
import { Logo } from './Logo';
import { ContextMenu, MenuButton, type MenuItem } from './Menu';
import { SaveIndicator } from './SaveIndicator';
import { SHAPE_LABELS, describeSelection } from './shapeLabels';
import { SlideRail } from './SlideRail';
import { NearlyFullBanner, SaveFailedBanner } from './StorageBanner';
import { deckFonts } from './text/deckFonts';
import { boxFormat, textOf } from './text/format';
import { fitTextBoxes } from './textLayout';
import { useDeckLock } from './useDeckLock';
import { useDeckStore } from './StoreContext';
import { useDeckSession, type DeckSession } from './useDeckSession';
import { useStorageUsage } from './useStorageUsage';
import { useTextEditing } from './useTextEditing';
import './shell.css';
import './text.css';

// TipTap is large, so it is fetched only when text is first edited.
const TextEditor = lazy(() => import('./text/TextEditor'));

const ADD_SLIDE_SHORTCUT = 'Ctrl+M';

/**
 * The deck editor at `#/deck/<id>` (design: Main). A deck is edited in one tab at a time (SV-7): this
 * waits for the deck's lock, then opens it.
 */
export function EditorScreen({ deckId }: { readonly deckId: string }) {
  const lock = useDeckLock(deckId);
  if (lock === 'checking') return <p className="status-screen">Opening deck…</p>;
  if (lock === 'busy') {
    return (
      <StatusScreen title="This deck is open in another tab">
        Close that tab and this one will open the deck by itself, with everything saved there.
      </StatusScreen>
    );
  }
  return <DeckEditor deckId={deckId} />;
}

/** Opens the deck, then shows it. */
function DeckEditor({ deckId }: { readonly deckId: string }) {
  const session = useDeckSession(useDeckStore(), deckId);
  const { deck, currentSlide } = session;

  if (session.phase === 'loading') return <p className="status-screen">Opening deck…</p>;
  if (session.phase === 'missing') {
    return (
      <StatusScreen title="This deck isn’t here">
        It may have been deleted from this browser.
      </StatusScreen>
    );
  }
  if (session.phase === 'unreadable') {
    return (
      <StatusScreen
        title={
          session.newer ? 'This deck needs a newer version of Cue' : 'This deck can’t be opened'
        }
      >
        {session.newer
          ? 'It was saved by a newer version of Cue than the one you have open. Reload the page to get the latest version.'
          : 'Its stored data may be damaged, or this browser is not letting Cue use storage. Your other decks are untouched.'}
      </StatusScreen>
    );
  }
  if (!deck || !currentSlide) return null;
  return <Editor session={session} deck={deck} currentSlide={currentSlide} />;
}

function StatusScreen({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <main className="status-screen">
      <h1>{title}</h1>
      <p>{children}</p>
      <a className="button button-primary" href="#/">
        Back to your decks
      </a>
    </main>
  );
}

const ARRANGE_MODES: readonly ReorderMode[] = ['front', 'forward', 'backward', 'back'];

const ARRANGE_SHORTCUTS: Readonly<
  Record<ReorderMode, { label: string; shortcut: string; keys: string }>
> = {
  front: { label: 'Bring to front', shortcut: 'Ctrl+Shift+]', keys: 'Control+Shift+BracketRight' },
  forward: { label: 'Bring forward', shortcut: 'Ctrl+]', keys: 'Control+BracketRight' },
  backward: { label: 'Send backward', shortcut: 'Ctrl+[', keys: 'Control+BracketLeft' },
  back: { label: 'Send to back', shortcut: 'Ctrl+Shift+[', keys: 'Control+Shift+BracketLeft' },
};

/** Which Arrange command a key press is, with Ctrl (or Cmd) and the bracket keys, or none. */
function arrangeFor(event: KeyboardEvent): ReorderMode | undefined {
  if ((!event.ctrlKey && !event.metaKey) || event.altKey) return undefined;
  if (event.code === 'BracketRight') return event.shiftKey ? 'front' : 'forward';
  if (event.code === 'BracketLeft') return event.shiftKey ? 'back' : 'backward';
  return undefined;
}

/** Typing in a field or an editor is not a shortcut: single keys like T belong to the text. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** The slide with one element's text left out: the editor draws it instead while it is being edited. */
function withoutText(slide: Slide, id: Id): Slide {
  return {
    ...slide,
    elements: slide.elements.map((element) => {
      if (element.id !== id) return element;
      if (isTextBox(element)) return { ...element, doc: emptyText() };
      return isShape(element) && element.text ? { ...element, text: emptyText() } : element;
    }),
  };
}

function Editor({
  session,
  deck,
  currentSlide,
}: {
  readonly session: DeckSession;
  readonly deck: NonNullable<DeckSession['deck']>;
  readonly currentSlide: NonNullable<DeckSession['currentSlide']>;
}) {
  const { saveState, addSlide } = session;
  const frame = useRef<HTMLDivElement>(null);
  const usage = useStorageUsage(saveState.status);
  const index = deck.slides.indexOf(currentSlide);

  // What is selected is remembered with its slide, so a selection never follows you to another slide.
  const [selection, setSelection] = useState<{ slideId: Id; ids: readonly Id[] }>({
    slideId: currentSlide.id,
    ids: [],
  });
  const [tool, setTool] = useState<Tool | undefined>();
  // A drag in progress, shown on the canvas but not saved until it ends (decision 18).
  const [draft, setDraft] = useState<readonly ElementChange[] | undefined>();
  const [drawing, setDrawing] = useState<SlideElement | undefined>();
  const [menuAt, setMenuAt] = useState<Point | undefined>();

  // Text is edited in place: the editor holds it, and the deck gets it in whole steps.
  const save = (changes: readonly ElementChange[]) => {
    session.updateElements(fitTextBoxes(currentSlide, changes));
  };
  const text = useTextEditing({ slide: currentSlide, save, remove: session.removeElements });
  const editingId = text.editing?.id;

  const slide = useMemo(() => {
    const changes = text.height ? [...(draft ?? []), text.height] : draft;
    const shown = applyDraft(currentSlide, changes, drawing);
    return text.ready && editingId !== undefined ? withoutText(shown, editingId) : shown;
  }, [currentSlide, draft, drawing, text.height, text.ready, editingId]);
  const selectedIds = useMemo(
    () =>
      selection.slideId === currentSlide.id
        ? selection.ids.filter((id) => currentSlide.elements.some((e) => e.id === id))
        : [],
    [selection, currentSlide],
  );
  const selected = slide.elements.filter((e) => selectedIds.includes(e.id));
  const order = slide.elements.map((e) => e.id);
  const select = (ids: readonly Id[]) => {
    // Selecting anything else ends the editing of this text.
    if (editingId !== undefined && !(ids.length === 1 && ids[0] === editingId)) text.finish();
    setSelection({ slideId: currentSlide.id, ids });
  };

  const focusCanvas = useCallback(() => {
    frame.current?.focus();
  }, []);

  function add() {
    text.finish();
    addSlide();
    // The new slide is selected and ready to edit: keyboard focus goes to the canvas (SL-1).
    focusCanvas();
  }

  function arrange(mode: ReorderMode) {
    if (!canReorder(order, new Set(selectedIds), mode)) return;
    text.finish();
    session.reorderElements(selectedIds, mode);
    focusCanvas();
  }

  function pickTool(next: Tool) {
    text.finish();
    select([]);
    setTool(next);
    focusCanvas();
  }

  function goToSlide(id: Id) {
    text.finish();
    session.selectSlide(id);
  }

  /** A new text box is as tall as one line of its text needs. */
  function addElement(element: SlideElement) {
    session.addElement(
      isTextBox(element) ? { ...element, height: measureTextHeight(element) } : element,
    );
  }

  // Ctrl+M (or Cmd+M, where the browser lets a page see it) adds a slide from anywhere (SL-1); the
  // bracket keys arrange the selection (ZO-1).
  const latest = useRef({ add, arrange, pickTool });
  useEffect(() => {
    latest.current = { add, arrange, pickTool };
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // T arms the text tool, unless the key is being typed into a field or a text.
      if (
        event.key.toLowerCase() === 't' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        !isTyping(event.target)
      ) {
        event.preventDefault();
        latest.current.pickTool('text');
        return;
      }
      const mode = arrangeFor(event);
      if (mode) {
        event.preventDefault();
        latest.current.arrange(mode);
        return;
      }
      if (event.key.toLowerCase() !== 'm' || event.shiftKey || event.altKey) return;
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (!event.repeat) latest.current.add();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    document.title = `${deck.title} · Cue`;
    return () => {
      document.title = 'Cue';
    };
  }, [deck.title]);

  const fonts = useMemo(() => deckFonts(deck), [deck]);
  // The Text section of the Design panel works on the words being edited, or on whole boxes.
  const panelFormat = text.editing ? text.format : boxFormat(selected, save);
  const editingElement = slide.elements.find((e) => e.id === editingId);
  const stored = currentSlide.elements.find((e) => e.id === editingId);
  const editedDoc = stored ? textOf(stored) : undefined;
  const editor =
    text.editing && editingElement ? (
      <Suspense fallback={null}>
        <TextEditor
          key={text.editing.id}
          element={editingElement}
          doc={editedDoc ?? emptyText()}
          at={text.editing.at}
          onDraft={text.onDraft}
          onFinish={() => {
            text.finish();
            focusCanvas();
          }}
          onFormat={text.setFormat}
          onReady={text.markReady}
          deckFonts={fonts}
          label={`Text of ${describeSelection([editingElement]).toLowerCase()}`}
        />
      </Suspense>
    ) : undefined;

  const shapeItems: MenuItem[] = SHAPE_KINDS.map((kind) => ({
    id: kind,
    label: SHAPE_LABELS[kind],
    onSelect: () => {
      pickTool(kind);
    },
  }));

  const arrangeItems: MenuItem[] = ARRANGE_MODES.map((mode) => ({
    id: mode,
    label: ARRANGE_SHORTCUTS[mode].label,
    shortcut: ARRANGE_SHORTCUTS[mode].shortcut,
    keyShortcuts: ARRANGE_SHORTCUTS[mode].keys,
    disabled: !canReorder(order, new Set(selectedIds), mode),
    onSelect: () => {
      arrange(mode);
    },
  }));

  return (
    <div className="shell">
      <header className="top-bar">
        <div className="top-left">
          <a className="logo-link" href="#/" aria-label="All decks">
            <Logo />
          </a>
          <TitleField title={deck.title} onChange={session.renameDeck} />
        </div>
        <div className="top-center">
          <button
            type="button"
            className="toolbar-button"
            aria-label="Add slide"
            aria-keyshortcuts="Control+M Meta+M"
            title={`Add slide (${ADD_SLIDE_SHORTCUT})`}
            onClick={add}
          >
            <PlusIcon />
            Slide
          </button>
          <button
            type="button"
            className="toolbar-button"
            aria-label="Text"
            aria-keyshortcuts="T"
            aria-pressed={tool === 'text'}
            title="Text (T)"
            onClick={() => {
              pickTool('text');
            }}
          >
            <TextIcon />
            Text
          </button>
          <MenuButton variant="toolbar" label="Shape" items={shapeItems}>
            <ShapeIcon />
            Shape
          </MenuButton>
        </div>
        <div className="top-right">
          <SaveIndicator state={saveState} />
        </div>
      </header>

      <div className="banner-area">
        {saveState.status === 'failed' ? (
          <SaveFailedBanner reason={saveState.reason} onRetry={session.retrySave} />
        ) : (
          usage && isNearlyFull(usage) && <NearlyFullBanner usage={usage} withManageLink />
        )}
      </div>

      <SlideRail
        slides={deck.slides}
        currentId={currentSlide.id}
        onSelect={goToSlide}
        onAdd={add}
      />

      <main className="canvas" aria-label="Canvas">
        <h1 className="visually-hidden">{deck.title}</h1>
        <Canvas
          slide={slide}
          label={`Slide ${String(index + 1)} of ${String(deck.slides.length)}`}
          selection={selectedIds}
          onSelect={select}
          tool={tool}
          onToolDone={() => {
            setTool(undefined);
          }}
          onAddElement={addElement}
          onUpdate={save}
          onDraft={(changes) => {
            setDraft(changes && fitTextBoxes(currentSlide, changes));
          }}
          onDrawing={setDrawing}
          onContextMenu={setMenuAt}
          editingId={editingId}
          onEdit={text.start}
          onFinishEdit={text.finish}
          editor={editor}
          frameRef={frame}
        />
        {menuAt && (
          <ContextMenu
            label="Arrange"
            items={arrangeItems}
            x={menuAt.x}
            y={menuAt.y}
            onClose={(restoreFocus) => {
              setMenuAt(undefined);
              if (restoreFocus) focusCanvas();
            }}
          />
        )}
      </main>

      <section className="notes" aria-label="Speaker notes">
        <div className="notes-header">
          <span className="section-label">Speaker notes</span>
          <span className="caption">Shown in presenter view</span>
        </div>
      </section>

      <Inspector
        design={
          selected.length > 0 ? (
            <DesignPanel
              elements={selected}
              order={order}
              textFormat={panelFormat}
              deckFonts={fonts}
              onPreview={setDraft}
              onCommit={(changes) => {
                setDraft(undefined);
                save(changes);
              }}
              onReorder={arrange}
            />
          ) : undefined
        }
      />
    </div>
  );
}

/** The deck title, edited in place in the header (SV-2). Never left empty. */
function TitleField({
  title,
  onChange,
}: {
  readonly title: string;
  readonly onChange: (title: string) => void;
}) {
  const [draft, setDraft] = useState(title);

  return (
    <input
      className="title-input"
      aria-label="Deck title"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(event.target.value);
      }}
      // The stored title is trimmed and never empty, so show that once the user is done typing.
      onBlur={() => {
        setDraft(title);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}
