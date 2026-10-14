// SP-3 spike code: throwaway. Builds a fixture deck with synthetic photos in IndexedDB, exports it as
// one self-contained HTML file, and reports sizes and times.
import runtimeSource from './runtime.js?raw';

const fontUrls = import.meta.glob('../../src/fonts/**/*.woff2', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const licenceTexts = import.meta.glob('../../src/fonts/*/OFL.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

type Run = { family: string; size: number; color: string; italic?: boolean };
type SlideData = { title: string; body: string; titleRun: Run; bodyRun: Run; background: string; image: string | null; alt: string };
type Deck = { name: string; slides: SlideData[] };

// The font faces the fixture can use. Only the ones a deck uses are embedded.
const FACES: Record<string, { family: string; italic: boolean; weight: string; file: string; folder: string }> = {
  'Instrument Sans|normal': { family: 'Instrument Sans', italic: false, weight: '400 700', file: 'instrument-sans-latin-wght-normal.woff2', folder: 'instrument-sans' },
  'DM Serif Display|italic': { family: 'DM Serif Display', italic: true, weight: '400', file: 'dm-serif-display-latin-400-italic.woff2', folder: 'dm-serif-display' },
  'JetBrains Mono|normal': { family: 'JetBrains Mono', italic: false, weight: '100 800', file: 'jetbrains-mono-latin-wght-normal.woff2', folder: 'jetbrains-mono' },
};

const UNICODE_RANGE = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- IndexedDB: a stand-in for the real storage -------------------------------------------------
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sp3', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('images');
      request.result.createObjectStore('deck');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const wrap = <T,>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

// ---- the fixture: synthetic "photos" (smooth shapes plus fine noise, so JPEG cannot shrink them to nothing) ----
async function makePhoto(width: number, height: number, seed: number, noise: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const random = prng(seed);
  const hue = (seed * 37) % 360;
  const gradient = g.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${hue} 60% 55%)`);
  gradient.addColorStop(1, `hsl(${(hue + 80) % 360} 60% 35%)`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, width, height);
  for (let i = 0; i < 120; i += 1) {
    g.globalAlpha = 0.15 + random() * 0.3;
    g.fillStyle = `hsl(${Math.floor(random() * 360)} 60% 50%)`;
    g.beginPath();
    g.arc(random() * width, random() * height, 40 + random() * 400, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  const image = g.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (random() - 0.5) * noise;
    data[i] = (data[i] ?? 0) + n;
    data[i + 1] = (data[i + 1] ?? 0) + n;
    data[i + 2] = (data[i + 2] ?? 0) + n;
  }
  g.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.8));
}

async function makeFixture(options: { slides: number; width: number; height: number; noise: number; withImages?: boolean; storeAs?: 'blob' | 'arraybuffer' }) {
  const started = performance.now();
  const runs: [Run, Run][] = [
    [{ family: 'Instrument Sans', size: 96, color: '#14281B' }, { family: 'Instrument Sans', size: 44, color: 'rgba(20, 40, 27, 0.7)' }],
    [{ family: 'DM Serif Display', size: 96, color: '#17803F', italic: true }, { family: 'Instrument Sans', size: 44, color: '#14281B' }],
    [{ family: 'JetBrains Mono', size: 72, color: '#B3261E' }, { family: 'JetBrains Mono', size: 36, color: 'rgba(20, 40, 27, 0.7)' }],
  ];
  const slides: SlideData[] = [];
  const db = await openDb();
  await wrap(db.transaction(['images', 'deck'], 'readwrite').objectStore('images').clear());
  let sourceBytes = 0;
  const withImages = options.withImages ?? true;
  for (let i = 0; i < options.slides; i += 1) {
    const [titleRun, bodyRun] = runs[i % runs.length]!;
    const key = withImages ? `img-${i}` : null;
    if (key) {
      const photo = await makePhoto(options.width, options.height, i + 1, options.noise);
      sourceBytes += photo.size;
      const stored = options.storeAs === 'arraybuffer' ? { type: photo.type, bytes: await photo.arrayBuffer() } : photo;
      await wrap(db.transaction('images', 'readwrite').objectStore('images').put(stored, key));
    }
    slides.push({
      title: `Slide ${i + 1}: our approach to the official autumn launch`,
      body: 'Listen first, ship in small steps, and measure what matters.',
      titleRun,
      bodyRun,
      background: i % 4 === 0 ? '#14281B' : i % 4 === 1 ? '#FFFFFF' : i % 4 === 2 ? '#F5C542' : '#DDF1E3',
      image: key,
      alt: `Synthetic photo ${i + 1}`,
    });
  }
  const deck: Deck = { name: 'SP-3 fixture', slides };
  await wrap(db.transaction('deck', 'readwrite').objectStore('deck').put(deck, 'deck'));
  db.close();
  return { slides: options.slides, imageCount: withImages ? options.slides : 0, sourceBytes, averageImageKB: withImages ? Math.round(sourceBytes / options.slides / 1024) : 0, makeMs: Math.round(performance.now() - started) };
}

// ---- the exporter ------------------------------------------------------------------------------------
const toDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

async function recodeWebp(blob: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
  return out && out.type === 'image/webp' ? out : null; // browsers that cannot encode WebP return PNG
}

async function exportDeck(options: { recode: 'none' | 'webp' }) {
  const t0 = performance.now();
  const lap = () => performance.now();

  const db = await openDb();
  const deck = (await wrap(db.transaction('deck').objectStore('deck').get('deck'))) as Deck;
  const images = new Map<string, Blob>();
  for (const slide of deck.slides) {
    if (slide.image) {
      const raw = (await wrap(db.transaction('images').objectStore('images').get(slide.image))) as Blob | { type: string; bytes: ArrayBuffer };
      images.set(slide.image, raw instanceof Blob ? raw : new Blob([raw.bytes], { type: raw.type }));
    }
  }
  db.close();
  const tRead = lap();

  let recoded = 0;
  let webpSupported: boolean | null = null;
  if (options.recode === 'webp') {
    for (const [key, blob] of images) {
      const out = await recodeWebp(blob);
      webpSupported = out !== null;
      if (out) {
        images.set(key, out);
        recoded += 1;
      }
    }
  }
  const tRecode = lap();

  const imageScripts: string[] = [];
  let imageBytes = 0;
  for (const [key, blob] of images) {
    imageBytes += blob.size;
    imageScripts.push(`<script type="text/plain" data-image="${key}">${await toDataUrl(blob)}</script>\n`);
  }
  const tBase64 = lap();

  // Fonts: only the faces the deck uses, and the licence text of each family.
  const used = new Set<string>();
  for (const slide of deck.slides) {
    for (const run of [slide.titleRun, slide.bodyRun]) used.add(`${run.family}|${run.italic ? 'italic' : 'normal'}`);
  }
  let css = '';
  let fontBytes = 0;
  const licences: string[] = [];
  const families = new Set<string>();
  for (const key of used) {
    const face = FACES[key];
    if (!face) throw new Error(`No face for ${key}`);
    const url = Object.entries(fontUrls).find(([path]) => path.endsWith(face.file))?.[1];
    if (!url) throw new Error(`No file for ${face.file}`);
    const buffer = await (await fetch(url)).arrayBuffer();
    fontBytes += buffer.byteLength;
    const dataUrl = await toDataUrl(new Blob([buffer], { type: 'font/woff2' }));
    css += `@font-face{font-family:'${face.family}';font-style:${face.italic ? 'italic' : 'normal'};font-weight:${face.weight};font-display:block;src:url(${dataUrl}) format('woff2');unicode-range:${UNICODE_RANGE}}\n`;
    families.add(face.folder);
  }
  for (const folder of families) {
    const text = Object.entries(licenceTexts).find(([path]) => path.includes(`/${folder}/`))?.[1];
    if (text) licences.push(`=== ${folder} ===\n${text}`);
  }
  const tFonts = lap();

  const style = `${css}
html,body{margin:0;height:100%;overflow:hidden;background:#000}
.slide{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:center;overflow:hidden}
.text{position:absolute;left:96px;top:96px;width:1100px;line-height:1.2;white-space:break-spaces;overflow-wrap:break-word;font-variant-ligatures:none;font-feature-settings:"liga" 0;text-rendering:geometricPrecision}
.text p{margin:0 0 .5em}
.photo{position:absolute;right:96px;bottom:96px;width:760px;height:570px;object-fit:cover}`;
  const head =
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n` +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">\n` +
    `<title>${deck.name}</title>\n<style>\n${style}\n</style></head><body>\n<div id="stage"></div>\n`;
  const json = JSON.stringify(deck).replace(/</g, '\\u003c');
  const parts: BlobPart[] = [
    head,
    `<script type="application/json" id="deck">${json}</script>\n`,
    `<script type="text/plain" id="licences">${licences.join('\n').replace(/<\//g, '<\\/')}</script>\n`,
    ...imageScripts,
    `<script>\n${runtimeSource}\n</script>\n</body></html>\n`,
  ];
  const blob = new Blob(parts, { type: 'text/html' });
  const tAssemble = lap();

  const round = (x: number) => Math.round(x);
  return {
    blob,
    stats: {
      totalMs: round(tAssemble - t0),
      readFromIndexedDbMs: round(tRead - t0),
      recodeMs: round(tRecode - tRead),
      base64Ms: round(tBase64 - tRecode),
      fontsMs: round(tFonts - tBase64),
      assembleMs: round(tAssemble - tFonts),
      outputBytes: blob.size,
      outputMB: Math.round((blob.size / 1048576) * 10) / 10,
      imageBytesEmbedded: imageBytes,
      imageCount: images.size,
      recodedToWebp: recoded,
      webpSupported,
      fontBytes,
      fontFacesEmbedded: used.size,
      licencesEmbedded: licences.length,
    },
  };
}

async function exportAndDownload(options: { recode: 'none' | 'webp' }) {
  const { blob, stats } = await exportDeck(options);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'cue-sp3-export.html';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 60000);
  return stats;
}

(window as unknown as Record<string, unknown>)['__sp3'] = { makeFixture, exportDeck: async (o: { recode: 'none' | 'webp' }) => (await exportDeck(o)).stats, exportAndDownload };

const out = document.getElementById('out')!;
document.getElementById('make')!.onclick = async () => {
  out.textContent = 'Making 30 photos...';
  out.textContent = JSON.stringify(await makeFixture({ slides: 30, width: 2000, height: 1500, noise: 14 }), null, 2);
};
document.getElementById('export')!.onclick = async () => {
  out.textContent = 'Exporting...';
  out.textContent = JSON.stringify(await exportAndDownload({ recode: 'none' }), null, 2);
};
