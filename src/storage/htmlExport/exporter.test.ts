import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { createDeck, createImage, createSlide, parseDeck, systemEnv, type Deck } from '@/model';
import { autumnLaunch } from '../../../tests/fixtures/autumnLaunch';
import {
  HtmlExportError,
  buildHtmlParts,
  fontFaces,
  toBase64,
  type HtmlExportInput,
} from './exporter';
import { escapeForScript, escapeHtml } from './layout';

// SV-4: the exported web page is one file made of pieces. These tests read the text of the pieces; that
// the browser shows the page, from a real file with every request refused, is the end-to-end test's.

const SCRIPT = 'console.log("the page program");';

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const SEPARATORS = LS + PS;

const FONTS_CSS = `
@font-face {
  font-family: 'Figtree';
  font-style: normal;
  font-weight: 300 900;
  src: url('./figtree/figtree-latin-wght-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF;
}
@font-face {
  font-family: 'Figtree';
  font-style: italic;
  font-weight: 300 900;
  src: url('./figtree/figtree-latin-wght-italic.woff2') format('woff2');
}
@font-face {
  font-family: 'Caveat';
  font-style: normal;
  font-weight: 400 700;
  src: url('./caveat/caveat-latin-wght-normal.woff2') format('woff2');
}`;

const figtree = {
  family: 'Figtree',
  files: [
    { name: 'figtree-latin-wght-normal.woff2', bytes: new Uint8Array([1, 2, 3]) },
    { name: 'figtree-latin-wght-italic.woff2', bytes: new Uint8Array([4, 5, 6]) },
  ],
  licence: 'Figtree licence: SIL Open Font License 1.1',
};

const picture = (hash: string, bytes: number[], type = 'image/png') => ({
  hash,
  type,
  bytes: new Uint8Array(bytes),
});

function deckWith(title: string, notes: string): Deck {
  const deck = createDeck({
    ...systemEnv,
    newId: (() => {
      let n = 0;
      return () => `id${String(n++)}`;
    })(),
  });
  const slide = {
    ...createSlide('first'),
    notes,
    elements: [createImage('pic', 'hash-1', { x: 0, y: 0, width: 400, height: 300 }, 'A photo')],
  };
  return { ...deck, title, slides: [slide, { ...slide, id: 'second', notes: `${notes} again` }] };
}

const QUARTERLY = deckWith('Quarterly review', 'Say hello first.');

function input(overrides: Partial<HtmlExportInput> = {}): HtmlExportInput {
  return {
    deck: QUARTERLY,
    images: [picture('hash-1', [137, 80, 78, 71])],
    fonts: [figtree],
    fontsCss: FONTS_CSS,
    includeNotes: true,
    runtime: { script: SCRIPT, style: '.cp{color:red}' },
    ...overrides,
  };
}

async function text(options?: Partial<HtmlExportInput>): Promise<string> {
  return (await buildHtmlParts(input(options)))
    .map((part) => (typeof part === 'string' ? part : ''))
    .join('');
}

async function sha256Base64(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toBase64(new Uint8Array(digest));
}

describe('base64 (SV-4)', () => {
  test('Given any bytes, When they are written as base64 and read back, Then they are the same', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 100_000 }), (bytes) => {
        const back = Uint8Array.from(atob(toBase64(bytes)), (c) => c.charCodeAt(0));
        expect(back).toEqual(bytes);
      }),
      { numRuns: 40 },
    );
  });
});

describe('text that is safe inside a page (SV-4)', () => {
  test('Given text that could end a script block or open a comment, Then it is escaped and means the same', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 60 }), (words) => {
        const json = JSON.stringify({ words: `</script><!--${words}${SEPARATORS}` });
        const safe = escapeForScript(json);
        expect(safe).not.toContain('<');
        expect(safe).not.toContain(LS);
        expect(JSON.parse(safe)).toEqual(JSON.parse(json));
      }),
    );
  });

  test('Given a title with markup and quotes, Then it is text and nothing else', () => {
    expect(escapeHtml(`<b>"Q&A"</b> it's`)).toBe('&lt;b&gt;&quot;Q&amp;A&quot;&lt;/b&gt; it&#39;s');
  });
});

describe('the fonts in the page (SV-4)', () => {
  test('Given a deck that uses Figtree, Then its two faces come with the font inside, and Caveat is left out', () => {
    const css = fontFaces(FONTS_CSS, [figtree]);
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).toContain(`url(data:font/woff2;base64,${toBase64(new Uint8Array([1, 2, 3]))})`);
    expect(css).toContain(`url(data:font/woff2;base64,${toBase64(new Uint8Array([4, 5, 6]))})`);
    expect(css).toContain("font-family: 'Figtree'");
    expect(css).toContain('unicode-range: U+0000-00FF');
    expect(css).not.toContain('Caveat');
    expect(css).not.toContain('./figtree');
  });

  test('Given no fonts, Then there are no rules', () => {
    expect(fontFaces(FONTS_CSS, [])).toBe('');
  });
});

describe('the page as a file (SV-4)', () => {
  test('Given a deck, Then the policy comes first, allows one script by its hash, and refuses everything else', async () => {
    const page = await text();
    expect(page.startsWith('<!doctype html>')).toBe(true);
    const policy = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(page)?.[1] ?? '';
    expect(page.indexOf('Content-Security-Policy')).toBeLessThan(page.indexOf('<script'));
    expect(page.indexOf('Content-Security-Policy')).toBeLessThan(page.indexOf('<style'));
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain(`script-src 'sha256-${await sha256Base64(SCRIPT)}'`);
    expect(policy).toContain('img-src blob: data:');
    expect(policy).toContain('font-src data:');
    expect(policy).not.toMatch(/https?:|\*|'unsafe-eval'/);
    expect(page).toContain(`<script>${SCRIPT}</script>`);
  });

  test('Given a deck, Then the deck is a data block that reads back as the same deck', async () => {
    const page = await text();
    const raw = /<script type="application\/json" id="cue-deck">([\s\S]*?)<\/script>/.exec(
      page,
    )?.[1];
    expect(raw).toBeDefined();
    expect(parseDeck(JSON.parse(raw ?? ''))).toEqual(QUARTERLY);
  });

  test('Given Autumn Launch, Then its deck still reads back as the same deck', async () => {
    const deck = parseDeck(autumnLaunch());
    const page = await text({ deck, images: [] });
    const raw = /id="cue-deck">([\s\S]*?)<\/script>/.exec(page)?.[1] ?? '';
    expect(parseDeck(JSON.parse(raw))).toEqual(deck);
  });

  test('Given notes are included, Then they are in the file; given they are not, Then not a word of them is', async () => {
    const withNotes = await text();
    expect(withNotes).toContain('Say hello first.');
    expect(withNotes).toContain('data-cue-notes="included"');
    const without = await text({ includeNotes: false });
    expect(without).not.toContain('Say hello first.');
    expect(without).not.toContain('hello');
    expect(without).toContain('data-cue-notes="none"');
  });

  test('Given each picture, Then it is in the file once, as base64 in a block of its own with its type', async () => {
    const page = await text({
      deck: deckWith('Pictures', 'n'),
      images: [picture('hash-1', [1, 2, 3, 4]), picture('hash-2', [9, 8], 'image/jpeg')],
    });
    const blocks = page.match(
      /<script type="text\/plain" data-cue-image="[^"]+"[^>]*>[^<]*<\/script>/g,
    );
    expect(blocks).toHaveLength(2);
    expect(page).toContain(
      `data-cue-image="hash-1" data-cue-type="image/png">${toBase64(new Uint8Array([1, 2, 3, 4]))}</script>`,
    );
    expect(page).toContain('data-cue-image="hash-2" data-cue-type="image/jpeg">');
  });

  test('Given the fonts used, Then their licences are in the file, and only theirs', async () => {
    const page = await text();
    expect(page).toContain('Figtree licence: SIL Open Font License 1.1');
    expect(page).not.toContain('Caveat');
  });

  test('Given a title and text full of markup, Then the file keeps one program and no markup comes through', async () => {
    const nasty = `</script><script>alert(1)</script><!-- "quotes" ${LS} & more`;
    const page = await text({ deck: deckWith(nasty, nasty) });
    // One program, and the two data blocks and the picture block (which are not programs).
    expect(page.match(/<script>/g)).toHaveLength(1);
    expect(page).toContain('<title>&lt;/script&gt;&lt;script&gt;alert(1)');
    const raw = /id="cue-deck">([\s\S]*?)<\/script>/.exec(page)?.[1] ?? '';
    expect(raw).not.toContain('</script');
    expect(raw).not.toContain('<!--');
    const parsed = parseDeck(JSON.parse(raw));
    expect(parsed.title).toBe(nasty);
    expect(parsed.slides[0]?.notes).toBe(nasty);
  });

  test.each([
    ['a program that could end its block', { runtime: { script: 'x="</script>"', style: '' } }],
    ['a program with a comment opener', { runtime: { script: 'x="<!--"', style: '' } }],
    ['a program with a carriage return', { runtime: { script: 'a\r\nb', style: '' } }],
    ['a style sheet that could end its block', { runtime: { script: SCRIPT, style: 'a</style>' } }],
  ] as const)('Given %s, Then the page is not made', async (_name, options) => {
    await expect(buildHtmlParts(input(options))).rejects.toBeInstanceOf(HtmlExportError);
  });
});
