import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { FONTS, fontCapabilities, isBundledFont } from './fonts';
import {
  DEFAULT_TEXT_STYLE,
  InvalidTextError,
  MAX_INDENT,
  MIXED,
  emptyText,
  fontsUsed,
  indentText,
  isEmptyText,
  listKind,
  normaliseColour,
  plainText,
  restyleText,
  sanitiseRichText,
  setListKind,
  summariseStyle,
  summariseText,
  textFromString,
  textRuns,
  type Inline,
  type RichText,
  type TextMark,
} from './richtext';

const run = (text: string, marks?: TextMark[]): Inline =>
  marks ? { type: 'text', text, marks } : { type: 'text', text };
const doc = (...content: RichText['content'][number][]): RichText => ({ type: 'doc', content });
const para = (...content: Inline[]) => ({ type: 'paragraph' as const, content });
const style = (attrs: { fontFamily?: string; fontSize?: number; color?: string }): TextMark => ({
  type: 'textStyle',
  attrs,
});

describe('normaliseColour', () => {
  test.each([
    ['#17803f', '#17803F'],
    ['17803F', '#17803F'],
    ['#abc', '#AABBCC'],
    ['  #f5c542 ', '#F5C542'],
  ])('Given %j, When it is read as a colour, Then it is %s', (input, expected) => {
    expect(normaliseColour(input)).toBe(expected);
  });

  test.each(['', 'red', '#12', '#12345', 'rgb(0,0,0)', 5, null, undefined])(
    'Given %j, When it is read as a colour, Then it is not one',
    (input) => {
      expect(normaliseColour(input)).toBeUndefined();
    },
  );
});

describe('fonts (EL-2)', () => {
  test('Given the bundled fonts, When their styles are read, Then italic is missing exactly where decision 7 says and bold exactly where decision 11 says', () => {
    const noItalic = FONTS.filter((f) => !f.italic).map((f) => f.family);
    const noBold = FONTS.filter((f) => !f.bold).map((f) => f.family);

    expect(noItalic).toEqual(['Bricolage Grotesque', 'Space Grotesk', 'Caveat']);
    expect(noBold).toEqual(['DM Serif Display']);
    expect(FONTS).toHaveLength(7);
  });

  test('Given a font Cue does not know, When its styles are asked, Then it is assumed to have both', () => {
    expect(fontCapabilities('Comic Sans')).toEqual({ bold: true, italic: true });
    expect(isBundledFont('Comic Sans')).toBe(false);
    expect(isBundledFont('Figtree')).toBe(true);
  });
});

describe('sanitiseRichText (EL-1: the one gate for text)', () => {
  test('Given something that is not a text document, When it is sanitised, Then it throws', () => {
    for (const bad of [null, 'text', 5, [], {}, { type: 'paragraph' }, { type: 'doc' }]) {
      expect(() => sanitiseRichText(bad)).toThrow(InvalidTextError);
    }
  });

  test('Given a document with no blocks, When it is sanitised, Then it has one empty paragraph', () => {
    expect(sanitiseRichText({ type: 'doc', content: [] })).toEqual(emptyText());
    expect(sanitiseRichText({ type: 'doc', content: [{ type: 'heading' }] })).toEqual(emptyText());
  });

  test('Given unknown nodes, marks and attributes, When it is sanitised, Then they are dropped and the words stay', () => {
    const dirty = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'dropped' }] },
        {
          type: 'paragraph',
          attrs: { align: 'center', evil: 'yes', lineHeight: 'tall' },
          content: [
            {
              type: 'text',
              text: 'Hello',
              marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'x' } }],
            },
            { type: 'image' },
            { type: 'text', text: '' },
          ],
        },
      ],
    };

    expect(sanitiseRichText(dirty)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { align: 'center' },
          content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }] }],
        },
      ],
    });
  });

  test('Given colours in odd forms and sizes out of range, When it is sanitised, Then colours are #RRGGBB and bad sizes are dropped', () => {
    const result = sanitiseRichText(
      doc(
        para(
          run('a', [style({ color: 'f5c542', fontSize: 72 })]),
          run('b', [style({ color: 'blue', fontSize: -5 })]),
        ),
      ),
    );

    expect(textRuns(result).map((r) => r.marks)).toEqual([
      [style({ color: '#F5C542', fontSize: 72 })],
      undefined,
    ]);
  });

  test('Given neighbouring runs with equal marks, When it is sanitised, Then they are one run', () => {
    const result = sanitiseRichText(
      doc(para(run('Hel', [{ type: 'bold' }]), run('lo ', [{ type: 'bold' }]), run('world'))),
    );

    expect(textRuns(result).map((r) => r.text)).toEqual(['Hello ', 'world']);
  });

  test('Given marks in any order, When it is sanitised, Then they are always in one fixed order', () => {
    const marks: TextMark[] = [
      style({ color: '#000000' }),
      { type: 'strike' },
      { type: 'italic' },
      { type: 'bold' },
    ];
    const result = sanitiseRichText(doc(para(run('x', marks))));

    expect(textRuns(result)[0]?.marks?.map((m) => m.type)).toEqual([
      'bold',
      'italic',
      'strike',
      'textStyle',
    ]);
  });

  test.each([
    ['Caveat', 'italic'],
    ['Space Grotesk', 'italic'],
    ['Bricolage Grotesque', 'italic'],
    ['DM Serif Display', 'bold'],
  ] as const)(
    'Given %s text marked %s, When it is sanitised, Then that style is removed (decisions 7, 11 and 20)',
    (fontFamily, flag) => {
      const result = sanitiseRichText(
        doc(para(run('x', [{ type: flag }, { type: 'underline' }, style({ fontFamily })]))),
      );

      expect(textRuns(result)[0]?.marks?.map((m) => m.type)).toEqual(['underline', 'textStyle']);
    },
  );

  test('Given Figtree text marked bold and italic, When it is sanitised, Then both stay', () => {
    const result = sanitiseRichText(
      doc(para(run('x', [{ type: 'bold' }, { type: 'italic' }, style({ fontFamily: 'Figtree' })]))),
    );

    expect(textRuns(result)[0]?.marks?.map((m) => m.type)).toEqual(['bold', 'italic', 'textStyle']);
  });

  test('Given italic text with no font set, When it is sanitised, Then it stays (the default font has an italic)', () => {
    const result = sanitiseRichText(doc(para(run('x', [{ type: 'italic' }]))));

    expect(textRuns(result)[0]?.marks).toEqual([{ type: 'italic' }]);
  });

  test('Given a list item with no paragraph first, When it is sanitised, Then an empty paragraph leads', () => {
    const result = sanitiseRichText({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'orderedList', content: [{ type: 'listItem', content: [para(run('x'))] }] },
              ],
            },
          ],
        },
      ],
    });

    const list = result.content[0];
    expect(list?.type === 'bulletList' && list.content[0]?.content[0]).toEqual({
      type: 'paragraph',
    });
  });

  test('Given a list with no items, When it is sanitised, Then it is dropped', () => {
    expect(
      sanitiseRichText({ type: 'doc', content: [{ type: 'bulletList', content: [] }] }),
    ).toEqual(emptyText());
  });

  test('Given an ordered list that starts at 5, When it is sanitised, Then the start is kept; a start of 1 is not stored', () => {
    const item = { type: 'listItem', content: [para(run('x'))] };
    const five = sanitiseRichText({
      type: 'doc',
      content: [{ type: 'orderedList', attrs: { start: 5 }, content: [item] }],
    });
    const one = sanitiseRichText({
      type: 'doc',
      content: [{ type: 'orderedList', attrs: { start: 1 }, content: [item] }],
    });

    expect(five.content[0]).toMatchObject({ attrs: { start: 5 } });
    expect(one.content[0]).not.toHaveProperty('attrs');
  });

  test('Given paragraph options, When they are sanitised, Then alignment, line spacing and indent are kept inside their limits', () => {
    const result = sanitiseRichText(
      doc(
        { type: 'paragraph', attrs: { align: 'justify', lineHeight: 1.5, indent: 2 } },
        { type: 'paragraph', attrs: { align: 'left', lineHeight: 99, indent: 9 } },
      ),
    );

    expect(result.content[0]).toEqual({
      type: 'paragraph',
      attrs: { align: 'justify', lineHeight: 1.5, indent: 2 },
    });
    expect(result.content[1]).toEqual({ type: 'paragraph' });
  });

  // A generator of text documents, some of them untidy on purpose.
  const markArb: fc.Arbitrary<TextMark> = fc.oneof(
    fc.constantFrom<TextMark>(
      { type: 'bold' },
      { type: 'italic' },
      { type: 'underline' },
      { type: 'strike' },
    ),
    fc
      .record(
        {
          fontFamily: fc.constantFrom(...FONTS.map((f) => f.family), 'Papyrus'),
          fontSize: fc.integer({ min: 8, max: 300 }),
          color: fc.constantFrom('#14281B', 'f5c542', '#abc'),
        },
        { requiredKeys: [] },
      )
      .map((attrs): TextMark => ({ type: 'textStyle', attrs })),
  );
  const runArb: fc.Arbitrary<Inline> = fc.oneof(
    fc.record({
      type: fc.constant<'text'>('text'),
      text: fc.string({ minLength: 1, maxLength: 12 }),
      marks: fc.array(markArb, { maxLength: 4 }),
    }),
    fc.constant<Inline>({ type: 'hardBreak' }),
  );
  const paragraphArb = fc.record({
    type: fc.constant<'paragraph'>('paragraph'),
    content: fc.array(runArb, { maxLength: 5 }),
  });
  const docArb: fc.Arbitrary<RichText> = fc
    .array(
      fc.oneof(
        paragraphArb,
        fc.record({
          type: fc.constantFrom<'bulletList' | 'orderedList'>('bulletList', 'orderedList'),
          content: fc.array(
            fc.record({
              type: fc.constant<'listItem'>('listItem'),
              content: fc.array(paragraphArb, { minLength: 1, maxLength: 2 }),
            }),
            { minLength: 1, maxLength: 3 },
          ),
        }),
      ),
      { minLength: 1, maxLength: 4 },
    )
    .map((content) => ({ type: 'doc', content }));

  test('Given any text, When it is sanitised twice, Then the second changes nothing (one stored form)', () => {
    fc.assert(
      fc.property(docArb, (input) => {
        const once = sanitiseRichText(input);

        expect(sanitiseRichText(once)).toEqual(once);
      }),
    );
  });

  test('Given any text, When it goes through JSON and is sanitised, Then it is identical (save and load)', () => {
    fc.assert(
      fc.property(docArb, (input) => {
        const once = sanitiseRichText(input);

        expect(sanitiseRichText(JSON.parse(JSON.stringify(once)) as unknown)).toEqual(once);
      }),
    );
  });

  test('Given any text, When it is sanitised, Then no run keeps a style its font does not have, and no words are lost', () => {
    fc.assert(
      fc.property(docArb, (input) => {
        const clean = sanitiseRichText(input);

        for (const r of textRuns(clean)) {
          const family = r.marks?.flatMap((m) =>
            m.type === 'textStyle' ? [m.attrs.fontFamily] : [],
          )[0];
          const can = fontCapabilities(family ?? DEFAULT_TEXT_STYLE.fontFamily);
          const flags = r.marks?.map((m) => m.type) ?? [];
          if (!can.italic) expect(flags).not.toContain('italic');
          if (!can.bold) expect(flags).not.toContain('bold');
        }
        // Nothing was dropped but the empty runs: the text is the same text.
        expect(plainText(clean)).toBe(plainText(input));
      }),
    );
  });
});

describe('reading text', () => {
  const sample = doc(para(run('Our '), run('approach', [{ type: 'bold' }])), {
    type: 'bulletList',
    content: [
      { type: 'listItem', content: [para(run('Listen first'))] },
      { type: 'listItem', content: [para(run('Ship'), { type: 'hardBreak' }, run('small'))] },
    ],
  });

  test('Given paragraphs, a list and a soft return, When the plain text is read, Then each paragraph is a line and the soft return is a line break', () => {
    expect(plainText(sample)).toBe('Our approach\nListen first\nShip\nsmall');
  });

  test('Given a document of spaces, When it is checked, Then it is empty; with words it is not', () => {
    expect(isEmptyText(emptyText())).toBe(true);
    expect(isEmptyText(textFromString('   '))).toBe(true);
    expect(isEmptyText(sample)).toBe(false);
  });

  test('Given a string with two lines, When it is made into text, Then there are two paragraphs', () => {
    expect(textFromString('one\r\ntwo\n\nfour').content).toHaveLength(4);
    expect(plainText(textFromString('one\r\ntwo'))).toBe('one\ntwo');
  });

  test('Given text in two fonts and one unmarked run, When the fonts are listed, Then the default font is included', () => {
    const mixed = doc(
      para(
        run('a', [style({ fontFamily: 'Figtree' })]),
        run('b', [style({ fontFamily: 'Caveat' })]),
        run('c'),
      ),
    );

    expect(fontsUsed(mixed).sort()).toEqual(['Caveat', 'Figtree', 'Instrument Sans']);
    expect(fontsUsed(emptyText())).toEqual(['Instrument Sans']);
  });
});

describe('summariseStyle (what the toolbar and panel show)', () => {
  test('Given text with nothing set, When it is summarised, Then it shows the defaults and nothing is mixed', () => {
    expect(summariseStyle(textFromString('hello'))).toEqual({
      fontFamily: 'Instrument Sans',
      fontSize: 56,
      color: '#14281B',
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      align: 'left',
      lineHeight: 1.2,
      canBold: true,
      canItalic: true,
    });
  });

  test('Given two fonts, a bold word and two alignments, When it is summarised, Then those read Mixed and the rest do not', () => {
    const mixed = doc(
      {
        type: 'paragraph',
        attrs: { align: 'center' },
        content: [run('a', [{ type: 'bold' }, style({ fontFamily: 'Figtree' })])],
      },
      para(run('b', [style({ fontFamily: 'Caveat' })])),
    );

    const summary = summariseStyle(mixed);

    expect(summary).toMatchObject({
      fontFamily: MIXED,
      bold: MIXED,
      align: MIXED,
      italic: false,
      fontSize: 56,
    });
  });

  test('Given an empty box, When it is summarised, Then it shows the defaults', () => {
    expect(summariseStyle(emptyText()).fontFamily).toBe('Instrument Sans');
  });

  test.each([
    ['Caveat', true, false],
    ['Bricolage Grotesque', true, false],
    ['DM Serif Display', false, true],
    ['Figtree', true, true],
  ])(
    'Given text in %s, When it is summarised, Then bold is offered: %s, italic: %s',
    (fontFamily, canBold, canItalic) => {
      const summary = summariseStyle(doc(para(run('a', [style({ fontFamily })]))));

      expect(summary).toMatchObject({ canBold, canItalic });
    },
  );

  test('Given a selection mixing a font with italic and one without, When it is summarised, Then italic is not offered (decision 20)', () => {
    const mixed = doc(
      para(
        run('a', [style({ fontFamily: 'Figtree' })]),
        run('b', [style({ fontFamily: 'Caveat' })]),
      ),
    );

    expect(summariseStyle(mixed)).toMatchObject({ canBold: true, canItalic: false });
  });
});

describe('restyleText (the panel with a whole box selected)', () => {
  const start = doc(para(run('Our '), run('approach', [{ type: 'bold' }])));

  test('Given a box, When a font, size and colour are set, Then every run has them and the bold stays', () => {
    const result = restyleText(start, { fontFamily: 'Figtree', fontSize: 72, color: '#17803F' });

    const marks = textRuns(result).map((r) => r.marks?.map((m) => m.type));
    expect(marks).toEqual([['textStyle'], ['bold', 'textStyle']]);
    expect(summariseStyle(result)).toMatchObject({
      fontFamily: 'Figtree',
      fontSize: 72,
      color: '#17803F',
    });
  });

  test('Given bold text, When bold is turned off, Then no run is bold', () => {
    expect(summariseStyle(restyleText(start, { bold: false })).bold).toBe(false);
    expect(summariseStyle(restyleText(start, { bold: true })).bold).toBe(true);
  });

  test('Given italic text, When the font is changed to Caveat, Then the italic goes (decision 20)', () => {
    const italic = restyleText(start, { italic: true });
    expect(summariseStyle(italic).italic).toBe(true);

    expect(summariseStyle(restyleText(italic, { fontFamily: 'Caveat' })).italic).toBe(false);
  });

  test('Given a box, When alignment and line spacing are set, Then every paragraph has them', () => {
    const two = doc(para(run('a')), para(run('b')));

    const result = restyleText(two, { align: 'right', lineHeight: 1.5 });

    expect(summariseStyle(result)).toMatchObject({ align: 'right', lineHeight: 1.5 });
  });

  test('Given any text and any change, When it is applied twice, Then the second changes nothing', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FONTS.map((f) => f.family)),
        fc.integer({ min: 8, max: 200 }),
        fc.boolean(),
        fc.boolean(),
        (fontFamily, fontSize, bold, italic) => {
          const change = { fontFamily, fontSize, bold, italic };
          const once = restyleText(start, change);

          expect(restyleText(once, change)).toEqual(once);
        },
      ),
    );
  });
});

describe('lists', () => {
  const two = doc(para(run('a')), para(run('b')));

  test('Given two paragraphs, When they are made a bulleted list, Then there is one list of two items, and back', () => {
    const bullets = setListKind(two, 'bulletList');

    expect(bullets.content).toHaveLength(1);
    expect(listKind(bullets)).toBe('bulletList');
    expect(listKind(two)).toBe('none');
    expect(plainText(setListKind(bullets, 'none'))).toBe('a\nb');
    expect(listKind(setListKind(bullets, 'none'))).toBe('none');
  });

  test('Given a bulleted list, When it is made numbered, Then it is an ordered list with the same words', () => {
    const numbered = setListKind(setListKind(two, 'bulletList'), 'orderedList');

    expect(listKind(numbered)).toBe('orderedList');
    expect(plainText(numbered)).toBe('a\nb');
  });

  test('Given a list and a paragraph, When the kind is read, Then it is mixed', () => {
    const mixed = doc(para(run('a')), {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [para(run('b'))] }],
    });

    expect(listKind(mixed)).toBe(MIXED);
  });
});

describe('indent and the summary of a whole text (the panel with a box selected)', () => {
  const two = doc(para(run('a')), para(run('b')));

  test('Given plain paragraphs, When they are indented twice, Then each is two levels in, and back to none', () => {
    const indented = indentText(indentText(two, 1), 1);

    expect(summariseText(indented).indent).toBe(2);
    expect(summariseText(indentText(indented, -5)).indent).toBe(0);
  });

  test('Given an indent beyond the limit, When it is asked for, Then it stops at the limit', () => {
    let text = two;
    for (let i = 0; i < 10; i++) text = indentText(text, 1);

    expect(summariseText(text).indent).toBe(MAX_INDENT);
  });

  test('Given paragraphs with different indents, When they are summarised, Then the indent is mixed', () => {
    const mixed = doc(
      { type: 'paragraph', attrs: { indent: 2 }, content: [run('a')] },
      para(run('b')),
    );

    expect(summariseText(mixed).indent).toBe(MIXED);
  });

  test('Given a list, When it is indented, Then the list is left as it was', () => {
    const list = setListKind(two, 'bulletList');

    expect(indentText(list, 1)).toEqual(list);
    expect(summariseText(list).list).toBe('bulletList');
  });

  test('Given styled text, When it is summarised, Then the style comes with the list and indent', () => {
    const summary = summariseText(doc(para(run('a', [{ type: 'bold' }]))));

    expect(summary).toMatchObject({ bold: true, list: 'none', indent: 0 });
  });
});
