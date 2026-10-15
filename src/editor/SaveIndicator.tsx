import type { SaveState } from '@/storage';
import { AlertIcon, CheckIcon } from './Icons';

/**
 * The quiet save status in the top bar (design: States, "Save status"). Only a failure is announced
 * to screen readers: Saving and Saved change on every edit and would be noise.
 */
export function SaveIndicator({ state }: { readonly state: SaveState }) {
  if (state.status === 'failed') {
    return (
      <span className="save-status save-status-failed" role="alert">
        <AlertIcon size={14} />
        Not saved
      </span>
    );
  }
  if (state.status === 'saving') {
    return (
      <span className="save-status">
        <span className="spinner" aria-hidden="true" />
        Saving…
      </span>
    );
  }
  return (
    <span className="save-status">
      <CheckIcon size={14} />
      Saved
    </span>
  );
}
