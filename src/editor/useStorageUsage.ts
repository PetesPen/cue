import { useEffect, useState } from 'react';
import { readStorageUsage, type StorageUsage } from '@/storage';

/**
 * What the browser says storage holds and allows, read when the screen opens and again whenever
 * `refreshOn` changes (for example after each save). Nothing where the browser does not say.
 */
export function useStorageUsage(refreshOn?: unknown): StorageUsage | undefined {
  const [usage, setUsage] = useState<StorageUsage | undefined>();

  useEffect(() => {
    let current = true;
    void readStorageUsage().then((next) => {
      if (current) setUsage(next);
    });
    return () => {
      current = false;
    };
  }, [refreshOn]);

  return usage;
}
