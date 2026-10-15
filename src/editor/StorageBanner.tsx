import { formatUsage, type StorageUsage } from '@/storage';
import { AlertIcon } from './Icons';

/** Opens the library in a new tab, so the deck being edited stays open and keeps its unsaved edits. */
function ManageStorageLink() {
  return (
    <a className="button button-compact button-strong" href="#/" target="_blank" rel="noopener">
      Manage storage
    </a>
  );
}

/**
 * "Storage is almost full" (design: States, "Storage banners"). The design's Export deck action
 * arrives with SV-3; until then the way to make room is deleting decks in the library.
 */
export function NearlyFullBanner({
  usage,
  withManageLink,
}: {
  readonly usage: StorageUsage;
  readonly withManageLink: boolean;
}) {
  const percent = Math.min(100, Math.round((usage.usage / usage.quota) * 100));
  return (
    <div className="banner banner-warning" role="status">
      <span className="banner-icon">
        <AlertIcon size={15} />
      </span>
      <span className="banner-text">
        <strong>Storage is almost full.</strong> {formatUsage(usage)} used on this device. Delete
        the decks you no longer need to make room.
        <span className="meter" aria-hidden="true">
          <span className="meter-fill" style={{ width: `${String(percent)}%` }} />
        </span>
      </span>
      {withManageLink && <ManageStorageLink />}
    </div>
  );
}

/** "Changes can't be saved": the edit is only in this tab until a save works again (SV-1). */
export function SaveFailedBanner({
  reason,
  onRetry,
}: {
  readonly reason: 'full' | 'error';
  readonly onRetry: () => void;
}) {
  return (
    <div className="banner banner-danger" role="alert">
      <span className="banner-icon">
        <AlertIcon size={15} strokeWidth={2.2} />
      </span>
      <span className="banner-text">
        <strong>Changes can’t be saved.</strong>{' '}
        {reason === 'full'
          ? 'Storage is full, so your latest edits only exist in this tab. Delete decks you no longer need, then try again.'
          : 'Something went wrong storing this deck in your browser, so your latest edits only exist in this tab. Try again.'}
      </span>
      {reason === 'full' && <ManageStorageLink />}
      <button type="button" className="button button-compact button-danger" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
