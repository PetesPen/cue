import type { JSONContent } from '@tiptap/core';
import type { Block, Inline, RichText } from '@/model';

/**
 * The model's text in the form the editor loads. The shapes are the same by design (the model keeps
 * what TipTap produces), but the editor wants arrays it may change, so this copies them.
 */

function inline(run: Inline): JSONContent {
  if (run.type === 'hardBreak') return { type: 'hardBreak' };
  return {
    type: 'text',
    text: run.text,
    ...(run.marks
      ? {
          marks: run.marks.map((mark) =>
            mark.type === 'textStyle'
              ? { type: 'textStyle', attrs: { ...mark.attrs } }
              : { type: mark.type },
          ),
        }
      : {}),
  };
}

function block(node: Block): JSONContent {
  if (node.type === 'paragraph') {
    return {
      type: 'paragraph',
      ...(node.attrs ? { attrs: { ...node.attrs } } : {}),
      ...(node.content ? { content: node.content.map(inline) } : {}),
    };
  }
  return {
    type: node.type,
    ...(node.attrs ? { attrs: { ...node.attrs } } : {}),
    content: node.content.map((item) => ({ type: 'listItem', content: item.content.map(block) })),
  };
}

export function toEditorContent(doc: RichText): JSONContent {
  return { type: 'doc', content: doc.content.map(block) };
}
