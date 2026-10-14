// SP-2 spike code: throwaway. Does rich text lay out the same in the TipTap editor and in a static
// renderer? Renders the same documents five ways and measures every character's position.
import { Editor, type AnyExtension, type JSONContent } from '@tiptap/core';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import '../../src/fonts/fonts.css';
import './style.css';

type Mark = { type: string; attrs?: Record<string, string> };
type Line = { text: string; left: number; right: number; top: number; bottom: number };
type Measure = { key: string; lines: Line[]; width: number; height: number };

// Italic exists only for these families; bold only where the family has a weight axis (decision 7).
const FAMILIES = [
  { name: 'Instrument Sans', italic: true, bold: true },
  { name: 'Figtree', italic: true, bold: true },
  { name: 'Bricolage Grotesque', italic: false, bold: true },
  { name: 'DM Serif Display', italic: true, bold: false },
  { name: 'Space Grotesk', italic: false, bold: true },
  { name: 'JetBrains Mono', italic: true, bold: true },
  { name: 'Caveat', italic: false, bold: true },
];
const SIZES = [28, 32, 36, 44, 56, 72];
const COLOURS = ['#14281B', 'rgba(23, 128, 63, 0.6)', 'rgba(20, 40, 27, 0.35)', '#B3261E', 'rgba(245, 197, 66, 0.85)'];
// Words chosen to stress shaping: ligature pairs (fi fl ffi), kerning pairs (AV To Wa), digits, long words.
const WORDS = (
  'official flower office waffle AVA Tomato Wave Typography 2026 Q4 roadmap of listening first shipping in small ' +
  'steps measuring what matters extraordinarily internationalisation pneumonoultramicroscopic a to the and we ' +
  'launch autumn fifty-five well-known stakeholders Wrap Yellow Affinity fjord'
).split(' ');
const WIDTHS = [560, 733, 860, 1204];

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

function run(random: () => number, text: string, marks: Mark[]): JSONContent {
  return { type: 'text', text, marks: marks.length ? marks : undefined };
}

function randomRun(random: () => number, withStyle = true): JSONContent {
  const family = FAMILIES[Math.floor(random() * FAMILIES.length)]!;
  const words = Array.from({ length: 1 + Math.floor(random() * 6) }, () => WORDS[Math.floor(random() * WORDS.length)]);
  const marks: Mark[] = [];
  if (withStyle) {
    marks.push({
      type: 'textStyle',
      attrs: {
        fontFamily: family.name,
        fontSize: `${SIZES[Math.floor(random() * SIZES.length)]}px`,
        color: COLOURS[Math.floor(random() * COLOURS.length)]!,
      },
    });
  }
  if (family.bold && random() < 0.25) marks.push({ type: 'bold' });
  if (family.italic && random() < 0.25) marks.push({ type: 'italic' });
  return run(random, `${words.join(' ')} `, marks);
}

function makeDocs(count: number): { name: string; doc: JSONContent }[] {
  const docs: { name: string; doc: JSONContent }[] = [];
  // 1. A hand-made slide-like text with every feature in a few paragraphs.
  docs.push({
    name: 'hero',
    doc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Our ', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Bricolage Grotesque', fontSize: '72px', color: '#14281B' } }, { type: 'bold' }] },
            { type: 'text', text: 'approach', marks: [{ type: 'textStyle', attrs: { fontFamily: 'DM Serif Display', fontSize: '72px', color: 'rgba(23, 128, 63, 0.6)' } }, { type: 'italic' }] },
            { type: 'text', text: ' to the official autumn launch: listen first, ship in small steps, and measure what matters to every stakeholder in the room.', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Instrument Sans', fontSize: '36px', color: 'rgba(20, 40, 27, 0.35)' } }] },
          ],
        },
        {
          type: 'bulletList',
          content: ['Listen first', 'Ship in small steps', 'Measure what matters, officially and in office'].map((text) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'textStyle', attrs: { fontFamily: 'Figtree', fontSize: '44px', color: '#14281B' } }] }] }],
          })),
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Soft return next', marks: [{ type: 'textStyle', attrs: { fontFamily: 'JetBrains Mono', fontSize: '28px', color: '#B3261E' } }] },
            { type: 'hardBreak' },
            { type: 'text', text: 'line with Caveat handwriting at fifty-six pixels, waffle flower fjord.', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Caveat', fontSize: '56px', color: 'rgba(245, 197, 66, 0.85)' } }] },
          ],
        },
      ],
    },
  });
  // 2. Random documents: paragraphs of mixed runs, some lists, some soft returns.
  for (let d = 1; d < count; d += 1) {
    const random = prng(1000 + d);
    const blocks: JSONContent[] = [];
    const blockCount = 2 + Math.floor(random() * 3);
    for (let b = 0; b < blockCount; b += 1) {
      const inline: JSONContent[] = [];
      const runs = 3 + Math.floor(random() * 6);
      for (let r = 0; r < runs; r += 1) {
        inline.push(randomRun(random));
        if (random() < 0.08) inline.push({ type: 'hardBreak' });
      }
      const asList = random() < 0.25;
      blocks.push(
        asList
          ? { type: random() < 0.5 ? 'bulletList' : 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: inline }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [randomRun(random)] }] }] }
          : { type: 'paragraph', content: inline },
      );
    }
    docs.push({ name: `random-${d}`, doc: { type: 'doc', content: blocks } });
  }
  return docs;
}

const extensions: AnyExtension[] = [
  StarterKit.configure({
    blockquote: false, code: false, codeBlock: false, dropcursor: false, gapcursor: false, heading: false,
    horizontalRule: false, link: false, strike: false, underline: false, trailingNode: false, undoRedo: false, listKeymap: false,
  }),
  TextStyleKit,
];

// ---- the static renderer: our own small function from the stored JSON to DOM -----------------
function renderInline(node: JSONContent): Node {
  if (node.type === 'hardBreak') return document.createElement('br');
  let out: Node = document.createTextNode(node.text ?? '');
  for (const mark of (node.marks ?? []) as Mark[]) {
    let wrapper: HTMLElement;
    if (mark.type === 'bold') wrapper = document.createElement('strong');
    else if (mark.type === 'italic') wrapper = document.createElement('em');
    else {
      wrapper = document.createElement('span');
      const a = mark.attrs ?? {};
      if (a['fontFamily']) wrapper.style.fontFamily = a['fontFamily'];
      if (a['fontSize']) wrapper.style.fontSize = a['fontSize'];
      if (a['color']) wrapper.style.color = a['color'];
    }
    wrapper.appendChild(out);
    out = wrapper;
  }
  return out;
}
function renderBlock(node: JSONContent): Node {
  const tag = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li' }[node.type ?? ''] ?? 'div';
  const el = document.createElement(tag);
  for (const child of node.content ?? []) {
    el.appendChild(child.type === 'text' || child.type === 'hardBreak' ? renderInline(child) : renderBlock(child));
  }
  if (tag === 'p' && (node.content ?? []).length === 0) el.appendChild(document.createElement('br'));
  // ProseMirror adds a second break after a final soft return so the empty last line is visible.
  if (tag === 'p' && (node.content ?? []).at(-1)?.type === 'hardBreak') el.appendChild(document.createElement('br'));
  return el;
}
function renderStatic(doc: JSONContent, into: HTMLElement) {
  for (const child of doc.content ?? []) into.appendChild(renderBlock(child));
}

// ---- measuring: every character's box, grouped into lines ---------------------------------------
function measure(root: HTMLElement, scale: number, key: string): Measure {
  const base = root.getBoundingClientRect();
  const range = document.createRange();
  const lines: Line[] = [];
  let current: Line | null = null;
  let previousLeft = -Infinity;
  let previousBlock: Element | null = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const block = text.parentElement?.closest('p, li') ?? null;
    for (let i = 0; i < text.length; i += 1) {
      range.setStart(text, i);
      range.setEnd(text, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect) continue; // collapsed whitespace has no box
      const left = (rect.left - base.left) / scale;
      const right = (rect.right - base.left) / scale;
      const top = (rect.top - base.top) / scale;
      const bottom = (rect.bottom - base.top) / scale;
      if (!current || block !== previousBlock || left < previousLeft - 0.5) {
        current = { text: '', left, right, top, bottom };
        lines.push(current);
      }
      current.text += text.data[i];
      current.left = Math.min(current.left, left);
      current.right = Math.max(current.right, right);
      current.top = Math.min(current.top, top);
      current.bottom = Math.max(current.bottom, bottom);
      previousLeft = left;
      previousBlock = block;
    }
  }
  for (const line of lines) line.text = line.text.trim();
  return { key, lines: lines.filter((l) => l.text.length > 0), width: base.width / scale, height: base.height / scale };
}

// ---- the five renderings ----------------------------------------------------------------------
type Variant = 'editor' | 'editorReadOnly' | 'staticMatched' | 'staticNaive' | 'generateHtml';
const VARIANTS: Variant[] = ['editor', 'editorReadOnly', 'staticMatched', 'staticNaive', 'generateHtml'];

function renderVariant(variant: Variant, doc: JSONContent, box: HTMLElement): () => void {
  if (variant === 'editor' || variant === 'editorReadOnly') {
    const editor = new Editor({ element: box, extensions, content: doc, editable: variant === 'editor' });
    return () => editor.destroy();
  }
  const holder = document.createElement('div');
  holder.className = variant === 'staticNaive' ? 'static-naive' : 'static-matched';
  if (variant === 'generateHtml') holder.innerHTML = generateHTML(doc, extensions);
  else renderStatic(doc, holder);
  box.appendChild(holder);
  return () => undefined;
}

async function loadFonts(docs: { doc: JSONContent }[]) {
  const wanted = new Set<string>();
  const walk = (node: JSONContent) => {
    const marks = (node.marks ?? []) as Mark[];
    const style = marks.find((m) => m.type === 'textStyle')?.attrs;
    if (style?.['fontFamily']) {
      const bold = marks.some((m) => m.type === 'bold') ? 700 : 400;
      const italic = marks.some((m) => m.type === 'italic') ? 'italic' : 'normal';
      wanted.add(`${italic} ${bold} 20px "${style['fontFamily']}"`);
    }
    node.content?.forEach(walk);
  };
  docs.forEach(({ doc }) => walk(doc));
  FAMILIES.forEach((f) => wanted.add(`normal 400 20px "${f.name}"`));
  await Promise.all([...wanted].map((font) => document.fonts.load(font, 'Aa fi')));
  await document.fonts.ready;
  return [...wanted].length;
}

async function runAll(options: { scale: number; docCount: number; widths?: number[]; variants?: Variant[] }) {
  const docs = makeDocs(options.docCount);
  const fontsRequested = await loadFonts(docs);
  const stage = document.getElementById('stage')!;
  const slide = document.createElement('div');
  slide.className = 'slide';
  slide.style.transform = `scale(${options.scale})`;
  stage.replaceChildren(slide);

  const result: Record<string, Measure[]> = {};
  let editorStyle: Record<string, string> | null = null;
  const started = performance.now();
  for (const variant of options.variants ?? VARIANTS) {
    result[variant] = [];
    for (const { name, doc } of docs) {
      for (const width of options.widths ?? WIDTHS) {
        const box = document.createElement('div');
        box.className = 'text-box';
        box.style.width = `${width}px`;
        slide.replaceChildren(box);
        const cleanup = renderVariant(variant, doc, box);
        if (variant === 'editor' && !editorStyle) {
          const pm = box.querySelector('.ProseMirror');
          if (pm) {
            const s = getComputedStyle(pm);
            editorStyle = {
              whiteSpace: s.whiteSpace,
              overflowWrap: s.overflowWrap,
              wordWrap: s.getPropertyValue('word-wrap'),
              fontVariantLigatures: s.fontVariantLigatures,
              fontFeatureSettings: s.fontFeatureSettings,
            };
          }
        }
        result[variant]!.push(measure(box, options.scale, `${name}@${width}`));
        cleanup();
      }
    }
  }
  const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.style} ${f.weight}`);
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').find((t) => t.includes('.ProseMirror')) ?? '';
  return { variants: result, ms: Math.round(performance.now() - started), fontsRequested, fontFacesLoaded: loaded.length, proseMirrorCss: JSON.stringify(editorStyle ?? {}) + (css ? ' // injected: ' + css.slice(0, 300) : ''), dpr: devicePixelRatio, docs: docs.length };
}

(window as unknown as Record<string, unknown>)['__sp2'] = { runAll };
document.title = 'SP-2 ready';
