import { fontFolder, type EmbeddedFont } from './deckFile';

/**
 * The files of Cue's own fonts (src/fonts) and their licences, read from the app's own files, for a deck
 * file that carries the fonts its deck uses (SV-3, decision 38). Each family is a folder of `.woff2` files
 * and an `OFL.txt`; the licence text must travel with the fonts.
 */
const FILES = import.meta.glob<string>('../fonts/*/*', { query: '?url', import: 'default' });

async function read(load: () => Promise<string>): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(await load());
  if (!response.ok) throw new Error('A font file could not be read.');
  return new Uint8Array(await response.arrayBuffer());
}

/** The fonts, with their licences, for the families named; a family Cue does not have is left out. */
export async function loadBundledFonts(families: readonly string[]): Promise<EmbeddedFont[]> {
  const fonts: EmbeddedFont[] = [];
  for (const family of families) {
    const folder = `/fonts/${fontFolder(family)}/`;
    const mine = Object.entries(FILES).filter(([path]) => path.includes(folder));
    const licence = mine.find(([path]) => path.endsWith('/OFL.txt'));
    const faces = mine.filter(([path]) => path.endsWith('.woff2'));
    if (!licence || faces.length === 0) continue;
    fonts.push({
      family,
      files: await Promise.all(
        faces.map(async ([path, load]) => ({
          name: path.split('/').pop() ?? path,
          bytes: await read(load),
        })),
      ),
      licence: new TextDecoder().decode(await read(licence[1])),
    });
  }
  return fonts;
}
