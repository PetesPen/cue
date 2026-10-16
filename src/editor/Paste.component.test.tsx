import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  emptyText,
  plainText,
  sanitiseRichText,
  textRuns,
  type RichText,
  type TextMark,
} from '@/model';
import type { DeckStore } from '@/storage';
import { createTestStore } from './test-helpers';
import {
  edit,
  editor,
  openWith,
  resetEditorTest,
  selectAll,
  storedText,
  textBox,
} from './text-test-helpers';

afterEach(resetEditorTest);

// EL-1: pasting from other programs keeps bold, italic, underline, strikethrough and lists, and drops
// everything else. The HTML below is what those programs really put on the clipboard (shortened).

const WORD = `<html><body><!--StartFragment--><p class=MsoNormal><b><span style='font-size:14.0pt;font-family:"Calibri",sans-serif;color:red'>Bold red</span></b><span style='font-family:"Times New Roman",serif'> and <i>italic</i> text</span></p><!--EndFragment--></body></html>`;

const GOOGLE_DOCS = `<meta charset='utf-8'><meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1f2e3d"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-family:Arial,sans-serif;color:#000000;font-weight:700;">Heading</span></p><ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;"><li dir="ltr" style="list-style-type:disc;"><p dir="ltr" role="presentation"><span style="font-size:11pt;font-family:Arial,sans-serif;font-weight:400;">One</span></p></li><li dir="ltr" style="list-style-type:disc;"><p dir="ltr" role="presentation"><span style="font-size:11pt;font-family:Arial,sans-serif;font-weight:400;">Two</span></p></li></ul></b>`;

const WEB_PAGE = `<h2 class="title" style="color:#c00;font-size:32px">A title</h2><p>Some <a href="https://example.test/page" style="color:blue">linked</a> words, <u>underlined</u>, <s>struck</s> and <code>coded</code>.</p><img src="https://example.test/x.png" alt="picture"><script>window.pasted = true</script><style>p { color: red }</style><table><tr><td>cell</td></tr></table>`;

const NUMBERED = `<ol><li>First</li><li>Second<ol><li>Nested</li></ol></li></ol>`;

/** Paste this HTML (and its plain text) into the editor, as the browser does for Ctrl+V. */
async function paste(html: string | undefined, text = '') {
  const data = new DataTransfer();
  if (html !== undefined) data.setData('text/html', html);
  data.setData('text/plain', text);
  editor()?.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/** End editing, wait for the deck to hold something other than `before`, and read the saved text. */
async function finishAndRead(store: DeckStore, before: string): Promise<RichText> {
  await userEvent.keyboard('{Escape}');
  await expect.poll(editor).toBeNull();
  await expect
    .poll(async () => plainText((await storedText(store)) ?? emptyText()))
    .not.toBe(before);
  return (await storedText(store)) ?? emptyText();
}

/** A box saying "Start: " with the cursor after it; paste this; return what the deck then holds. */
async function pasteInto(html: string | undefined, text = '', onNewLine = false) {
  const store = createTestStore();
  await openWith(store, textBox('t', 'Start: '));
  await edit('t');
  await userEvent.keyboard(onNewLine ? '{End}{Enter}' : '{End}');
  await paste(html, text);
  return finishAndRead(store, 'Start: ');
}

const marks = (doc: RichText): [string, string[]][] =>
  textRuns(doc).map((run) => [
    run.text,
    (run.marks ?? []).map((m: TextMark) =>
      m.type === 'textStyle' ? `textStyle:${JSON.stringify(m.attrs)}` : m.type,
    ),
  ]);

test('Given text copied from Word, When it is pasted, Then bold and italic survive and its fonts, sizes and colours do not', async () => {
  const doc = await pasteInto(WORD);

  expect(plainText(doc)).toBe('Start: Bold red and italic text');
  expect(marks(doc)).toEqual([
    ['Start: ', []],
    ['Bold red', ['bold']],
    [' and ', []],
    ['italic', ['italic']],
    [' text', []],
  ]);
});

test('Given text copied from Google Docs, When it is pasted, Then the bold word and the bullet list survive', async () => {
  const doc = await pasteInto(GOOGLE_DOCS);

  const bold = textRuns(doc).filter((run) => run.marks?.some((m) => m.type === 'bold'));
  expect(bold.map((run) => run.text)).toEqual(['Heading']);
  const list = doc.content.find((block) => block.type === 'bulletList');
  expect(list?.type === 'bulletList' && list.content.length).toBe(2);
  expect(plainText(doc)).toContain('One');
  expect(plainText(doc)).toContain('Two');
  // Nothing of Google's own styling is kept: no Arial, no 11 pt, no black.
  expect(JSON.stringify(doc)).not.toMatch(/Arial|fontSize|#000000/);
});

test('Given a web page, When it is pasted, Then underline and strikethrough survive, and links, images, scripts, tables and styles are dropped', async () => {
  const doc = await pasteInto(WEB_PAGE);

  const text = plainText(doc);
  expect(text).toContain('A title');
  expect(text).toContain('Some linked words, underlined, struck and coded.');
  expect(text).toContain('cell');
  expect(text).not.toContain('pasted');
  expect(text).not.toContain('color: red');
  const names = Object.fromEntries(
    textRuns(doc).map((run) => [run.text, (run.marks ?? []).map((m) => m.type)]),
  );
  expect(names.underlined).toEqual(['underline']);
  expect(names.struck).toEqual(['strike']);
  expect(names.linked).toBeUndefined();
  expect(JSON.stringify(doc)).not.toMatch(/href|https|img|script|color|fontSize/);
  // The script on the page did not run.
  expect(Reflect.get(window, 'pasted')).toBeUndefined();
});

test('Given a numbered list with a nested list, When it is pasted, Then it is a numbered list with the nesting kept', async () => {
  const doc = await pasteInto(NUMBERED, '', true);

  const list = doc.content.find((block) => block.type === 'orderedList');
  expect(list?.type === 'orderedList' && list.content.length).toBe(2);
  expect(JSON.stringify(doc)).toContain('Nested');
  expect(plainText(doc)).toContain('First');
});

test('Given plain text with line breaks, When it is pasted, Then each line is a paragraph', async () => {
  const doc = await pasteInto(undefined, 'Line one\nLine two\n\nLine four');

  expect(plainText(doc)).toBe('Start: Line one\nLine two\n\nLine four');
  expect(doc.content.length).toBe(4);
});

test('Given a font the app bundles, When text in it is pasted, Then the font is kept', async () => {
  const doc = await pasteInto(
    '<span style="font-family: Figtree, sans-serif">Figtree words</span>',
  );

  expect(marks(doc).at(-1)).toEqual(['Figtree words', ['textStyle:{"fontFamily":"Figtree"}']]);
});

test('Given text copied inside Cue with its own size and colour, When it is pasted, Then it keeps them', async () => {
  const doc = await pasteInto(
    '<span data-cue-size="90" data-cue-color="#E4572E" style="font-size:90px;color:#E4572E">Big</span>',
  );

  expect(marks(doc).at(-1)).toEqual(['Big', ['textStyle:{"fontSize":90,"color":"#E4572E"}']]);
});

test('Given a paste of words over a selection, When it is pasted, Then it replaces what was selected', async () => {
  const store = createTestStore();
  await openWith(store, textBox('t', 'Old words'));
  await edit('t');
  await selectAll();

  await paste('<b>New</b>');

  expect(plainText(await finishAndRead(store, 'Old words'))).toBe('New');
});

test('Given anything that was pasted, When the text is saved, Then it is exactly what the model keeps: the saved text passes the gate unchanged', async () => {
  const doc = await pasteInto(WORD + WEB_PAGE);

  expect(sanitiseRichText(doc)).toEqual(doc);
});
