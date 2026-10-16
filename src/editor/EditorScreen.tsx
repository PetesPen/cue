import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SHAPE_KINDS,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  systemEnv,
  canReorder,
  createImage,
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
import { isNearlyFull, readStorageUsage, type StoredImage, type StoredOriginal } from '@/storage';
import { Canvas } from './Canvas';
import { DesignPanel, SlidePanel } from './DesignPanel';
import { applyDraft, type Tool } from './gestures';
import {
  AlertIcon,
  ImageIcon,
  InfoIcon,
  PlusIcon,
  RedoIcon,
  ShapeIcon,
  TextIcon,
  UndoIcon,
} from './Icons';
import {
  CASCADE,
  IMAGE_ACCEPT,
  ImageImportError,
  fitInSlide,
  importImage,
  placeCentred,
} from './importImage';
import { Inspector } from './Inspector';
import { Logo } from './Logo';
import { NotesField } from './NotesField';
import { ContextMenu, MenuButton, type MenuItem } from './Menu';
import { SaveIndicator } from './SaveIndicator';
import { SHAPE_LABELS, describeSelection } from './shapeLabels';
import { SlideRail } from './SlideRail';
import { Toasts, type ToastData } from './Toast';
import { NearlyFullBanner, SaveFailedBanner } from './StorageBanner';
import { ColourContext, deckColours } from './colour/deckColours';
import { deckFonts } from './text/deckFonts';
import { boxFormat, textOf } from './text/format';
import { fitTextBoxes } from './textLayout';
import { useDeckLock } from './useDeckLock';
import { useDeckStore } from './StoreContext';
import { useDeckSession, type DeckSession, type EditMeta, type View } from './useDeckSession';
import { useStorageUsage } from './useStorageUsage';
import { useClipboard } from './useClipboard';
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

/** A field with its own undo: the browser's, not ours. (A text being edited is not one; its undo is ours.) */
function isField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
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
  // A background colour being dragged in the picker: shown on the canvas, saved when it is chosen.
  const [backgroundDraft, setBackgroundDraft] = useState<
    { readonly slideId: Id; readonly background: string } | undefined
  >();
  const [menuAt, setMenuAt] = useState<Point | undefined>();

  // Text is edited in place: the editor holds it, and the deck gets it in whole steps.
  const save = (changes: readonly ElementChange[], meta?: EditMeta) => {
    session.updateElements(fitTextBoxes(currentSlide, changes), meta);
  };
  const text = useTextEditing({
    slide: currentSlide,
    save,
    remove: session.removeElements,
    registerFlush: session.registerFlush,
  });
  const editingId = text.editing?.id;

  // Toasts last a few seconds, and an Undo in one is only offered while its step is still the last.
  const [toasts, setToasts] = useState<readonly (ToastData & { readonly expects?: number })[]>([]);
  const dismissToast = (id: string) => {
    setToasts((was) => was.filter((toast) => toast.id !== id));
  };
  function showToast(toast: Omit<ToastData, 'id'>) {
    const id = systemEnv.newId();
    // A toast with an Undo is about the next step the history records, and goes when another follows.
    const expects = toast.action ? session.history.done.length + 1 : undefined;
    setToasts((was) => [...was, { ...toast, id, ...(expects === undefined ? {} : { expects }) }]);
  }
  const liveToasts = toasts.filter(
    (toast) =>
      toast.expects === undefined ||
      (session.history.done.length === toast.expects && !session.canRedo),
  );

  const slide = useMemo(() => {
    const changes = text.height ? [...(draft ?? []), text.height] : draft;
    const drafted = applyDraft(currentSlide, changes, drawing);
    const shown =
      backgroundDraft?.slideId === currentSlide.id
        ? { ...drafted, background: backgroundDraft.background }
        : drafted;
    return text.ready && editingId !== undefined ? withoutText(shown, editingId) : shown;
  }, [currentSlide, draft, drawing, backgroundDraft, text.height, text.ready, editingId]);
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

  function duplicateSlide(id: Id) {
    text.finish();
    session.duplicateSlide(id);
  }

  /** Delete a slide, and offer to bring it back (the toast from the States board, SL-4). */
  function deleteSlide(id: Id) {
    const number = deck.slides.findIndex((slide) => slide.id === id) + 1;
    if (number === 0) return;
    text.finish();
    session.deleteSlide(id);
    showToast({
      message: `Slide ${String(number)} deleted`,
      action: {
        label: 'Undo',
        onAction: () => {
          stepHistory('undo');
        },
      },
    });
  }

  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Add picture files to the slide (EL-4): each is checked, scaled down if huge, and placed in the middle
   * (or round `at`, in client pixels); all of them are one step to undo. What cannot be added is said, in
   * words, and nothing of it is kept.
   */
  async function addImages(files: readonly File[], at?: { x: number; y: number }) {
    text.finish();
    const rect = frame.current?.getBoundingClientRect();
    const centre =
      at && rect && rect.width > 0
        ? {
            x: ((at.x - rect.left) / rect.width) * SLIDE_WIDTH,
            y: ((at.y - rect.top) / rect.height) * SLIDE_HEIGHT,
          }
        : undefined;
    const pictures: {
      image: StoredImage;
      original?: StoredOriginal;
      element: ReturnType<typeof createImage>;
      scaledFrom?: { width: number; height: number };
    }[] = [];
    const notes: Omit<ToastData, 'id'>[] = [];

    for (const file of files) {
      try {
        const imported = await importImage(file);
        const usage = await readStorageUsage();
        if (usage && usage.quota - usage.usage < imported.image.bytes.length * 2) {
          notes.push({
            message: 'There isn’t room for this picture',
            detail: `${file.name}: delete decks you no longer need, then try again.`,
            icon: <AlertIcon />,
          });
          continue;
        }
        const size = fitInSlide(imported.width, imported.height);
        const place = placeCentred(size, centre, pictures.length * CASCADE);
        pictures.push({
          image: imported.image,
          // The original is kept for the export only where there is plenty of room.
          ...(imported.original &&
          usage &&
          usage.quota - usage.usage > imported.original.bytes.length * 6
            ? { original: imported.original }
            : {}),
          element: createImage(systemEnv.newId(), imported.image.hash, { ...place, ...size }),
          ...(imported.scaledFrom ? { scaledFrom: imported.scaledFrom } : {}),
        });
      } catch (error) {
        const reason = error instanceof ImageImportError ? error.reason : 'unreadable';
        notes.push({
          message:
            reason === 'notImage'
              ? 'That file isn’t a picture Cue can use'
              : reason === 'tooBig'
                ? 'That file is too big'
                : 'That picture couldn’t be read',
          detail:
            reason === 'notImage'
              ? `${file.name}: use PNG, JPEG, GIF, SVG or WebP.`
              : reason === 'tooBig'
                ? `${file.name}: pictures over 40 MB are not added.`
                : `${file.name}: it may be damaged.`,
          icon: <AlertIcon />,
        });
      }
    }

    if (pictures.length > 0) {
      session.addImages(
        pictures.map(({ image, original, element }) => ({
          image,
          ...(original ? { original } : {}),
          element,
        })),
      );
      select(pictures.map(({ element }) => element.id));
      focusCanvas();
      for (const { scaledFrom, element } of pictures) {
        if (!scaledFrom) continue;
        showToast({
          message: 'Image scaled to fit',
          detail: `${String(scaledFrom.width)} × ${String(scaledFrom.height)} became ${String(Math.round(element.width))} × ${String(Math.round(element.height))} to keep your deck light.`,
          icon: <InfoIcon />,
          action: {
            label: 'Undo',
            onAction: () => {
              stepHistory('undo');
            },
          },
        });
      }
    }
    for (const note of notes) showToast(note);
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
  const clipboard = useClipboard({
    selected: currentSlide.elements.filter((e) => selectedIds.includes(e.id)),
    addElements: session.addElements,
    removeElements: session.removeElements,
    select,
    onImages: (files) => {
      void addImages(files);
    },
    fitted: (element) =>
      isTextBox(element) ? { ...element, height: measureTextHeight(element) } : element,
    focusCanvas,
  });

  /**
   * Undo or redo one step (EL-8). Words being typed are given to the deck first, so they are part of
   * what is undone; afterwards the slide and the elements the step was about are shown again.
   */
  function stepHistory(which: 'undo' | 'redo') {
    text.saveNow();
    const view: View | undefined = which === 'undo' ? session.undo() : session.redo();
    if (!view) return;
    if (text.editing) {
      // The deck changed under the editor: it starts again from what the deck holds.
      text.reload();
    } else {
      setSelection({ slideId: view.slideId ?? currentSlide.id, ids: view.ids });
      focusCanvas();
    }
  }

  const latest = useRef({ add, arrange, pickTool, clipboard, stepHistory });
  useEffect(() => {
    latest.current = { add, arrange, pickTool, clipboard, stepHistory };
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
      // Undo and redo are the app's, everywhere but in a field that has its own (a title, a number).
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !isField(event.target)) {
        const key = event.key.toLowerCase();
        if (key === 'z' || key === 'y') {
          event.preventDefault();
          latest.current.stepHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
          return;
        }
      }
      // Delete and Ctrl+D act on the selected elements, but not while words are being typed.
      if (!isTyping(event.target)) {
        // Delete is the slide's when the slide has focus (or nothing does): not a button's or the rail's.
        const onSlide =
          event.target === document.body ||
          (event.target instanceof Element && event.target.closest('.canvas') !== null);
        if (onSlide && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault();
          latest.current.clipboard.remove();
          return;
        }
        if (
          event.key.toLowerCase() === 'd' &&
          (event.ctrlKey || event.metaKey) &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          if (!event.repeat) latest.current.clipboard.duplicate();
          return;
        }
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
  const commitChanges = (changes: readonly ElementChange[]) => {
    setDraft(undefined);
    save(changes);
  };
  const previewChanges = (changes: readonly ElementChange[] | undefined) => {
    setDraft(changes && fitTextBoxes(currentSlide, changes));
  };
  const panelFormat = text.editing
    ? text.format
    : boxFormat(selected, commitChanges, previewChanges);

  // The colours the deck uses, and the ones picked since it was opened, for the colour picker.
  const [picked, setPicked] = useState<readonly string[]>([]);
  const colourContext = useMemo(
    () => ({
      colours: [...new Set([...picked, ...deckColours(deck)])],
      remember: (colour: string) => {
        setPicked((was) => [colour, ...was.filter((c) => c !== colour)].slice(0, 10));
      },
    }),
    [deck, picked],
  );
  const editingElement = slide.elements.find((e) => e.id === editingId);
  const stored = currentSlide.elements.find((e) => e.id === editingId);
  const editedDoc = stored ? textOf(stored) : undefined;
  const editor =
    text.editing && editingElement ? (
      <Suspense fallback={null}>
        <TextEditor
          key={`${text.editing.id}:${String(text.version)}`}
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

  const none = selectedIds.length === 0;
  const editItems: MenuItem[] = [
    {
      id: 'cut',
      label: 'Cut',
      shortcut: 'Ctrl+X',
      keyShortcuts: 'Control+X Meta+X',
      disabled: none,
      onSelect: clipboard.cut,
    },
    {
      id: 'copy',
      label: 'Copy',
      shortcut: 'Ctrl+C',
      keyShortcuts: 'Control+C Meta+C',
      disabled: none,
      onSelect: clipboard.copy,
    },
    {
      id: 'paste',
      label: 'Paste',
      shortcut: 'Ctrl+V',
      keyShortcuts: 'Control+V Meta+V',
      disabled: !clipboard.canPaste(),
      onSelect: clipboard.paste,
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      shortcut: 'Ctrl+D',
      keyShortcuts: 'Control+D Meta+D',
      disabled: none,
      onSelect: clipboard.duplicate,
    },
    {
      id: 'delete',
      label: 'Delete',
      shortcut: 'Del',
      keyShortcuts: 'Delete',
      danger: true,
      disabled: none,
      onSelect: clipboard.remove,
    },
  ];

  const arrangeItems: MenuItem[] = ARRANGE_MODES.map((mode, index) => ({
    separated: index === 0,
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
    <ColourContext.Provider value={colourContext}>
      <div className="shell">
        <header className="top-bar">
          <div className="top-left">
            <a className="logo-link" href="#/" aria-label="All decks">
              <Logo />
            </a>
            <TitleField key={session.revision} title={deck.title} onChange={session.renameDeck} />
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
            <button
              type="button"
              className="toolbar-button"
              aria-label="Add image"
              title="Add image"
              onClick={() => {
                fileInput.current?.click();
              }}
            >
              <ImageIcon />
              Image
            </button>
            <input
              ref={fileInput}
              type="file"
              className="file-input"
              accept={IMAGE_ACCEPT}
              multiple
              tabIndex={-1}
              aria-label="Image files"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                // So the same file can be chosen again straight after.
                event.target.value = '';
                void addImages(files);
              }}
            />
            <span className="toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className="toolbar-button toolbar-icon"
              aria-label="Undo"
              aria-keyshortcuts="Control+Z Meta+Z"
              title={session.undoLabel ? `Undo ${session.undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
              disabled={!session.canUndo}
              onClick={() => {
                stepHistory('undo');
              }}
            >
              <UndoIcon />
            </button>
            <button
              type="button"
              className="toolbar-button toolbar-icon"
              aria-label="Redo"
              aria-keyshortcuts="Control+Shift+Z Control+Y Meta+Shift+Z"
              title={
                session.redoLabel
                  ? `Redo ${session.redoLabel} (Ctrl+Shift+Z)`
                  : 'Redo (Ctrl+Shift+Z)'
              }
              disabled={!session.canRedo}
              onClick={() => {
                stepHistory('redo');
              }}
            >
              <RedoIcon />
            </button>
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
          onMove={(id, toIndex) => {
            text.finish();
            session.moveSlide(id, toIndex);
          }}
          onDuplicate={duplicateSlide}
          onDelete={deleteSlide}
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
            onDropFiles={(files, at) => {
              void addImages(files, at);
            }}
            editingId={editingId}
            onEdit={text.start}
            onFinishEdit={text.finish}
            editor={editor}
            frameRef={frame}
          />
          {menuAt && (none ? clipboard.canPaste() : true) && (
            <ContextMenu
              label="Element actions"
              items={
                none
                  ? editItems.filter((item) => item.id === 'paste')
                  : [...editItems, ...arrangeItems]
              }
              x={menuAt.x}
              y={menuAt.y}
              onClose={(restoreFocus) => {
                setMenuAt(undefined);
                if (restoreFocus) focusCanvas();
              }}
            />
          )}
        </main>

        <Toasts toasts={liveToasts} onDismiss={dismissToast} />

        <section className="notes" aria-label="Speaker notes">
          <div className="notes-header">
            <span className="section-label">Speaker notes</span>
            <span className="caption">Shown in presenter view</span>
          </div>
          <NotesField
            key={`${currentSlide.id}:${String(session.revision)}`}
            slideId={currentSlide.id}
            notes={currentSlide.notes}
            onSave={session.setNotes}
            registerFlush={session.registerFlush}
          />
        </section>

        <Inspector
          design={
            selected.length > 0 ? (
              <DesignPanel
                elements={selected}
                order={order}
                textFormat={panelFormat}
                deckFonts={fonts}
                onPreview={previewChanges}
                onCommit={commitChanges}
                onReorder={arrange}
              />
            ) : (
              <SlidePanel
                background={slide.background}
                onPreview={(background) => {
                  setBackgroundDraft({ slideId: currentSlide.id, background });
                }}
                onCommit={(background, all) => {
                  setBackgroundDraft(undefined);
                  session.setBackground(background, all);
                }}
              />
            )
          }
        />
      </div>
    </ColourContext.Provider>
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
