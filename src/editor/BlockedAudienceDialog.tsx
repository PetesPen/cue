import { useId, type RefObject } from 'react';
import { Modal } from './Dialogs';

/**
 * "Your browser blocked the audience window" (design: States, PM-1; decision 10, Option B). A show opens
 * only the audience window from the Present click; when the browser refuses it, this says how to allow
 * it and offers the show in this one window, without notes.
 */
export function BlockedAudienceDialog({
  onTryAgain,
  onOneWindow,
  onCancel,
  returnFocusTo,
}: {
  readonly onTryAgain: () => void;
  readonly onOneWindow: () => void;
  readonly onCancel: () => void;
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  return (
    <Modal titleId={titleId} onClose={onCancel} returnFocusTo={returnFocusTo}>
      <h2 id={titleId} className="dialog-title">
        Your browser blocked the audience window
      </h2>
      <p className="dialog-text">
        Allow pop-ups for this site using the icon at the right of the address bar, then try again.
        You can also present in one window without notes.
      </p>
      <div className="dialog-actions">
        <button type="button" className="button button-compact button-primary" onClick={onTryAgain}>
          Try again
        </button>
        <button type="button" className="button button-compact" onClick={onOneWindow}>
          Present in one window
        </button>
      </div>
    </Modal>
  );
}
