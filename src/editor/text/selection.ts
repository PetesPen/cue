import type { EditorState } from '@tiptap/pm/state';
import type { Mark as PMMark, Node as PMNode } from '@tiptap/pm/model';
import {
  MIXED,
  sanitiseRichText,
  summariseStyle,
  type ListKind,
  type Mixed,
  type RichText,
  type TextSummary,
} from '@/model';

const marksJSON = (marks: readonly PMMark[]): unknown[] => marks.map((m): unknown => m.toJSON());

function paragraphJSON(node: PMNode, runs: unknown[]): unknown {
  return { type: 'paragraph', attrs: node.attrs, content: runs };
}

function listOf(state: EditorState, pos: number): ListKind {
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const name = $pos.node(depth).type.name;
    if (name === 'bulletList' || name === 'orderedList') return name;
  }
  return 'none';
}

/**
 * Describe the selection in the model's own terms: the text it covers (or, for a cursor, the style
 * the next typed character would get) goes through `summariseStyle`, so the editor and the whole-box
 * panel read styles the same way, including "mixed".
 */
export function selectionFormat(state: EditorState): TextSummary {
  const { from, to, empty } = state.selection;
  const paragraphs: unknown[] = [];
  const lists = new Set<ListKind>();
  const indents = new Set<number>();

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    const runs: unknown[] = [];
    if (empty) {
      const marks = state.storedMarks ?? state.selection.$from.marks();
      runs.push({ type: 'text', text: 'x', marks: marksJSON(marks) });
    } else {
      node.forEach((child, offset) => {
        const start = pos + 1 + offset;
        if (child.isText && start < to && start + child.nodeSize > from) {
          runs.push({ type: 'text', text: 'x', marks: marksJSON(child.marks) });
        }
      });
    }
    paragraphs.push(paragraphJSON(node, runs));
    const list = listOf(state, pos);
    lists.add(list);
    if (list === 'none') {
      const indent: unknown = node.attrs.indent;
      indents.add(typeof indent === 'number' ? indent : 0);
    }
    return false;
  });

  const doc: RichText = sanitiseRichText({ type: 'doc', content: paragraphs });
  const only = (set: ReadonlySet<ListKind>): Mixed<ListKind> => {
    const [first] = set;
    return set.size === 1 && first !== undefined ? first : set.size === 0 ? 'none' : MIXED;
  };
  const [firstIndent] = indents;
  return {
    ...summariseStyle(doc),
    list: only(lists),
    indent:
      indents.size === 1 && firstIndent !== undefined
        ? firstIndent
        : indents.size === 0
          ? 0
          : MIXED,
  };
}
