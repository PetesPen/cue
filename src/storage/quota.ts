/** Storage is "nearly full" at 90% or more of the quota the browser reports (SV-1, decision 12). */
export const NEARLY_FULL_RATIO = 0.9;

export interface StorageUsage {
  readonly usage: number;
  readonly quota: number;
}

export function isNearlyFull({ usage, quota }: StorageUsage): boolean {
  return quota > 0 && usage / quota >= NEARLY_FULL_RATIO;
}

/** What the browser says it holds and allows, or nothing where it does not say (SP-5). */
export async function readStorageUsage(): Promise<StorageUsage | undefined> {
  try {
    // `navigator.storage` is missing in some contexts (insecure pages, some embedded views).
    const { usage, quota } = await navigator.storage.estimate();
    if (usage === undefined || quota === undefined) return undefined;
    return { usage, quota };
  } catch {
    return undefined;
  }
}

/**
 * Dexie wraps the browser's error when a transaction aborts, so a full store shows up either as
 * the error itself or as its `inner` error (docs/spikes/SP-5.md).
 */
export function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('name' in error && error.name === 'QuotaExceededError') return true;
  return 'inner' in error && error.inner !== error && isQuotaError(error.inner);
}

const GB = 1e9;
const MB = 1e6;

function trimmed(value: number): string {
  return String(value >= 10 ? Math.round(value) : Math.round(value * 10) / 10);
}

/** "0.9 of about 1 GB": both numbers in the quota's unit, so the banner shows real figures. */
export function formatUsage({ usage, quota }: StorageUsage): string {
  const unit = quota >= GB ? 'GB' : 'MB';
  const size = unit === 'GB' ? GB : MB;
  return `${trimmed(usage / size)} of about ${trimmed(quota / size)} ${unit}`;
}

/** "38 MB", "512 KB": a size for a label. */
export function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${trimmed(bytes / GB)} GB`;
  if (bytes >= MB) return `${trimmed(bytes / MB)} MB`;
  return `${String(Math.max(1, Math.round(bytes / 1000)))} KB`;
}
