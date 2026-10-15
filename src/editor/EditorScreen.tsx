import { useEffect, useRef, useState } from 'react';
import { isNearlyFull } from '@/storage';
import { useDeckStore } from './StoreContext';
import { Inspector } from './Inspector';
import { Logo } from './Logo';
import { PlusIcon } from './Icons';
import { SaveIndicator } from './SaveIndicator';
import { SlideRail } from './SlideRail';
import { SlideView } from './SlideView';
import { NearlyFullBanner, SaveFailedBanner } from './StorageBanner';
import { useDeckSession, type DeckSession } from './useDeckSession';
import { useStorageUsage } from './useStorageUsage';
import './shell.css';

const ADD_SLIDE_SHORTCUT = 'Ctrl+M';

/** The deck editor at `#/deck/<id>` (design: Main). Opens the deck, then shows it. */
export function EditorScreen({ deckId }: { readonly deckId: string }) {
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

  function add() {
    addSlide();
    // The new slide is selected and ready to edit: keyboard focus goes to the canvas (SL-1).
    frame.current?.focus();
  }

  // Ctrl+M (or Cmd+M, where the browser lets a page see it) adds a slide from anywhere (SL-1).
  const addRef = useRef(add);
  useEffect(() => {
    addRef.current = add;
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'm' || event.shiftKey || event.altKey) return;
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (!event.repeat) addRef.current();
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
        onSelect={session.selectSlide}
        onAdd={add}
      />

      <main className="canvas" aria-label="Canvas">
        <h1 className="visually-hidden">{deck.title}</h1>
        <div
          ref={frame}
          className="slide-frame"
          role="group"
          aria-label={`Slide ${String(index + 1)} of ${String(deck.slides.length)}`}
          tabIndex={-1}
        >
          <SlideView slide={currentSlide} />
        </div>
      </main>

      <section className="notes" aria-label="Speaker notes">
        <div className="notes-header">
          <span className="section-label">Speaker notes</span>
          <span className="caption">Shown in presenter view</span>
        </div>
      </section>

      <Inspector />
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
