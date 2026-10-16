import { useEffect, useId, useRef, useState, type RefObject, type SyntheticEvent } from 'react';

interface ModalProps {
  readonly titleId: string;
  /** The wide dialog of the shortcut list. */
  readonly wide?: boolean;
  readonly onClose: () => void;
  /** Focus goes back here when the dialog goes away. */
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
  readonly children: React.ReactNode;
}

/** A modal on the browser's own `<dialog>`: focus is trapped, Escape closes it, the page behind is inert. */
export function Modal({ titleId, wide = false, onClose, returnFocusTo, children }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    const returnTo = returnFocusTo;
    return () => {
      returnTo?.current?.focus();
    };
  }, [returnFocusTo]);

  return (
    <dialog
      ref={dialog}
      className={wide ? 'dialog dialog-wide' : 'dialog'}
      aria-labelledby={titleId}
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}

/** "Delete “Team offsite”?" (design: States, "Confirm delete"). Cancel is focused first. */
export function ConfirmDeleteDialog({
  deckTitle,
  onConfirm,
  onCancel,
  returnFocusTo,
}: {
  readonly deckTitle: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  return (
    <Modal titleId={titleId} onClose={onCancel} returnFocusTo={returnFocusTo}>
      <h2 id={titleId} className="dialog-title">
        Delete “{deckTitle}”?
      </h2>
      <p className="dialog-text">This removes the deck from this device and can’t be undone.</p>
      <div className="dialog-actions">
        <button type="button" className="button button-compact" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="button button-compact button-danger" onClick={onConfirm}>
          Delete deck
        </button>
      </div>
    </Modal>
  );
}

export function RenameDialog({
  deckTitle,
  onSave,
  onCancel,
  returnFocusTo,
}: {
  readonly deckTitle: string;
  readonly onSave: (title: string) => void;
  readonly onCancel: () => void;
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const fieldId = useId();
  const [value, setValue] = useState(deckTitle);

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    onSave(value);
  }

  return (
    <Modal titleId={titleId} onClose={onCancel} returnFocusTo={returnFocusTo}>
      <form onSubmit={submit}>
        <h2 id={titleId} className="dialog-title">
          Rename deck
        </h2>
        <label htmlFor={fieldId} className="field-label">
          Deck name
        </label>
        <input
          id={fieldId}
          className="field"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          onFocus={(event) => {
            event.target.select();
          }}
        />
        <div className="dialog-actions">
          <button type="button" className="button button-compact" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button button-compact button-primary">
            Rename
          </button>
        </div>
      </form>
    </Modal>
  );
}
