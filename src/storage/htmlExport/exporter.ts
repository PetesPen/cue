import type { Deck } from '@/model';
import type { StoredImage } from '../database';
import type { EmbeddedFont } from '../deckInfo';
import {
  DATA_TYPES,
  DECK_BLOCK,
  IMAGE_ATTRIBUTE,
  IMAGE_TYPE_ATTRIBUTE,
  LICENCES_BLOCK,
  NOTES_ATTRIBUTE,
  ROOT_ID,
  escapeForScript,
  escapeHtml,
} from './layout';

/**
 * The exported web page (SV-4): one file that plays a deck in any browser, online or off. It is made of
 * pieces (text and pictures) that the browser joins into a Blob, never one huge string (SP-3), and holds:
 *
 * - a content security policy first, so the browser itself refuses any request: the one script is allowed
 *   by its hash, and pictures and fonts may only come from the file itself (`data:` and `blob:`);
 * - the fonts the deck uses, as `@font-face` rules with the font inside, and their licences;
 * - the deck as JSON, and every picture the deck shows once, as base64 in a block of its own that the
 *   browser never runs and the page's program reads only when a slide needs it;
 * - the page's program and its style sheet (`virtual:cue-export-runtime`, built from the shared renderer).
 */

export interface HtmlExportInput {
  readonly deck: Deck;
  /** Every picture the deck shows. */
  readonly images: readonly StoredImage[];
  /** The fonts the deck uses, with their licences. */
  readonly fonts: readonly EmbeddedFont[];
  /** The app's own `@font-face` rules (src/fonts/fonts.css): the page uses the same declarations. */
  readonly fontsCss: string;
  /** Leave the speaker notes out of the file altogether (not just hidden). */
  readonly includeNotes: boolean;
  /** The page's program and its style sheet. */
  readonly runtime: { readonly script: string; readonly style: string };
}

/** The page cannot be made, and why. */
export class HtmlExportError extends Error {}

const CHUNK = 0x8000;

/** Bytes as base64, in pieces so that a big picture does not overflow the call. */
export function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let at = 0; at < bytes.length; at += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(at, at + CHUNK));
  }
  return btoa(text);
}

async function sha256Base64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toBase64(new Uint8Array(digest));
}

/** Text that sits inside a raw-text element (a script or a style) must not be able to close it. */
function assertSafeInside(text: string, tag: 'script' | 'style', what: string): void {
  if (new RegExp(`</${tag}|<!--`, 'i').test(text)) {
    throw new HtmlExportError(`${what} holds text that would end its ${tag} block.`);
  }
}

const FONT_FACE = /@font-face\s*\{[^}]*\}/g;

/**
 * The `@font-face` rules of the families in the file, each with its font file inside the rule. They are
 * the app's own rules, read from its style sheet, so the page draws text with the same declarations.
 */
export function fontFaces(fontsCss: string, fonts: readonly EmbeddedFont[]): string {
  const rules: string[] = [];
  for (const rule of fontsCss.match(FONT_FACE) ?? []) {
    const family = /font-family:\s*'([^']+)'/.exec(rule)?.[1];
    const file = /url\('\.\/[^']*?([^'/]+\.woff2)'\)/.exec(rule);
    const font = fonts.find((candidate) => candidate.family === family);
    const bytes = font?.files.find((candidate) => candidate.name === file?.[1])?.bytes;
    if (!file || !bytes) continue;
    rules.push(rule.replace(file[0], `url(data:font/woff2;base64,${toBase64(bytes)})`));
  }
  return rules.join('\n');
}

/** The deck as the page holds it: with its notes, or without any. */
function deckForPage(deck: Deck, includeNotes: boolean): Deck {
  return includeNotes
    ? deck
    : { ...deck, slides: deck.slides.map((slide) => ({ ...slide, notes: '' })) };
}

/** The pieces of the page, in order. */
export async function buildHtmlParts(input: HtmlExportInput): Promise<BlobPart[]> {
  const { deck, runtime } = input;
  assertSafeInside(runtime.script, 'script', 'The page program');
  assertSafeInside(runtime.style, 'style', 'The page style sheet');
  // The browser reads a line break in a script as a line feed, so a carriage return would change its hash.
  if (runtime.script.includes('\r')) {
    throw new HtmlExportError('The page program holds a carriage return.');
  }
  const faces = fontFaces(input.fontsCss, input.fonts);
  assertSafeInside(faces, 'style', 'The fonts');
  const licences = input.fonts
    .map((font) => `${font.family}\n\n${font.licence.trim()}`)
    .join('\n\n----------------------------------------\n\n');
  assertSafeInside(licences, 'script', 'The font licences');

  const policy = [
    "default-src 'none'",
    `script-src 'sha256-${await sha256Base64(runtime.script)}'`,
    "style-src 'unsafe-inline'",
    'img-src blob: data:',
    'font-src data:',
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  const parts: BlobPart[] = [
    `<!doctype html>\n<html lang="en" ${NOTES_ATTRIBUTE}="${input.includeNotes ? 'included' : 'none'}">\n<head>\n`,
    `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${policy}">\n`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="generator" content="Cue">\n',
    `<title>${escapeHtml(deck.title)}</title>\n`,
    `<style>${faces}</style>\n<style>${runtime.style}</style>\n</head>\n<body>\n`,
    `<div id="${ROOT_ID}"></div>\n<noscript>This presentation needs JavaScript to be shown.</noscript>\n`,
    `<script type="${DATA_TYPES.json}" id="${DECK_BLOCK}">${escapeForScript(JSON.stringify(deckForPage(deck, input.includeNotes)))}</script>\n`,
    `<script type="${DATA_TYPES.text}" id="${LICENCES_BLOCK}">${licences}</script>\n`,
  ];
  for (const image of input.images) {
    parts.push(
      `<script type="${DATA_TYPES.text}" ${IMAGE_ATTRIBUTE}="${escapeHtml(image.hash)}" ${IMAGE_TYPE_ATTRIBUTE}="${escapeHtml(image.type)}">`,
      toBase64(image.bytes),
      '</script>\n',
    );
  }
  parts.push(`<script>${runtime.script}</script>\n</body>\n</html>\n`);
  return parts;
}

/** The page as a file. */
export async function buildHtml(input: HtmlExportInput): Promise<Blob> {
  return new Blob(await buildHtmlParts(input), { type: 'text/html' });
}
