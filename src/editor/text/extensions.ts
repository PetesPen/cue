import { Extension, Mark, mergeAttributes, type Extensions } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Fragment, Slice, type Mark as PMMark, type Schema } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { ALIGNS, DEFAULT_TEXT_STYLE, MAX_INDENT, fontCapabilities, isBundledFont } from '@/model';
import { INDENT_STEP } from '@/render';

/**
 * What the text editor knows how to hold. It is the same small set the model keeps (see
 * `sanitiseRichText`): paragraphs, bullet and numbered lists, bold, italic, underline, strikethrough,
 * and one `textStyle` mark for font, size and colour. Nothing else can get in, so nothing else can be
 * typed, pasted or saved.
 */

const NUMBER = /^-?\d+(\.\d+)?$/;

function numberFrom(value: string | undefined): number | null {
  return value !== undefined && NUMBER.test(value) ? Number(value) : null;
}

/** The first family named in a CSS font-family list, without quotes. */
function firstFamily(list: string): string {
  const [first = ''] = list.split(',');
  return first.trim().replace(/^["']|["']$/g, '');
}

/**
 * Font, size and colour of a run of text. They are written twice: as CSS (what the browser draws) and
 * as `data-cue-*` attributes (what Cue reads back). A copy made inside Cue therefore keeps its style
 * when pasted, while text from anywhere else keeps only a font we bundle: its sizes and colours are
 * those of another page, and would clash with the slide.
 */
export const TextStyle = Mark.create({
  name: 'textStyle',

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const own = element.dataset.cueFont;
          if (own) return own;
          const family = firstFamily(element.style.fontFamily);
          return isBundledFont(family) ? family : null;
        },
        renderHTML: (attributes: { fontFamily?: string | null }) =>
          attributes.fontFamily
            ? {
                style: `font-family: "${attributes.fontFamily}"`,
                'data-cue-font': attributes.fontFamily,
              }
            : {},
      },
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => numberFrom(element.dataset.cueSize),
        renderHTML: (attributes: { fontSize?: number | null }) =>
          attributes.fontSize
            ? {
                style: `font-size: ${String(attributes.fontSize)}px`,
                'data-cue-size': String(attributes.fontSize),
              }
            : {},
      },
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.dataset.cueColor ?? null,
        renderHTML: (attributes: { color?: string | null }) =>
          attributes.color
            ? { style: `color: ${attributes.color}`, 'data-cue-color': attributes.color }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        // A span with nothing we keep is not a style at all, so it adds no mark.
        getAttrs: (node: HTMLElement | string) => {
          if (typeof node === 'string') return false;
          const family = firstFamily(node.style.fontFamily);
          const keeps =
            node.dataset.cueFont !== undefined ||
            node.dataset.cueSize !== undefined ||
            node.dataset.cueColor !== undefined ||
            isBundledFont(family);
          return keeps ? null : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

/** Paragraph options the model keeps: alignment, line spacing and indent. */
export const ParagraphOptions = Extension.create({
  name: 'paragraphOptions',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          align: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const value = element.style.textAlign;
              return ALIGNS.find((a) => a === value) ?? null;
            },
            renderHTML: (attributes: { align?: string | null }) =>
              attributes.align ? { style: `text-align: ${attributes.align}` } : {},
          },
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => numberFrom(element.dataset.cueLineHeight),
            renderHTML: (attributes: { lineHeight?: number | null }) =>
              attributes.lineHeight
                ? {
                    style: `line-height: ${String(attributes.lineHeight)}`,
                    'data-cue-line-height': String(attributes.lineHeight),
                  }
                : {},
          },
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => numberFrom(element.dataset.cueIndent) ?? 0,
            renderHTML: (attributes: { indent?: number | null }) =>
              attributes.indent
                ? {
                    style: `margin-left: ${String(attributes.indent * INDENT_STEP)}px`,
                    'data-cue-indent': String(attributes.indent),
                  }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      /** Indent paragraphs outside lists by `delta` levels (negative to go back). */
      changeIndent:
        (delta: number) =>
        ({ state, tr, dispatch }) => {
          const updates: { pos: number; attrs: Record<string, unknown> }[] = [];
          const { from, to } = state.selection;
          state.doc.nodesBetween(from, to, (node, pos, parent) => {
            if (node.type.name !== 'paragraph' || parent?.type.name === 'listItem') return;
            const now: unknown = node.attrs.indent;
            const before = typeof now === 'number' ? now : 0;
            const next = Math.min(MAX_INDENT, Math.max(0, before + delta));
            if (next !== before) updates.push({ pos, attrs: { ...node.attrs, indent: next } });
          });
          if (updates.length === 0) return false;
          if (dispatch)
            for (const { pos, attrs } of updates) tr.setNodeMarkup(pos, undefined, attrs);
          return true;
        },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphOptions: {
      changeIndent: (delta: number) => ReturnType;
    };
  }
}

const GUARD = new PluginKey('cueFontGuard');

function familyOf(marks: readonly PMMark[]): string {
  const style = marks.find((m) => m.type.name === 'textStyle');
  const family: unknown = style?.attrs.fontFamily;
  return typeof family === 'string' && family !== '' ? family : DEFAULT_TEXT_STYLE.fontFamily;
}

/** The marks without bold or italic where the font has no such design (decision 20). */
function allowed(marks: readonly PMMark[]): readonly PMMark[] {
  const capabilities = fontCapabilities(familyOf(marks));
  return marks.filter(
    (mark) =>
      !(mark.type.name === 'bold' && !capabilities.bold) &&
      !(mark.type.name === 'italic' && !capabilities.italic),
  );
}

/**
 * Text never keeps a style its font does not have (decision 20). Whatever puts bold or italic next to
 * such a font (a shortcut, a pasted run, a change of font) has the style taken off again at once, so
 * the editor never shows the browser's own fake slant or thickening.
 */
export const FontGuard = Extension.create({
  name: 'cueFontGuard',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: GUARD,
        appendTransaction: (transactions, _before, state) => {
          const touched =
            transactions.some((tr) => tr.docChanged) ||
            transactions.some((tr) => tr.storedMarksSet);
          if (!touched) return null;
          const tr = state.tr;
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            const keep = allowed(node.marks);
            if (keep.length === node.marks.length) return;
            for (const mark of node.marks) {
              if (!keep.includes(mark)) tr.removeMark(pos, pos + node.nodeSize, mark);
            }
          });
          const stored = state.storedMarks;
          if (stored && allowed(stored).length !== stored.length) {
            tr.setStoredMarks([...allowed(stored)]);
          }
          return tr.docChanged || tr.storedMarksSet ? tr : null;
        },
      }),
    ];
  },
});

const BLURRED = new PluginKey<boolean>('cueBlurredSelection');

/**
 * The words selected stay marked while focus is in the toolbar or the panel (a size being typed, a
 * colour being picked), so it is always clear what the change will apply to.
 */
export const BlurredSelection = Extension.create({
  name: 'cueBlurredSelection',

  addProseMirrorPlugins() {
    return [
      new Plugin<boolean>({
        key: BLURRED,
        state: {
          init: () => false,
          apply: (tr, blurred) => {
            const meta: unknown = tr.getMeta(BLURRED);
            return typeof meta === 'boolean' ? meta : blurred;
          },
        },
        props: {
          decorations: (state) => {
            const { from, to, empty } = state.selection;
            if (empty || BLURRED.getState(state) !== true) return null;
            return DecorationSet.create(state.doc, [
              Decoration.inline(from, to, { class: 'cue-selection' }),
            ]);
          },
          handleDOMEvents: {
            blur: (view) => {
              if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(BLURRED, true));
              return false;
            },
            focus: (view) => {
              if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(BLURRED, false));
              return false;
            },
          },
        },
      }),
    ];
  },
});

/**
 * Plain text pasted into the editor: one paragraph per line, blank lines kept, joined onto the
 * paragraph the cursor is in at both ends (the browser's own parser drops blank lines).
 */
export function plainTextSlice(text: string, schema: Schema): Slice {
  const paragraph = schema.nodes.paragraph;
  if (!paragraph) return Slice.empty;
  const lines = text.split(/\r\n|\r|\n/);
  return new Slice(
    Fragment.from(
      lines.map((line) => paragraph.create(null, line === '' ? undefined : schema.text(line))),
    ),
    1,
    1,
  );
}

/** The extension set for the text editor. */
export function textExtensions(): Extensions {
  return [
    StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      dropcursor: false,
      gapcursor: false,
      heading: false,
      horizontalRule: false,
      link: false,
      trailingNode: false,
      // One history for the whole deck (decision 18): Ctrl+Z is the app's, not the editor's own.
      undoRedo: false,
    }),
    TextStyle,
    ParagraphOptions,
    FontGuard,
    BlurredSelection,
  ];
}
