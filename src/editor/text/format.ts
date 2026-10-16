import {
  indentText,
  isTextBox,
  restyleText,
  setListKind,
  summariseText,
  type ElementChange,
  type ListKind,
  type RichText,
  type SlideElement,
  type StyleChange,
  type TextSummary,
} from '@/model';

/**
 * What the toolbar and the Design panel talk to when they change text: what the text looks like now,
 * and ways to change it. While words are being edited it is the editor's selection (`words`); with a
 * box selected, and not being edited, it is all the text in the selected boxes (`box`).
 */
export interface TextFormat {
  readonly scope: 'words' | 'box';
  readonly summary: TextSummary;
  readonly apply: (change: StyleChange) => void;
  readonly setList: (kind: ListKind) => void;
  readonly indent: (delta: number) => void;
}

/** The text a box holds: a text box's text, or the text inside a shape (if it has any). */
export function textOf(element: SlideElement): RichText | undefined {
  return isTextBox(element) ? element.doc : element.text;
}

/**
 * The format of the text in whole boxes, or nothing if none of them has text. `commit` saves a change
 * to the boxes: one command for the whole change (the caller fits text box heights to the new text).
 */
export function boxFormat(
  elements: readonly SlideElement[],
  commit: (changes: readonly ElementChange[]) => void,
): TextFormat | undefined {
  const withText = elements.flatMap((element) => {
    const doc = textOf(element);
    return doc ? [{ element, doc }] : [];
  });
  if (withText.length === 0) return undefined;

  const all: RichText = { type: 'doc', content: withText.flatMap(({ doc }) => doc.content) };
  const change = (transform: (doc: RichText) => RichText) => {
    commit(
      withText.map(({ element, doc }) => {
        const next = transform(doc);
        return { id: element.id, props: isTextBox(element) ? { doc: next } : { text: next } };
      }),
    );
  };

  return {
    scope: 'box',
    summary: summariseText(all),
    apply: (style) => {
      change((doc) => restyleText(doc, style));
    },
    setList: (kind) => {
      change((doc) => setListKind(doc, kind));
    },
    indent: (delta) => {
      change((doc) => indentText(doc, delta));
    },
  };
}
