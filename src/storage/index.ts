// storage: IndexedDB, deck file pack and unpack, and the HTML exporter. Imports model and render.
export { AUTOSAVE_DELAY_MS, AUTOSAVE_MAX_WAIT_MS, Autosaver } from './autosave';
export type { AutosaverOptions, SaveState } from './autosave';
export type { StoredImage, StoredOriginal } from './database';
export {
  NEARLY_FULL_RATIO,
  formatBytes,
  formatUsage,
  isNearlyFull,
  isQuotaError,
  readStorageUsage,
} from './quota';
export type { StorageUsage } from './quota';
export { ImageCache } from './imageCache';
export { createDeckStore } from './store';
export type { DeckStore, DeckSummary } from './store';
