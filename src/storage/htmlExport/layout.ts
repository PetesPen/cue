/**
 * What an exported web page is made of (SV-4), shared by the exporter that writes it and the page's
 * program that reads it. Nothing here may import anything: the program runs in a page of its own.
 */

/** The block that holds the deck, as JSON. */
export const DECK_BLOCK = 'cue-deck';

/** The block that holds the licences of the fonts in the file, as plain text. */
export const LICENCES_BLOCK = 'cue-licences';

/** The block that holds one picture, as base64, carries its hash in this attribute... */
export const IMAGE_ATTRIBUTE = 'data-cue-image';

/** ...and its type (for example `image/png`) in this one. */
export const IMAGE_TYPE_ATTRIBUTE = 'data-cue-type';

/** Set on the page's root element: `included` when the notes are in the file, `none` when they are not. */
export const NOTES_ATTRIBUTE = 'data-cue-notes';

/** Where the page's program draws itself. */
export const ROOT_ID = 'cue-root';

/** The attribute that marks a block as data, not a program (the browser never runs a `text/plain` block). */
export const DATA_TYPES = { json: 'application/json', text: 'text/plain' } as const;

/** The escape for one character in JSON: a backslash, a u and four digits of hex. */
const escapeOf = (code: number) =>
  `${String.fromCharCode(92)}u${code.toString(16).padStart(4, '0')}`;

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Text that is safe inside a script block, whatever it holds: a `<` could end the block or open a
 * comment, and the two line separators end a line in older engines. In JSON each becomes the escape
 * that means the same character.
 */
export function escapeForScript(json: string): string {
  return json
    .replaceAll('<', escapeOf(0x3c))
    .replaceAll(LINE_SEPARATOR, escapeOf(0x2028))
    .replaceAll(PARAGRAPH_SEPARATOR, escapeOf(0x2029));
}

/** Text that is safe as the content or the attribute of an element. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
