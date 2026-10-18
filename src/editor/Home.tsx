import { useEffect, useRef, useState } from 'react';
import { backupReminder, snoozeUntil, systemEnv, type Reminder } from '@/model';
import {
  formatBytes,
  isNearlyFull,
  type DeckStore,
  type DeckSummary,
  type UnreadableDeck,
} from '@/storage';
import { ConfirmDeleteDialog, RenameDialog } from './Dialogs';
import { BackupReminderBanner, NoticeBanner, type Notice } from './BackupBanner';
import {
  describeBackup,
  describeFileProblem,
  describeOpenedBackup,
  makeBackupFor,
  makeFileFor,
  makePageFor,
  openAnyFileInto,
  downloadFile,
} from './deckFiles';
import { ExportDialog } from './ExportDialog';
import { useInstall } from './InstallContext';
import { deckMeta } from './format';
import { AlertIcon, CloseIcon, DownloadIcon, FileIcon, FolderIcon, PlusIcon } from './Icons';
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
  /** Stored decks Cue cannot read: listed so they can be deleted (decision 17). */
  readonly unreadable: readonly UnreadableDeck[];
  /** When the list was read, so "2 hours ago" is worked out against one moment. */
  readonly at: number;
  /** The reminder to back up, when there is one to show (SV-8). */
  readonly reminder: Reminder | undefined;
}

/** The deck library at `#/` (design: Home): create, open, rename, duplicate and delete decks (SV-2). */
export function Home() {
  const store = useDeckStore();
  const [library, setLibrary] = useState<Library | undefined>();
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  // A file that could not be opened, and whether one is being read (SV-3).
  const [fileProblem, setFileProblem] = useState<{ title: string; text: string } | undefined>();
  const [opening, setOpening] = useState(false);
  // What a backup or opening a backup did, and whether a backup is being made (SV-8).
  const [notice, setNotice] = useState<Notice | undefined>();
  const [backingUp, setBackingUp] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const installer = useInstall();
  const usage = useStorageUsage(version);

  useEffect(() => {
    let current = true;
    Promise.all([
      store.list(),
      store.listUnreadable(),
      store.listFiled(),
      store.reminderSnoozedUntil(),
    ])
      .then(([decks, unreadable, filed, snoozedUntil]) => {
        const at = Date.now();
        const reminder = backupReminder(decks, filed, at, snoozedUntil);
        if (current) setLibrary({ decks, unreadable, at, reminder });
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

  /**
   * Open a deck file as a new deck and go to it; a backup adds every deck in it and says so (SV-3, SV-8). A
   * file that cannot be opened changes nothing.
   */
  async function openFile(file: File) {
    setOpening(true);
    setFileProblem(undefined);
    setNotice(undefined);
    try {
      const opened = await openAnyFileInto(store, file);
      if (opened.kind === 'deck') navigate({ page: 'deck', deckId: opened.deck.id });
      else {
        setNotice(describeOpenedBackup(opened));
        reload();
      }
    } catch (error) {
      setFileProblem(describeFileProblem(error));
    } finally {
      setOpening(false);
    }
  }

  /** Every deck in one file (SV-8): the file is saved, and then the decks are noted as filed. */
  async function backUp() {
    setBackingUp(true);
    setNotice(undefined);
    try {
      const made = await makeBackupFor(store);
      if (made.deckIds.length > 0) {
        downloadFile(made.file, made.name);
        await store.markFiled(made.deckIds, Date.now());
      }
      setNotice(describeBackup(made));
      reload();
    } catch {
      setNotice({
        tone: 'warning',
        title: 'The backup couldn’t be made.',
        text: 'Your decks are untouched. Try again, or export them one by one from their menus.',
      });
    } finally {
      setBackingUp(false);
    }
  }

  /** The reminder's close button: it stays away for 14 days. */
  async function hideReminder() {
    await store.snoozeReminder(snoozeUntil(Date.now()));
    reload();
  }

  const chooseFile = () => {
    fileInput.current?.click();
  };

  const decks = library?.decks;

  return (
    <div className="home">
      <header className="home-bar">
        <div className="home-brand">
          <Logo />
          <span className="wordmark">Cue</span>
        </div>
        <div className="home-actions">
          {installer && (
            <button
              type="button"
              className="button button-quiet"
              onClick={() => void installer.install()}
            >
              <DownloadIcon size={15} />
              Install Cue
            </button>
          )}
          <button type="button" className="button" disabled={opening} onClick={chooseFile}>
            <FolderIcon size={15} />
            {opening ? 'Opening…' : 'Open file'}
          </button>
          <button type="button" className="button button-primary" onClick={() => void newDeck()}>
            <PlusIcon size={15} strokeWidth={2.2} />
            New deck
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          className="file-input"
          accept=".slides,application/zip"
          tabIndex={-1}
          aria-label="Deck file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // So the same file can be chosen again straight after.
            event.target.value = '';
            if (file) void openFile(file);
          }}
        />
      </header>

      <main className="home-main">
        {usage && isNearlyFull(usage) && <NearlyFullBanner usage={usage} withManageLink={false} />}

        {library?.reminder && (
          <BackupReminderBanner
            reminder={library.reminder}
            busy={backingUp}
            onBackup={() => void backUp()}
            onClose={() => void hideReminder()}
          />
        )}

        {notice && (
          <NoticeBanner
            notice={notice}
            onClose={() => {
              setNotice(undefined);
            }}
          />
        )}

        <div className="library-header">
          <h1 className="section-label">
            Your decks{decks && decks.length > 0 ? ` · ${String(decks.length)}` : ''}
          </h1>
          <span className="library-tools">
            {decks && decks.length > 0 && (
              <button
                type="button"
                className="button button-quiet button-compact"
                disabled={backingUp}
                onClick={() => void backUp()}
              >
                {backingUp ? 'Backing up…' : 'Back up all decks'}
              </button>
            )}
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
          </span>
        </div>

        {fileProblem && (
          <div className="banner banner-danger banner-file" role="alert">
            <span className="banner-icon">
              <FileIcon size={15} strokeWidth={2.2} />
            </span>
            <span className="banner-text">
              <strong>{fileProblem.title}</strong> {fileProblem.text}
            </span>
            <button
              type="button"
              className="button button-compact button-strong button-on-danger"
              onClick={chooseFile}
            >
              Choose another file
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss"
              onClick={() => {
                setFileProblem(undefined);
              }}
            >
              <CloseIcon />
            </button>
          </div>
        )}

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
            <p>Start fresh, or open a file you exported before.</p>
            <div className="empty-actions">
              <button
                type="button"
                className="button button-compact button-primary"
                onClick={() => void newDeck()}
              >
                New deck
              </button>
              <button type="button" className="button button-compact" onClick={chooseFile}>
                Open file
              </button>
            </div>
          </div>
        )}

        {library && (library.decks.length > 0 || library.unreadable.length > 0) && (
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
            {library.unreadable.map((deck) => (
              <UnreadableCard key={deck.id} deck={deck} store={store} onChanged={reload} />
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
  const [dialog, setDialog] = useState<'rename' | 'delete' | 'export' | undefined>();
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
            id: 'export',
            label: 'Export…',
            onSelect: () => {
              setDialog('export');
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
      {dialog === 'export' && (
        <ExportDialog
          title={summary.title}
          slideCount={summary.slideCount}
          returnFocusTo={trigger}
          onSaved={() => {
            void store.markFiled([summary.id], Date.now()).then(onChanged);
          }}
          make={async (kind, options) => {
            const deck = await store.load(summary.id);
            if (!deck) throw new Error('This deck is not in this browser any more.');
            return kind === 'page' ? makePageFor(store, deck, options) : makeFileFor(store, deck);
          }}
          onClose={() => {
            setDialog(undefined);
          }}
        />
      )}

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

/** A stored deck Cue cannot read, shown so it can be deleted (decision 17); it is left in storage until then. */
function UnreadableCard({
  deck,
  store,
  onChanged,
}: {
  readonly deck: UnreadableDeck;
  readonly store: DeckStore;
  readonly onChanged: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const name = deck.title ?? 'A deck that can’t be opened';
  return (
    <li className="deck-card deck-card-unreadable">
      <div className="deck-open">
        <span className="deck-thumb deck-thumb-unreadable">
          <AlertIcon size={22} strokeWidth={2} />
        </span>
        <span className="deck-title">{name}</span>
        <span className="deck-meta">
          {deck.newer
            ? 'Saved by a newer version of Cue. Reload the page to get the latest version.'
            : 'Can’t be opened: its stored data may be damaged.'}
        </span>
      </div>
      <MenuButton
        label={`Options for ${name}`}
        triggerRef={trigger}
        items={[
          {
            id: 'delete',
            label: 'Delete',
            danger: true,
            onSelect: () => {
              setAsking(true);
            },
          },
        ]}
      />
      {asking && (
        <ConfirmDeleteDialog
          deckTitle={name}
          returnFocusTo={trigger}
          onCancel={() => {
            setAsking(false);
          }}
          onConfirm={() => {
            setAsking(false);
            void store.remove(deck.id).then(onChanged);
          }}
        />
      )}
    </li>
  );
}
