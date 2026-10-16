import { DEFAULT_FONT, fontCapabilities } from './fonts';

/**
 * Rich text, stored as a small strict document in the shape TipTap (ProseMirror) produces, so the
 * editor can load and save it as it is and the static renderer can draw it (docs/spikes/SP-2.md).
 * `sanitiseRichText` is the one gate every text passes: loading a deck, saving from the editor and
 * pasting. Whatever it does not know it drops, and it never keeps a style the font does not have.
 */

export type Align = 'left' | 'center' | 'right' | 'justify';
export const ALIGNS: readonly Align[] = ['left', 'center', 'right', 'justify'];

export interface TextStyleAttrs {
  readonly fontFamily?: string;
  /** In slide pixels. */
  readonly fontSize?: number;
  /** Hex, upper case, six digits. */
  readonly color?: string;
}

export type TextMark =
  | { readonly type: 'bold' | 'italic' | 'underline' | 'strike' }
  | { readonly type: 'textStyle'; readonly attrs: TextStyleAttrs };

export type Inline =
  | { readonly type: 'text'; readonly text: string; readonly marks?: readonly TextMark[] }
  | { readonly type: 'hardBreak' };

export interface ParagraphAttrs {
  readonly align?: Align;
  /** A multiple of the font size, for example 1.2. */
  readonly lineHeight?: number;
  /** Levels of indent for a paragraph that is not in a list (0 to 6). */
  readonly indent?: number;
}

export interface Paragraph {
  readonly type: 'paragraph';
  readonly attrs?: ParagraphAttrs;
  readonly content?: readonly Inline[];
}

export interface ListItem {
  readonly type: 'listItem';
  /** A paragraph first, then paragraphs or nested lists. */
  readonly content: readonly Block[];
}

export interface ListBlock {
  readonly type: 'bulletList' | 'orderedList';
  readonly attrs?: { readonly start?: number };
  readonly content: readonly ListItem[];
}

export type Block = Paragraph | ListBlock;

export interface RichText {
  readonly type: 'doc';
  readonly content: readonly Block[];
}

/** What unmarked text looks like: the app's own font, a size that reads from the back of a room. */
export const DEFAULT_TEXT_STYLE = {
  fontFamily: DEFAULT_FONT,
  fontSize: 56,
  color: '#14281B',
} as const;

export const DEFAULT_LINE_HEIGHT = 1.2;
export const MAX_INDENT = 6;

export class InvalidTextError extends Error {
  override readonly name = 'InvalidTextError';
}

export function emptyText(): RichText {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/** One paragraph of plain text, for example when text is pasted onto a slide. */
export function textFromString(text: string): RichText {
  const lines = text.split(/\r?\n/);
  return {
    type: 'doc',
    content: lines.map((line): Paragraph =>
      line === ''
        ? { type: 'paragraph' }
        : { type: 'paragraph', content: [{ type: 'text', text: line }] },
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#abc` and `abc` and `#AABBCC` all become `#AABBCC`; anything else is not a colour here. */
export function normaliseColour(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = HEX.exec(value.trim());
  const digits = match?.[1];
  if (!digits) return undefined;
  const full = digits.length === 3 ? digits.replace(/./g, (d) => d + d) : digits;
  return `#${full.toUpperCase()}`;
}

function number(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

// Cleaning ------------------------------------------------------------------------------------

const FLAG_MARKS = ['bold', 'italic', 'underline', 'strike'] as const;
type FlagMark = (typeof FLAG_MARKS)[number];

function cleanStyle(raw: unknown): TextStyleAttrs {
  if (!isRecord(raw)) return {};
  const fontFamily =
    typeof raw.fontFamily === 'string' && raw.fontFamily.trim() !== ''
      ? raw.fontFamily.trim()
      : undefined;
  const fontSize = number(raw.fontSize, 1, 1000);
  const color = normaliseColour(raw.color);
  return {
    ...(fontFamily === undefined ? {} : { fontFamily }),
    ...(fontSize === undefined ? {} : { fontSize }),
    ...(color === undefined ? {} : { color }),
  };
}

/** The marks of one run, in one fixed order, without any style its font does not have. */
function cleanMarks(raw: unknown): TextMark[] {
  if (!Array.isArray(raw)) return [];
  const flags = new Set<FlagMark>();
  let style: TextStyleAttrs = {};
  for (const mark of raw as unknown[]) {
    if (!isRecord(mark)) continue;
    const flag = FLAG_MARKS.find((name) => name === mark.type);
    if (flag) flags.add(flag);
    else if (mark.type === 'textStyle') style = { ...style, ...cleanStyle(mark.attrs) };
  }
  const capabilities = fontCapabilities(style.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily);
  if (!capabilities.bold) flags.delete('bold');
  if (!capabilities.italic) flags.delete('italic');
  const marks: TextMark[] = FLAG_MARKS.filter((name) => flags.has(name)).map((type) => ({ type }));
  if (Object.keys(style).length > 0) marks.push({ type: 'textStyle', attrs: style });
  return marks;
}

function cleanInline(raw: unknown): Inline | undefined {
  if (!isRecord(raw)) return undefined;
  if (raw.type === 'hardBreak') return { type: 'hardBreak' };
  if (raw.type !== 'text' || typeof raw.text !== 'string' || raw.text === '') return undefined;
  const marks = cleanMarks(raw.marks);
  return marks.length > 0
    ? { type: 'text', text: raw.text, marks }
    : { type: 'text', text: raw.text };
}

const sameMarks = (a: Inline, b: Inline) =>
  a.type === 'text' &&
  b.type === 'text' &&
  JSON.stringify(a.marks ?? []) === JSON.stringify(b.marks ?? []);

/** Neighbouring runs with the same marks are one run, so equal text has one stored form. */
function mergeRuns(runs: readonly Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const run of runs) {
    const last = out.at(-1);
    if (last?.type === 'text' && run.type === 'text' && sameMarks(last, run)) {
      out[out.length - 1] = { ...last, text: last.text + run.text };
    } else out.push(run);
  }
  return out;
}

function cleanParagraphAttrs(raw: unknown): ParagraphAttrs {
  if (!isRecord(raw)) return {};
  const align = ALIGNS.find((a) => a === raw.align);
  const lineHeight = number(raw.lineHeight, 0.5, 5);
  const indentRaw = number(raw.indent, 1, MAX_INDENT);
  const indent = indentRaw === undefined ? undefined : Math.round(indentRaw);
  return {
    ...(align && align !== 'left' ? { align } : {}),
    ...(lineHeight === undefined ? {} : { lineHeight }),
    ...(indent === undefined ? {} : { indent }),
  };
}

function cleanParagraph(raw: Record<string, unknown>): Paragraph {
  const attrs = cleanParagraphAttrs(raw.attrs);
  const runs = Array.isArray(raw.content)
    ? mergeRuns((raw.content as unknown[]).flatMap((item) => cleanInline(item) ?? []))
    : [];
  return {
    type: 'paragraph',
    ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    ...(runs.length > 0 ? { content: runs } : {}),
  };
}

function cleanList(raw: Record<string, unknown>, type: ListBlock['type']): ListBlock | undefined {
  const items = Array.isArray(raw.content)
    ? (raw.content as unknown[]).flatMap((item): ListItem[] => {
        if (!isRecord(item) || item.type !== 'listItem') return [];
        const blocks = Array.isArray(item.content)
          ? (item.content as unknown[]).flatMap((block) => cleanBlock(block) ?? [])
          : [];
        const first = blocks[0];
        const content: Block[] =
          first?.type === 'paragraph' ? blocks : [{ type: 'paragraph' }, ...blocks];
        return [{ type: 'listItem', content }];
      })
    : [];
  if (items.length === 0) return undefined;
  const startRaw = isRecord(raw.attrs) ? number(raw.attrs.start, 1, 100000) : undefined;
  const start = startRaw === undefined ? undefined : Math.round(startRaw);
  return {
    type,
    ...(type === 'orderedList' && start !== undefined && start !== 1 ? { attrs: { start } } : {}),
    content: items,
  };
}

function cleanBlock(raw: unknown): Block | undefined {
  if (!isRecord(raw)) return undefined;
  if (raw.type === 'paragraph') return cleanParagraph(raw);
  if (raw.type === 'bulletList' || raw.type === 'orderedList') return cleanList(raw, raw.type);
  return undefined;
}

/**
 * The one gate for text: returns the text in its single stored form, or throws if it is not a text
 * document at all. Unknown nodes, marks and attributes are dropped; colours become `#RRGGBB`; runs
 * with equal marks are merged; bold or italic a font does not have is removed (decision 20).
 */
export function sanitiseRichText(raw: unknown): RichText {
  if (!isRecord(raw) || raw.type !== 'doc' || !Array.isArray(raw.content)) {
    throw new InvalidTextError('Text must be a document');
  }
  const blocks = (raw.content as unknown[]).flatMap((block) => cleanBlock(block) ?? []);
  return { type: 'doc', content: blocks.length > 0 ? blocks : [{ type: 'paragraph' }] };
}

// Reading ------------------------------------------------------------------------------------

function blockRuns(block: Block): Inline[] {
  if (block.type === 'paragraph') return [...(block.content ?? [])];
  return block.content.flatMap((item) => item.content.flatMap(blockRuns));
}

/** Every run of text in the document, in reading order. */
export function textRuns(doc: RichText): Extract<Inline, { type: 'text' }>[] {
  return doc.content.flatMap(blockRuns).flatMap((run) => (run.type === 'text' ? [run] : []));
}

function paragraphsOf(blocks: readonly Block[]): Paragraph[] {
  return blocks.flatMap((block) =>
    block.type === 'paragraph'
      ? [block]
      : block.content.flatMap((item) => paragraphsOf(item.content)),
  );
}

export function paragraphs(doc: RichText): Paragraph[] {
  return paragraphsOf(doc.content);
}

/** The words, paragraphs separated by line breaks (for the system clipboard, and for tests). */
export function plainText(doc: RichText): string {
  return paragraphs(doc)
    .map((p) =>
      (p.content ?? []).map((run) => (run.type === 'hardBreak' ? '\n' : run.text)).join(''),
    )
    .join('\n');
}

export function isEmptyText(doc: RichText): boolean {
  return plainText(doc).trim() === '';
}

/** The bundled font families the text uses (to load before drawing, and to list "fonts in this deck"). */
export function fontsUsed(doc: RichText): string[] {
  const families = new Set<string>();
  const runs = textRuns(doc);
  if (runs.length === 0 || runs.some((run) => !styleOf(run).fontFamily)) {
    families.add(DEFAULT_TEXT_STYLE.fontFamily);
  }
  for (const run of runs) {
    const family = styleOf(run).fontFamily;
    if (family) families.add(family);
  }
  return [...families];
}

function styleOf(run: Extract<Inline, { type: 'text' }>): TextStyleAttrs {
  const mark = run.marks?.find((m) => m.type === 'textStyle');
  return mark?.type === 'textStyle' ? mark.attrs : {};
}

const hasFlag = (run: Extract<Inline, { type: 'text' }>, flag: FlagMark) =>
  run.marks?.some((m) => m.type === flag) ?? false;

export const MIXED = 'mixed';
export type Mixed<T> = T | typeof MIXED;

export interface StyleSummary {
  readonly fontFamily: Mixed<string>;
  readonly fontSize: Mixed<number>;
  readonly color: Mixed<string>;
  readonly bold: Mixed<boolean>;
  readonly italic: Mixed<boolean>;
  readonly underline: Mixed<boolean>;
  readonly strike: Mixed<boolean>;
  readonly align: Mixed<Align>;
  readonly lineHeight: Mixed<number>;
  /** Every font in the text has a bold (italic) design, so the control is offered (decision 20). */
  readonly canBold: boolean;
  readonly canItalic: boolean;
}

function shared<T>(values: readonly T[], whenNone: T): Mixed<T> {
  const [first, ...rest] = values;
  if (first === undefined) return whenNone;
  return rest.every((v) => v === first) ? first : MIXED;
}

/** What the text looks like, or "mixed" where it differs: the values the toolbar and panel show. */
export function summariseStyle(doc: RichText): StyleSummary {
  const runs = textRuns(doc);
  const paragraphAttrs = paragraphs(doc).map((p) => p.attrs ?? {});
  const families = fontsUsed(doc);
  return {
    fontFamily: shared(
      runs.map((r) => styleOf(r).fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily),
      DEFAULT_TEXT_STYLE.fontFamily,
    ),
    fontSize: shared(
      runs.map((r) => styleOf(r).fontSize ?? DEFAULT_TEXT_STYLE.fontSize),
      DEFAULT_TEXT_STYLE.fontSize,
    ),
    color: shared(
      runs.map((r) => styleOf(r).color ?? DEFAULT_TEXT_STYLE.color),
      DEFAULT_TEXT_STYLE.color,
    ),
    bold: shared(
      runs.map((r) => hasFlag(r, 'bold')),
      false,
    ),
    italic: shared(
      runs.map((r) => hasFlag(r, 'italic')),
      false,
    ),
    underline: shared(
      runs.map((r) => hasFlag(r, 'underline')),
      false,
    ),
    strike: shared(
      runs.map((r) => hasFlag(r, 'strike')),
      false,
    ),
    align: shared(
      paragraphAttrs.map((a) => a.align ?? 'left'),
      'left',
    ),
    lineHeight: shared(
      paragraphAttrs.map((a) => a.lineHeight ?? DEFAULT_LINE_HEIGHT),
      DEFAULT_LINE_HEIGHT,
    ),
    canBold: families.every((family) => fontCapabilities(family).bold),
    canItalic: families.every((family) => fontCapabilities(family).italic),
  };
}

// Changing -----------------------------------------------------------------------------------

export interface StyleChange {
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly color?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strike?: boolean;
  readonly align?: Align;
  readonly lineHeight?: number;
}

function restyleRun(run: Extract<Inline, { type: 'text' }>, change: StyleChange): Inline {
  const flags = new Set(FLAG_MARKS.filter((name) => hasFlag(run, name)));
  for (const name of FLAG_MARKS) {
    const wanted = change[name];
    if (wanted === true) flags.add(name);
    if (wanted === false) flags.delete(name);
  }
  const style: TextStyleAttrs = {
    ...styleOf(run),
    ...(change.fontFamily === undefined ? {} : { fontFamily: change.fontFamily }),
    ...(change.fontSize === undefined ? {} : { fontSize: change.fontSize }),
    ...(change.color === undefined ? {} : { color: change.color }),
  };
  const marks: TextMark[] = [...flags].map((type) => ({ type }));
  marks.push({ type: 'textStyle', attrs: style });
  return { type: 'text', text: run.text, marks };
}

function restyleBlock(block: Block, change: StyleChange): Block {
  if (block.type === 'paragraph') {
    const attrs: ParagraphAttrs = {
      ...block.attrs,
      ...(change.align === undefined ? {} : { align: change.align }),
      ...(change.lineHeight === undefined ? {} : { lineHeight: change.lineHeight }),
    };
    return {
      type: 'paragraph',
      attrs,
      ...(block.content
        ? {
            content: block.content.map((run) =>
              run.type === 'text' ? restyleRun(run, change) : run,
            ),
          }
        : {}),
    };
  }
  return {
    ...block,
    content: block.content.map((item) => ({
      ...item,
      content: item.content.map((child) => restyleBlock(child, change)),
    })),
  };
}

/**
 * Apply a style to all of the text (used when a whole box is selected rather than some words). The
 * result goes through the same gate, so changing to a font without italic drops the italic.
 */
export function restyleText(doc: RichText, change: StyleChange): RichText {
  return sanitiseRichText({
    ...doc,
    content: doc.content.map((block) => restyleBlock(block, change)),
  });
}

export type ListKind = 'bulletList' | 'orderedList' | 'none';

/** Make every paragraph a bullet or numbered list item, or take them out of lists. */
export function setListKind(doc: RichText, kind: ListKind): RichText {
  const flat = paragraphs(doc);
  const content: Block[] =
    kind === 'none'
      ? flat
      : [{ type: kind, content: flat.map((p) => ({ type: 'listItem', content: [p] })) }];
  return sanitiseRichText({ type: 'doc', content });
}

/** The kind of list the text is, or `none`, or `mixed`. */
export function listKind(doc: RichText): Mixed<ListKind> {
  const kinds = doc.content.map((block) => (block.type === 'paragraph' ? 'none' : block.type));
  return shared(kinds, 'none');
}

/** Everything the toolbar and panel show about text: its style, and its list and indent. */
export interface TextSummary extends StyleSummary {
  readonly list: Mixed<ListKind>;
  /** Levels of indent of the paragraphs that are not in lists. */
  readonly indent: Mixed<number>;
}

export function summariseText(doc: RichText): TextSummary {
  const plain = doc.content.flatMap((block) => (block.type === 'paragraph' ? [block] : []));
  return {
    ...summariseStyle(doc),
    list: listKind(doc),
    indent: shared(
      plain.map((p) => p.attrs?.indent ?? 0),
      0,
    ),
  };
}

/** Indent the paragraphs that are not in lists by `delta` levels (negative to go back), within bounds. */
export function indentText(doc: RichText, delta: number): RichText {
  return sanitiseRichText({
    ...doc,
    content: doc.content.map((block) =>
      block.type === 'paragraph'
        ? {
            ...block,
            attrs: {
              ...block.attrs,
              indent: Math.min(MAX_INDENT, Math.max(0, (block.attrs?.indent ?? 0) + delta)),
            },
          }
        : block,
    ),
  });
}
