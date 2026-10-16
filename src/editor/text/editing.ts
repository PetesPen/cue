import type { Editor } from '@tiptap/core';
import { ensureFonts } from '@/render';
import type { ListKind, RichText, StyleChange, TextSummary } from '@/model';
import type { TextFormat } from './format';

/** What the editor does for each change the toolbar or panel asks for, on the words selected. */

const FLAGS = ['bold', 'italic', 'underline', 'strike'] as const;

/** A tiny text in a font, enough to ask `ensureFonts` to load every face of that family. */
function sampleIn(fontFamily: string): RichText {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs: { fontFamily } }] },
        ],
      },
    ],
  };
}

function run(editor: Editor, change: StyleChange): void {
  const chain = editor.chain().focus();
  const style = {
    ...(change.fontFamily === undefined ? {} : { fontFamily: change.fontFamily }),
    ...(change.fontSize === undefined ? {} : { fontSize: change.fontSize }),
    ...(change.color === undefined ? {} : { color: change.color }),
  };
  if (Object.keys(style).length > 0) chain.setMark('textStyle', style);
  for (const flag of FLAGS) {
    const wanted = change[flag];
    if (wanted === true) chain.setMark(flag);
    else if (wanted === false) chain.unsetMark(flag);
  }
  const paragraph = {
    ...(change.align === undefined ? {} : { align: change.align }),
    ...(change.lineHeight === undefined ? {} : { lineHeight: change.lineHeight }),
  };
  if (Object.keys(paragraph).length > 0) chain.updateAttributes('paragraph', paragraph);
  chain.run();
}

/** Apply a style to the selected words. A new font is loaded first, so it is never drawn as a fallback. */
export function applyStyle(editor: Editor, change: StyleChange): void {
  if (change.fontFamily === undefined) {
    run(editor, change);
    return;
  }
  void ensureFonts(sampleIn(change.fontFamily)).then(() => {
    if (!editor.isDestroyed) run(editor, change);
  });
}

export function setList(editor: Editor, current: TextSummary['list'], kind: ListKind): void {
  const chain = editor.chain().focus();
  if (kind === 'none') {
    if (current === 'bulletList') chain.toggleBulletList().run();
    else if (current === 'orderedList') chain.toggleOrderedList().run();
    return;
  }
  // Choosing the kind it already is takes it off again, like the toolbar buttons of any editor.
  if (kind === 'bulletList') chain.toggleBulletList().run();
  else chain.toggleOrderedList().run();
}

/** Indent: deeper in a list, or the paragraph's own indent level outside one. */
export function indent(editor: Editor, delta: number): void {
  const inList = editor.isActive('listItem');
  const chain = editor.chain().focus();
  if (inList) {
    if (delta > 0) chain.sinkListItem('listItem').run();
    else chain.liftListItem('listItem').run();
  } else {
    chain.changeIndent(delta).run();
  }
}

/** The format of the words now selected in the editor. */
export function wordsFormat(editor: Editor, summary: TextSummary): TextFormat {
  return {
    scope: 'words',
    summary,
    apply: (change) => {
      applyStyle(editor, change);
    },
    // The words change as the colour is dragged; the deck gets them in the next burst.
    preview: (change) => {
      applyStyle(editor, change);
    },
    setList: (kind) => {
      setList(editor, summary.list, kind);
    },
    indent: (delta) => {
      indent(editor, delta);
    },
  };
}
