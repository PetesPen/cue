import { useEffect, useRef, useState } from 'react';
import { systemEnv } from '@/model';
import { formatBytes, isNearlyFull, type DeckStore, type DeckSummary } from '@/storage';
import { ConfirmDeleteDialog, RenameDialog } from './Dialogs';
import { deckMeta } from './format';
import { AlertIcon, PlusIcon } from './Icons';
import { createStoredDeck, renameStoredDeck } from './library';
import { Logo } from './Logo';
import { MenuButton } from './Menu';
import { navigate, routeHash } from './route';
import { SlideView } from './SlideView';
import { NearlyFullBanner } from './StorageBanner';
import { useDeckStore } from './StoreContext';
import { useStorageUsage } from './useStorageUsage';
import './home.css';

interface Library {
  readonly decks: readonly DeckSummary[];
  /** When the list was read, so "2 hours ago" is worked out against one moment. */
  readonly at: number;
}

/** The deck library at `#/` (design: Home): create, open, rename, duplicate and delete decks (SV-2). */
export function Home() {
  const store = useDeckStore();
  const [library, setLibrary] = useState<Library | undefined>();
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const usage = useStorageUsage(version);

  useEffect(() => {
    let current = true;
    store
      .list()
      .then((decks) => {
        if (current) setLibrary({ decks, at: Date.now() });
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [store, version]);

  const reload = () => {
    setVersion((was) => was + 1);
  };

  async function newDeck() {
    const deck = await createStoredDeck(store, systemEnv);
    navigate({ page: 'deck', deckId: deck.id });
  }

  const decks = library?.decks;

  return (
    <div className="home">
      <header className="home-bar">
        <div className="home-brand">
          <Logo />
          <span className="wordmark">Cue</span>
        </div>
        <button type="button" className="button button-primary" onClick={() => void newDeck()}>
          <PlusIcon size={15} strokeWidth={2.2} />
          New deck
        </button>
      </header>

      <main className="home-main">
        {usage && isNearlyFull(usage) && <NearlyFullBanner usage={usage} withManageLink={false} />}

        <div className="library-header">
          <h1 className="section-label">
            Your decks{decks && decks.length > 0 ? ` · ${String(decks.length)}` : ''}
          </h1>
          {usage && (
            <span className="storage-meter">
              Stored on this device · {formatBytes(usage.usage)} used
              <span className="meter meter-small" aria-hidden="true">
                <span
                  className="meter-fill"
                  style={{ width: `${String(Math.max(1, (usage.usage / usage.quota) * 100))}%` }}
                />
              </span>
            </span>
          )}
        </div>

        {failed && (
          <div className="banner banner-danger" role="alert">
            <span className="banner-icon">
              <AlertIcon size={15} strokeWidth={2.2} />
            </span>
            <span className="banner-text">
              <strong>Your decks can’t be read.</strong> This browser is not letting Cue use its
              storage. Reload the page to try again.
            </span>
          </div>
        )}

        {decks?.length === 0 && (
          <div className="empty-state">
            <h2>No decks yet</h2>
            <p>Start fresh with a new deck.</p>
            <button
              type="button"
              className="button button-compact button-primary"
              onClick={() => void newDeck()}
            >
              New deck
            </button>
          </div>
        )}

        {library && library.decks.length > 0 && (
          <ul className="deck-grid">
            {library.decks.map((summary) => (
              <DeckCard
                key={summary.id}
                summary={summary}
                now={library.at}
                store={store}
                onChanged={reload}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function DeckCard({
  summary,
  now,
  store,
  onChanged,
}: {
  readonly summary: DeckSummary;
  readonly now: number;
  readonly store: DeckStore;
  readonly onChanged: () => void;
}) {
  const [dialog, setDialog] = useState<'rename' | 'delete' | undefined>();
  const trigger = useRef<HTMLButtonElement>(null);
  const href = routeHash({ page: 'deck', deckId: summary.id });

  return (
    <li className="deck-card">
      <a className="deck-open" href={href}>
        <span className="deck-thumb">
          <SlideView slide={summary.firstSlide} />
        </span>
        <span className="deck-title">{summary.title}</span>
        <span className="deck-meta">{deckMeta(summary.slideCount, summary.updatedAt, now)}</span>
      </a>

      <MenuButton
        label={`Options for ${summary.title}`}
        triggerRef={trigger}
        items={[
          {
            id: 'open',
            label: 'Open',
            onSelect: () => {
              navigate({ page: 'deck', deckId: summary.id });
            },
          },
          {
            id: 'rename',
            label: 'Rename',
            onSelect: () => {
              setDialog('rename');
            },
          },
          {
            id: 'duplicate',
            label: 'Duplicate',
            onSelect: () => {
              void store.duplicate(summary.id, systemEnv).then(onChanged);
            },
          },
          {
            id: 'delete',
            label: 'Delete',
            danger: true,
            separated: true,
            onSelect: () => {
              setDialog('delete');
            },
          },
        ]}
      />

      {dialog === 'rename' && (
        <RenameDialog
          deckTitle={summary.title}
          returnFocusTo={trigger}
          onCancel={() => {
            setDialog(undefined);
          }}
          onSave={(title) => {
            setDialog(undefined);
            void renameStoredDeck(store, summary.id, title, systemEnv).then(onChanged);
          }}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDeleteDialog
          deckTitle={summary.title}
          returnFocusTo={trigger}
          onCancel={() => {
            setDialog(undefined);
          }}
          onConfirm={() => {
            setDialog(undefined);
            void store.remove(summary.id).then(onChanged);
          }}
        />
      )}
    </li>
  );
}
