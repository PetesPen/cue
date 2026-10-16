import { createContext, useContext } from 'react';
import type { ImageCache } from '@/storage';

export const ImageCacheContext = createContext<ImageCache | undefined>(undefined);

/** The editor's picture cache, or nothing outside the editor (a test of one piece, say). */
export function useImageCache(): ImageCache | undefined {
  return useContext(ImageCacheContext);
}
