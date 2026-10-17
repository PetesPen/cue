/* The options are labels that hold their radio and their text a little deeper than the lint rule looks. */
/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useId, useState, type RefObject } from 'react';
import { formatBytes } from '@/storage';
import { Modal } from './Dialogs';
import { downloadFile, type MadeFile } from './deckFiles';
import { CloseIcon } from './Icons';

type Made =
  | { readonly phase: 'making' }
  | { readonly phase: 'ready'; readonly made: MadeFile }
  | { readonly phase: 'failed'; readonly reason: string };

/**
 * "Export deck" (SV-3; design: Export-Dialog). The deck file is the choice that works now: it is made
 * as the dialog opens, so its size is known and the button saves it at once. The standalone web page
 * (sprint 10) is shown and cannot be chosen yet; PDF and images are later still.
 */
export function ExportDialog({
  title,
  slideCount,
  make,
  onClose,
  returnFocusTo,
}: {
  readonly title: string;
  readonly slideCount: number;
  /** Make the deck's file. Called once when the dialog opens. */
  readonly make: () => Promise<MadeFile>;
  readonly onClose: () => void;
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const [state, setState] = useState<Made>({ phase: 'making' });

  useEffect(() => {
    const stopped = new AbortController();
    const isStopped = () => stopped.signal.aborted;
    make().then(
      (made) => {
        if (!isStopped()) setState({ phase: 'ready', made });
      },
      (error: unknown) => {
        if (isStopped()) return;
        setState({
          phase: 'failed',
          reason: error instanceof Error ? error.message : 'The file could not be made.',
        });
      },
    );
    return () => {
      stopped.abort();
    };
    // The deck is not changing while the dialog is open, so the file is made once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const size =
    state.phase === 'ready'
      ? `about ${formatBytes(state.made.bytes)}`
      : state.phase === 'making'
        ? 'preparing…'
        : '';

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
          <label className="export-option export-option-off">
            <input type="radio" name="export-kind" disabled />
            <span className="export-option-body">
              <span className="export-option-head">
                <strong>Standalone web page</strong>
                <span className="export-badge">Coming soon</span>
              </span>
              <span className="export-option-text">
                One file that plays in any browser, online or offline. Keeps your animations,
                transitions and fonts.
              </span>
            </span>
          </label>
          <label className="export-option export-option-on">
            <input type="radio" name="export-kind" defaultChecked />
            <span className="export-option-body">
              <span className="export-option-head">
                <strong>Editable deck file</strong>
                <span
                  className="export-size"
                  aria-live="polite"
                >{`.slides${size === '' ? '' : ` · ${size}`}`}</span>
              </span>
              <span className="export-option-text">
                A backup you can open here again, or on another computer. Everything stays editable.
              </span>
            </span>
          </label>
          <label className="export-option export-option-off">
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
        </fieldset>

        {state.phase === 'failed' && (
          <p className="export-error" role="alert">
            {`The deck file could not be made: ${state.reason}`}
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
                onClose();
              }}
            >
              Export deck file
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
