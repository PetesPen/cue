// SP-5 spike code: throwaway. What does browser storage do with a deck: how much fits, what a full
// store looks like, whether a failed save leaves half a deck, and how fast saving and opening are.
import Dexie, { type Table } from 'dexie';

type DeckRow = { id: string; title: string; slides: unknown[]; updatedAt: number; imageHashes: string[] };
type ImageRow = { hash: string; type: string; bytes: ArrayBuffer };
type BlobRow = { hash: string; blob: Blob };

class SpikeDb extends Dexie {
  decks!: Table<DeckRow, string>;
  images!: Table<ImageRow, string>;
  blobs!: Table<BlobRow, string>;
  constructor() {
    super('sp5');
    this.version(1).stores({ decks: 'id, updatedAt', images: 'hash', blobs: 'hash' });
  }
}
const db = new SpikeDb();

const MB = 1024 * 1024;
const round = (x: number, places = 1) => Math.round(x * 10 ** places) / 10 ** places;

/** Bytes that do not compress, like a JPEG. */
function randomBytes(size: number): ArrayBuffer {
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);
  for (let offset = 0; offset < size; offset += 65536) crypto.getRandomValues(view.subarray(offset, Math.min(size, offset + 65536)));
  return buffer;
}
async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? null;
};
function describeError(error: unknown) {
  const e = error as { name?: string; message?: string; inner?: { name?: string }; constructor?: { name?: string } };
  return { name: e.name ?? 'unknown', innerName: e.inner?.name ?? null, constructor: e.constructor?.name ?? null, message: String(e.message ?? error).slice(0, 160) };
}
function slideJson(i: number) {
  return { id: `s${i}`, background: '#FFFFFF', elements: Array.from({ length: 12 }, (_, k) => ({ id: `s${i}e${k}`, type: k % 3 === 0 ? 'text' : 'shape', x: k * 40, y: k * 30, w: 300, h: 120, opacity: 0.8, text: 'Listen first, ship in small steps, and measure what matters. '.repeat(3) })), notes: 'Open with the customer problem. '.repeat(10) };
}
function makeDeck(id: string, slides: number, imageHashes: string[]): DeckRow {
  return { id, title: `Deck ${id}`, slides: Array.from({ length: slides }, (_, i) => slideJson(i)), updatedAt: Date.now(), imageHashes };
}

async function numbers() {
  const estimate = await navigator.storage.estimate();
  const persistedBefore = await navigator.storage.persisted?.();
  // Firefox shows the user a prompt and leaves this promise pending until they answer, so give it a short time.
  let persistResult: boolean | string = 'not supported';
  try {
    const answer = await Promise.race([
      navigator.storage.persist?.() ?? Promise.resolve('not supported'),
      new Promise<string>((resolve) => setTimeout(() => resolve('no answer after 2 s (a permission prompt is probably waiting)'), 2000)),
    ]);
    persistResult = answer;
  } catch (error) {
    persistResult = describeError(error).message;
  }
  return {
    quotaMB: estimate.quota === undefined ? null : round(estimate.quota / MB, 0),
    usageMB: estimate.usage === undefined ? null : round(estimate.usage / MB, 2),
    persistedBefore: persistedBefore ?? 'not supported',
    persistResult,
    secureContext: isSecureContext,
  };
}

/** Photos as Blobs against raw bytes: does the browser store them, and do they come back identical? */
async function blobsAndBytes(count = 30, size = 700 * 1024) {
  await db.blobs.clear();
  await db.images.clear();
  const originals = Array.from({ length: count }, () => randomBytes(size));
  const hashes = await Promise.all(originals.map(sha256));
  const result: Record<string, unknown> = { count, sizeKB: size / 1024 };

  let t = performance.now();
  try {
    await db.blobs.bulkPut(originals.map((b, i) => ({ hash: hashes[i]!, blob: new Blob([b], { type: 'image/jpeg' }) })));
    const writeMs = performance.now() - t;
    t = performance.now();
    const rows = await db.blobs.toArray();
    const back = await Promise.all(rows.map((r) => r.blob.arrayBuffer()));
    const readMs = performance.now() - t;
    const same = (await Promise.all(back.map(sha256))).every((h) => hashes.includes(h));
    Object.assign(result, { blob: { ok: true, writeMs: round(writeMs, 0), readMs: round(readMs, 0), identical: same } });
  } catch (error) {
    Object.assign(result, { blob: { ok: false, ...describeError(error) } });
  }

  t = performance.now();
  try {
    await db.images.bulkPut(originals.map((b, i) => ({ hash: hashes[i]!, type: 'image/jpeg', bytes: b })));
    const writeMs = performance.now() - t;
    t = performance.now();
    const rows = await db.images.toArray();
    const readMs = performance.now() - t;
    const same = (await Promise.all(rows.map((r) => sha256(r.bytes)))).every((h) => hashes.includes(h));
    Object.assign(result, { arrayBuffer: { ok: true, writeMs: round(writeMs, 0), readMs: round(readMs, 0), identical: same } });
  } catch (error) {
    Object.assign(result, { arrayBuffer: { ok: false, ...describeError(error) } });
  }
  return result;
}

/** All or nothing: a deck and its photos in one transaction. */
async function saveDeckAtomically(id: string, imageMB: number, imageSizeMB = 5) {
  const count = Math.ceil(imageMB / imageSizeMB);
  const rows: ImageRow[] = [];
  for (let i = 0; i < count; i += 1) {
    const bytes = randomBytes(imageSizeMB * MB);
    rows.push({ hash: `${id}-img${i}`, type: 'image/jpeg', bytes });
  }
  const started = performance.now();
  try {
    await db.transaction('rw', db.decks, db.images, async () => {
      await db.images.bulkPut(rows);
      await db.decks.put(makeDeck(id, 10, rows.map((r) => r.hash)));
    });
    return { ok: true, ms: round(performance.now() - started, 0) };
  } catch (error) {
    return { ok: false, ms: round(performance.now() - started, 0), ...describeError(error) };
  }
}

/** The anti-pattern: one transaction per photo, then the deck. */
async function saveDeckInPieces(id: string, imageMB: number, imageSizeMB = 5) {
  const count = Math.ceil(imageMB / imageSizeMB);
  let written = 0;
  try {
    for (let i = 0; i < count; i += 1) {
      await db.images.put({ hash: `${id}-img${i}`, type: 'image/jpeg', bytes: randomBytes(imageSizeMB * MB) });
      written += 1;
    }
    await db.decks.put(makeDeck(id, 10, []));
    return { ok: true, photosWritten: written };
  } catch (error) {
    return { ok: false, photosWritten: written, ...describeError(error) };
  }
}

async function counts() {
  const [decks, images] = await Promise.all([db.decks.toArray(), db.images.toArray()]);
  const referenced = new Set(decks.flatMap((d) => d.imageHashes));
  const orphans = images.filter((i) => !referenced.has(i.hash)).length;
  return { decks: decks.map((d) => d.id), images: images.length, orphanImages: orphans };
}

/** SV-1 and UX-3 numbers: autosave latency, listing decks, opening a 50-slide deck. */
async function timings() {
  await db.decks.clear();
  await db.images.clear();
  // 20 decks of 50 slides (a few hundred KB of JSON each).
  for (let d = 0; d < 20; d += 1) await db.decks.put(makeDeck(`deck-${d}`, 50, []));
  // One big deck: 50 slides, 50 photos of about 700 KB.
  const hashes: string[] = [];
  const rows: ImageRow[] = [];
  for (let i = 0; i < 50; i += 1) {
    const bytes = randomBytes(700 * 1024);
    const hash = `big-${i}`;
    hashes.push(hash);
    rows.push({ hash, type: 'image/jpeg', bytes });
  }
  await db.images.bulkPut(rows);
  await db.decks.put(makeDeck('big', 50, hashes));

  const jsonKB = Math.round(JSON.stringify(makeDeck('x', 50, [])).length / 1024);
  const time = async <T,>(work: () => Promise<T>) => {
    const t = performance.now();
    await work();
    return round(performance.now() - t, 0);
  };
  const listDecksMs = await time(() => db.decks.orderBy('updatedAt').reverse().toArray().then((all) => all.map((d) => ({ id: d.id, title: d.title }))));
  const openDeckMs = await time(() => db.decks.get('big'));
  const firstPhotoMs = await time(() => db.images.get('big-0'));
  const allPhotosMs = await time(() => db.images.bulkGet(hashes));

  const latencies: number[] = [];
  for (let i = 0; i < 40; i += 1) {
    const deck = makeDeck('big', 50, hashes);
    deck.title = `edit ${i}`;
    const t = performance.now();
    await db.decks.put(deck);
    latencies.push(performance.now() - t);
  }
  return { deckJsonKB: jsonKB, photosMB: round((50 * 700) / 1024, 1), listDecksMs, openDeckJsonMs: openDeckMs, firstPhotoMs, allFiftyPhotosMs: allPhotosMs, autosaveMs: { p50: round(percentile(latencies, 50) ?? 0), p95: round(percentile(latencies, 95) ?? 0), max: round(Math.max(...latencies)) } };
}

async function reset() {
  db.close();
  await Dexie.delete('sp5');
  await db.open();
}

(window as unknown as Record<string, unknown>)['__sp5'] = { reset, numbers, blobsAndBytes, saveDeckAtomically, saveDeckInPieces, counts, timings, reopen: async () => { db.close(); await db.open(); return counts(); } };

const out = document.getElementById('out')!;
const show = (value: unknown) => {
  out.textContent = JSON.stringify(value, null, 2);
};
document.getElementById('numbers')!.onclick = async () => show(await numbers());
document.getElementById('blobs')!.onclick = async () => show(await blobsAndBytes());
document.getElementById('timings')!.onclick = async () => show(await timings());
document.title = 'SP-5 ready';
