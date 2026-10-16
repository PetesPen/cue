import {
  DEFAULT_LINE_HEIGHT,
  DEFAULT_TEXT_STYLE,
  fontsUsed,
  textRuns,
  type Block,
  type Inline,
  type ParagraphAttrs,
  type RichText,
  type TextElement,
  type TextMark,
} from '@/model';

/**
 * The static text renderer (EL-1). Everything that only shows text (thumbnails, the presenter, the
 * audience, the export) draws it with this, and it follows the four rules found in spike SP-2 so that
 * lines break exactly where they do in the editor (docs/spikes/SP-2.md):
 *   1. the same structure as the editor's output: p, ul and ol with li and p inside, strong, em,
 *      u, s, and a span with inline font-family, font-size and colour;
 *   2. the same CSS that ProseMirror puts on the editor (see `.cue-text` in slide.css);
 *   3. `text-rendering: geometricPrecision` on the slide (slide.css);
 *   4. a break in an empty paragraph, and a second one after a paragraph that ends in a soft return.
 */

/** One level of indent, in slide pixels. */
export const INDENT_STEP = 48;

function applyParagraphAttrs(p: HTMLElement, attrs: ParagraphAttrs | undefined): void {
  if (!attrs) return;
  if (attrs.align) p.style.textAlign = attrs.align;
  if (attrs.lineHeight !== undefined) p.style.lineHeight = String(attrs.lineHeight);
  if (attrs.indent) p.style.marginLeft = `${String(attrs.indent * INDENT_STEP)}px`;
}

function wrapInMark(inner: Node, mark: TextMark): Node {
  if (mark.type === 'textStyle') {
    const span = document.createElement('span');
    const { fontFamily, fontSize, color } = mark.attrs;
    if (fontFamily) span.style.fontFamily = `"${fontFamily}"`;
    if (fontSize) span.style.fontSize = `${String(fontSize)}px`;
    if (color) span.style.color = color;
    span.append(inner);
    return span;
  }
  const tag = { bold: 'strong', italic: 'em', underline: 'u', strike: 's' }[mark.type];
  const element = document.createElement(tag);
  element.append(inner);
  return element;
}

function renderInline(run: Inline): Node {
  if (run.type === 'hardBreak') return document.createElement('br');
  return (run.marks ?? []).reduceRight<Node>(wrapInMark, document.createTextNode(run.text));
}

function renderBlock(block: Block): HTMLElement {
  if (block.type === 'paragraph') {
    const p = document.createElement('p');
    applyParagraphAttrs(p, block.attrs);
    const runs = block.content ?? [];
    for (const run of runs) p.append(renderInline(run));
    // Rule 4: an empty line still has height, and a final soft return shows its empty last line.
    if (runs.length === 0 || runs.at(-1)?.type === 'hardBreak') {
      p.append(document.createElement('br'));
    }
    return p;
  }
  const list =
    block.type === 'bulletList' ? document.createElement('ul') : document.createElement('ol');
  if (list instanceof HTMLOListElement && block.attrs?.start) list.start = block.attrs.start;
  for (const item of block.content) {
    const li = document.createElement('li');
    for (const child of item.content) li.append(renderBlock(child));
    list.append(li);
  }
  return list;
}

/** Fill `into` (a `.cue-text` element) with the text. */
export function renderText(into: HTMLElement, doc: RichText): void {
  into.replaceChildren(...doc.content.map(renderBlock));
}

/** A `.cue-text` element with the default style, ready to be filled. */
export function createTextBody(): HTMLDivElement {
  const body = document.createElement('div');
  body.className = 'cue-text';
  body.style.fontFamily = `"${DEFAULT_TEXT_STYLE.fontFamily}"`;
  body.style.fontSize = `${String(DEFAULT_TEXT_STYLE.fontSize)}px`;
  body.style.color = DEFAULT_TEXT_STYLE.color;
  body.style.lineHeight = String(DEFAULT_LINE_HEIGHT);
  return body;
}

// Fonts ---------------------------------------------------------------------------------------

/** Load the font files this text uses, so it is never drawn or measured in a fallback font. */
export async function ensureFonts(doc: RichText): Promise<void> {
  const wanted = new Set<string>();
  for (const family of fontsUsed(doc)) {
    wanted.add(`400 16px "${family}"`);
    wanted.add(`700 16px "${family}"`);
    wanted.add(`italic 400 16px "${family}"`);
  }
  for (const run of textRuns(doc)) {
    const style = run.marks?.find((m) => m.type === 'textStyle');
    const family = style?.type === 'textStyle' ? style.attrs.fontFamily : undefined;
    const bold = run.marks?.some((m) => m.type === 'bold') ?? false;
    const italic = run.marks?.some((m) => m.type === 'italic') ?? false;
    wanted.add(
      `${italic ? 'italic ' : ''}${bold ? '700' : '400'} 16px "${family ?? DEFAULT_TEXT_STYLE.fontFamily}"`,
    );
  }
  // A face that does not exist (italic of a font with none) resolves to nothing; that is fine.
  await Promise.all([...wanted].map((face) => document.fonts.load(face).catch(() => [])));
}

// Measuring -----------------------------------------------------------------------------------

let holder: HTMLElement | undefined;

/** A hidden place off to the side, so no rule about the page's own children reaches the probe. */
function probeHolder(): HTMLElement {
  if (holder?.isConnected) return holder;
  holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.className = 'cue-measure-holder';
  document.body.append(holder);
  return holder;
}

/**
 * How tall a text box must be for its text: the text laid out at the box's width, plus padding and
 * border. Measured in a hidden copy built the same way as the real thing. Call `ensureFonts` first.
 */
export function measureTextHeight(element: TextElement): number {
  const probe = document.createElement('div');
  probe.className = 'cue-slide cue-measure';
  probe.style.boxSizing = 'border-box';
  probe.style.width = `${String(element.width)}px`;
  probe.style.padding = `${String(element.padding)}px`;
  probe.style.borderStyle = 'solid';
  probe.style.borderWidth = `${String(element.border.width)}px`;
  const body = createTextBody();
  renderText(body, element.doc);
  probe.append(body);
  const place = probeHolder();
  place.append(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return Math.ceil(height);
}
