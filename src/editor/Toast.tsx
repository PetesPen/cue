import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './Icons';

/** How long a toast stays before it fades (design: States, "Toast with Undo"). */
export const TOAST_MS = 6000;

export interface ToastData {
  readonly id: string;
  readonly message: string;
  /** A second line, smaller: for example "4000 × 3000 became 2000 × 1500". */
  readonly detail?: string;
  readonly icon?: ReactNode;
  readonly action?: { readonly label: string; readonly onAction: () => void };
}

interface ToastsProps {
  readonly toasts: readonly ToastData[];
  readonly onDismiss: (id: string) => void;
}

function Toast({
  toast,
  onDismiss,
}: {
  readonly toast: ToastData;
  readonly onDismiss: () => void;
}) {
  // The timer runs once, whatever the screen does meanwhile.
  const latest = useRef(onDismiss);
  useEffect(() => {
    latest.current = onDismiss;
  });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      latest.current();
    }, TOAST_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="toast" role="status">
      {toast.icon && <span className="toast-icon">{toast.icon}</span>}
      <span className="toast-text">
        <span className="toast-message">{toast.message}</span>
        {toast.detail && <span className="toast-detail">{toast.detail}</span>}
      </span>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action?.onAction();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDismiss}>
        <CloseIcon size={12} />
      </button>
    </div>
  );
}

/** Short messages at the bottom of the slide area, with an action such as Undo. */
export function Toasts({ toasts, onDismiss }: ToastsProps) {
  return (
    <div className="toast-host">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => {
            onDismiss(toast.id);
          }}
        />
      ))}
    </div>
  );
}
