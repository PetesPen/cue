import { SLIDE_HEIGHT, SLIDE_WIDTH, type Point } from '@/model';
import { sha256Hex, type StoredImage, type StoredOriginal } from '@/storage';

/**
 * Taking a file and making it a picture for a deck (EL-4): what it really is, how big it is, scaled
 * down if it is huge, and its content hash. The pure parts are tested on their own; the part that
 * decodes needs a browser.
 */

export const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** The `accept` list for a file chooser. */
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

/** A picture whose longer side is more than this many pixels is scaled down on import. */
export const MAX_LONG_EDGE = 2560;
/** A scaled-down picture keeps its original for the export only if the original is smaller than this. */
export const MAX_KEPT_ORIGINAL = 8 * 1024 * 1024;
/** Files bigger than this are not even tried. */
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
/** A new picture is at most this share of the slide, so it lands whole with room round it. */
export const FIT_SHARE = 0.8;
/** How far each further picture of one drop or paste sits from the one before, in slide pixels. */
export const CASCADE = 32;

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  signature.every((byte, i) => bytes[at + i] === byte);

/** What the bytes are, by their first bytes (the file's own name and type can be wrong), or nothing. */
export function sniffImageType(bytes: Uint8Array): ImageType | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  // "RIFF", four bytes of size, then "WEBP".
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  // An SVG is text: skip a byte order mark and spaces, then it is "<svg" or an XML header that has one.
  const head = new TextDecoder()
    .decode(bytes.subarray(0, 2048))
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (/^<svg[\s>]/i.test(head) || (/^<\?xml/i.test(head) && /<svg[\s>]/i.test(head))) {
    return 'image/svg+xml';
  }
  return undefined;
}

/** The size with the longer side at most `limit`, in the same proportions; `scaled` if it had to shrink. */
export function scaledSize(
  width: number,
  height: number,
  limit: number = MAX_LONG_EDGE,
): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (longest <= limit) return { width, height, scaled: false };
  const factor = limit / longest;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
    scaled: true,
  };
}

/** How big a new picture is drawn on the slide: its own size, shrunk only if it would not fit. */
export function fitInSlide(width: number, height: number): { width: number; height: number } {
  const factor = Math.min(
    1,
    (SLIDE_WIDTH * FIT_SHARE) / width,
    (SLIDE_HEIGHT * FIT_SHARE) / height,
  );
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  };
}

/**
 * Where a box of this size goes so that it is centred on `centre` (the middle of the slide if there
 * is none), moved `offset` along, and kept wholly on the slide.
 */
export function placeCentred(
  size: { width: number; height: number },
  centre: Point | undefined,
  offset = 0,
): { x: number; y: number } {
  const around = centre ?? { x: SLIDE_WIDTH / 2, y: SLIDE_HEIGHT / 2 };
  const clamp = (value: number, room: number) => Math.min(Math.max(0, room), Math.max(0, value));
  return {
    x: Math.round(clamp(around.x - size.width / 2 + offset, SLIDE_WIDTH - size.width)),
    y: Math.round(clamp(around.y - size.height / 2 + offset, SLIDE_HEIGHT - size.height)),
  };
}

// Turning a file into a picture -------------------------------------------------------------------

export type ImportFailure = 'notImage' | 'unreadable' | 'tooBig';

export class ImageImportError extends Error {
  override readonly name = 'ImageImportError';
  constructor(readonly reason: ImportFailure) {
    super(`The file could not be used as a picture (${reason})`);
  }
}

export interface Imported {
  readonly image: StoredImage;
  /** The size of the stored picture, in pixels. */
  readonly width: number;
  readonly height: number;
  /** Set when the picture was scaled down: the size it came in at. */
  readonly scaledFrom?: { readonly width: number; readonly height: number };
  /** The picture as it came in, when it was scaled down and is small enough to be worth keeping. */
  readonly original?: StoredOriginal;
}

/** Decode the bytes in the page, to learn the size and to be able to draw them again. */
async function decode(
  bytes: Uint8Array<ArrayBuffer>,
  type: ImageType,
): Promise<{ img: HTMLImageElement; release: () => void }> {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageImportError('unreadable');
  }
  return {
    img,
    release: () => {
      URL.revokeObjectURL(url);
    },
  };
}

function encode(canvas: HTMLCanvasElement, type: ImageType): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, 0.92);
  });
}

/**
 * Read a file as a picture: check what it really is, decode it, scale a huge one down (a PNG, JPEG or
 * WebP only: scaling a GIF would lose its movement, and an SVG has no pixels), and give it its hash.
 * Throws \`ImageImportError\` with a reason when it cannot.
 */
export async function importImage(file: Blob): Promise<Imported> {
  if (file.size > MAX_FILE_BYTES) throw new ImageImportError('tooBig');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (type === undefined) throw new ImageImportError('notImage');

  const { img, release } = await decode(bytes, type);
  try {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (width === 0 || height === 0) throw new ImageImportError('unreadable');

    const target = scaledSize(width, height);
    if (target.scaled && (type === 'image/png' || type === 'image/jpeg' || type === 'image/webp')) {
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, target.width, target.height);
      const blob = await encode(canvas, type);
      if (blob) {
        const smaller = new Uint8Array(await blob.arrayBuffer());
        const hash = await sha256Hex(smaller);
        return {
          image: { hash, type: blob.type || type, bytes: smaller },
          width: target.width,
          height: target.height,
          scaledFrom: { width, height },
          ...(bytes.length < MAX_KEPT_ORIGINAL ? { original: { hash, type, bytes } } : {}),
        };
      }
    }
    return { image: { hash: await sha256Hex(bytes), type, bytes }, width, height };
  } finally {
    release();
  }
}
