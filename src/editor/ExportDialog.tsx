/* The options are labels that hold their radio and their text a little deeper than the lint rule looks. */
/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { formatBytes } from '@/storage';
import { Modal } from './Dialogs';
import {
  downloadFile,
  estimateFileBytes,
  estimatePageBytes,
  type ExportKind,
  type MadeFile,
} from './deckFiles';
import { CheckIcon, CloseIcon } from './Icons';

type Made =
  | { readonly phase: 'making' }
  | { readonly phase: 'ready'; readonly made: MadeFile }
  | { readonly phase: 'failed'; readonly reason: string };

/** Many mail services refuse a file bigger than this (SP-3). */
const LARGE_FILE_BYTES = 20 * 1024 * 1024;

const WORDS: Record<ExportKind, { readonly made: string; readonly button: string }> = {
  page: { made: 'web page', button: 'Export web page' },
  file: { made: 'deck file', button: 'Export deck file' },
};

/**
 * "Export deck" (SV-3, SV-4; design: Export-Dialog). The standalone web page is the first choice and the
 * editable deck file the second; PDF and images are later still. The chosen file is made as the dialog
 * opens (and again when the notes choice changes), so its size is known and the button saves it at once;
 * a choice made once is kept for when the person comes back to it. The other choice's size is an estimate
 * from the pictures until it is chosen.
 */
export function ExportDialog({
  title,
  slideCount,
  make,
  onClose,
  onSaved,
  returnFocusTo,
}: {
  readonly title: string;
  readonly slideCount: number;
  /** Make the file of this kind. Called once for each kind (and notes choice) that is chosen. */
  readonly make: (
    kind: ExportKind,
    options: { readonly includeNotes: boolean },
  ) => Promise<MadeFile>;
  readonly onClose: () => void;
  /** The deck file was handed to the browser to save: the deck is in a file now, which the backup reminder counts (SV-8). */
  readonly onSaved?: () => void;
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const [kind, setKind] = useState<ExportKind>('page');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [results, setResults] = useState<Readonly<Record<string, Made>>>({});
  const started = useRef(new Set<string>());
  const gone = useRef(false);

  const key = kind === 'page' ? (includeNotes ? 'page' : 'page-quiet') : 'file';

  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);

  useEffect(() => {
    if (started.current.has(key)) return;
    started.current.add(key);
    setResults((before) => ({ ...before, [key]: { phase: 'making' } }));
    make(kind, { includeNotes }).then(
      (made) => {
        if (!gone.current) setResults((before) => ({ ...before, [key]: { phase: 'ready', made } }));
      },
      (error: unknown) => {
        if (gone.current) return;
        setResults((before) => ({
          ...before,
          [key]: {
            phase: 'failed',
            reason: error instanceof Error ? error.message : 'The file could not be made.',
          },
        }));
      },
    );
    // The deck is not changing while the dialog is open, so each file is made once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const state: Made = results[key] ?? { phase: 'making' };
  const page = results[includeNotes ? 'page' : 'page-quiet'];
  const pageNow = page?.phase === 'ready' ? page.made : undefined;
  const filed = results.file?.phase === 'ready' ? results.file.made : undefined;
  // What the pictures weigh, from any file made so far: the other file's size is guessed from it.
  const pictureBytes = pageNow?.pictureBytes ?? filed?.pictureBytes;

  const pageSize = pageNow
    ? `about ${formatBytes(pageNow.bytes)}`
    : pictureBytes === undefined
      ? kind === 'page' && state.phase === 'making'
        ? 'preparing…'
        : ''
      : `about ${formatBytes(estimatePageBytes(pictureBytes))}`;
  const fileSize = filed
    ? `about ${formatBytes(filed.bytes)}`
    : pictureBytes === undefined
      ? kind === 'file' && state.phase === 'making'
        ? 'preparing…'
        : ''
      : `about ${formatBytes(estimateFileBytes(pictureBytes))}`;

  const large = state.phase === 'ready' && state.made.bytes > LARGE_FILE_BYTES;

  return (
    <Modal
      titleId={titleId}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      className="dialog-export"
    >
      <div className="export-dialog">
        <div className="export-head">
          <div>
            <h2 id={titleId} className="dialog-title">
              Export deck
            </h2>
            <p className="export-sub">{`${title} · ${String(slideCount)} slide${slideCount === 1 ? '' : 's'}`}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <fieldset className="export-options">
          <legend className="visually-hidden">What to export</legend>
          <div className={`export-option${kind === 'page' ? ' export-option-on' : ''}`}>
            <label className="export-option-pick">
              <input
                type="radio"
                name="export-kind"
                checked={kind === 'page'}
                onChange={() => {
                  setKind('page');
                }}
              />
              <span className="export-option-body">
                <span className="export-option-head">
                  <strong>Standalone web page</strong>
                  <span
                    className="export-size"
                    aria-live="polite"
                  >{`.html${pageSize === '' ? '' : ` · ${pageSize}`}`}</span>
                </span>
                <span className="export-option-text">
                  One file that plays in any browser, online or offline. Keeps your animations,
                  transitions and fonts. Email it, or put it on a website.
                </span>
              </span>
            </label>
            {kind === 'page' && (
              <div className="export-extras">
                <label className="export-extra">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(event) => {
                      setIncludeNotes(event.target.checked);
                    }}
                  />
                  <span>
                    Include speaker notes{' '}
                    <span className="export-extra-hint">(press N in the page to show them)</span>
                  </span>
                </label>
                <p className="export-extra export-included">
                  <span className="export-check" aria-hidden="true">
                    <CheckIcon size={14} />
                  </span>
                  <span>
                    Pictures and fonts are included{' '}
                    <span className="export-extra-hint">(so it works offline)</span>
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className={`export-option${kind === 'file' ? ' export-option-on' : ''}`}>
            <label className="export-option-pick">
              <input
                type="radio"
                name="export-kind"
                checked={kind === 'file'}
                onChange={() => {
                  setKind('file');
                }}
              />
              <span className="export-option-body">
                <span className="export-option-head">
                  <strong>Editable deck file</strong>
                  <span
                    className="export-size"
                    aria-live="polite"
                  >{`.slides${fileSize === '' ? '' : ` · ${fileSize}`}`}</span>
                </span>
                <span className="export-option-text">
                  A backup you can open here again, or on another computer. Everything stays
                  editable.
                </span>
              </span>
            </label>
          </div>

          <div className="export-option export-option-off">
            <label className="export-option-pick">
              <input type="radio" name="export-kind" disabled />
              <span className="export-option-body">
                <span className="export-option-head">
                  <strong>PDF or images</strong>
                  <span className="export-badge">Coming later</span>
                </span>
                <span className="export-option-text">
                  For printing and sharing as flat pages. Animations won’t carry over.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {state.phase === 'failed' && (
          <p className="export-error" role="alert">
            {`The ${WORDS[kind].made} could not be made: ${state.reason}`}
          </p>
        )}
        {large && (
          <p className="export-large" role="status">
            This file is large. Some email services refuse files over 20 MB.
          </p>
        )}

        <div className="export-foot">
          <span className="export-note">Made on your device. Nothing is uploaded.</span>
          <div className="dialog-actions export-actions">
            <button type="button" className="button button-compact" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="button button-compact button-primary"
              disabled={state.phase !== 'ready'}
              onClick={() => {
                if (state.phase !== 'ready') return;
                downloadFile(state.made.file, state.made.name);
                // A web page cannot be opened again, so it is not a copy of the deck to come back to.
                if (kind === 'file') onSaved?.();
                onClose();
              }}
            >
              {WORDS[kind].button}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
