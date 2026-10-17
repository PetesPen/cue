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
 * "Storage is almost full" (design: States, "Storage banners"): back up the decks, then delete the ones that
 * are no longer needed. In the editor it offers Export deck for the deck that is open (SV-3).
 */
export function NearlyFullBanner({
  usage,
  withManageLink,
  onExport,
}: {
  readonly usage: StorageUsage;
  readonly withManageLink: boolean;
  readonly onExport?: () => void;
}) {
  const percent = Math.min(100, Math.round((usage.usage / usage.quota) * 100));
  return (
    <div className="banner banner-warning" role="status">
      <span className="banner-icon">
        <AlertIcon size={15} />
      </span>
      <span className="banner-text">
        <strong>Storage is almost full.</strong> {formatUsage(usage)} used on this device. Back up
        your decks, then delete the ones you no longer need.
        <span className="meter" aria-hidden="true">
          <span className="meter-fill" style={{ width: `${String(percent)}%` }} />
        </span>
      </span>
      {onExport && (
        <button type="button" className="button button-compact button-strong" onClick={onExport}>
          Export deck
        </button>
      )}
      {withManageLink && <ManageStorageLink />}
    </div>
  );
}

/** "Changes can't be saved": the edit is only in this tab until a save works again (SV-1). */
export function SaveFailedBanner({
  reason,
  onRetry,
  onExport,
}: {
  readonly reason: 'full' | 'error';
  readonly onRetry: () => void;
  /** Export the deck as a file, so that nothing is lost whatever happens to this tab (SV-3). */
  readonly onExport?: () => void;
}) {
  return (
    <div className="banner banner-danger" role="alert">
      <span className="banner-icon">
        <AlertIcon size={15} strokeWidth={2.2} />
      </span>
      <span className="banner-text">
        <strong>Changes can’t be saved.</strong>{' '}
        {reason === 'full'
          ? 'Storage is full, so your latest edits only exist in this tab. Export this deck now so nothing is lost, then delete decks you no longer need.'
          : 'Something went wrong storing this deck in your browser, so your latest edits only exist in this tab. Try again.'}
      </span>
      {onExport && (
        <button type="button" className="button button-compact button-danger" onClick={onExport}>
          Export deck
        </button>
      )}
      {reason === 'full' && <ManageStorageLink />}
      <button
        type="button"
        className={
          onExport ? 'button button-compact button-strong' : 'button button-compact button-danger'
        }
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}
