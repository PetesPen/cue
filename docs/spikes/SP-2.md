# SP-2: rich text fidelity

Run on 2026-10-14. Stories at stake: EL-1, EL-2, SV-5.

## Question

Does TipTap text with mixed fonts, sizes and colour transparency wrap identically in the editor and in the static renderer that the thumbnails, presenter, audience and HTML export will use?

## Verdict

**Go.** TipTap stays as the rich-text library, with a small static renderer of our own for everything that only shows text. With four rules (below) the static renderer agrees with the editor to within 0.02 px on every line we measured, and breaks every line in the same place. Without the rules it does not: 44 of 64 text blocks wrapped differently.

The plan's fallback (draw presentation and export text through a read-only TipTap editor too) also matched exactly, but it is not needed, and it would put ProseMirror into the presenter and the export file.

## What we measured

The spike is throwaway code in `spikes/sp-2`. It builds 16 documents (one hand-made slide-like text and 15 random ones) with mixed fonts from all seven families, sizes from 28 to 72 px, bold and italic where the font has them, five colours including three with transparency, bullet and numbered lists and soft returns. Each is laid out at four text-box widths. Every character's box is measured (1,013 lines in all) and compared line by line: the text on each line, and its left, right, top and bottom edges.

### The editor against four other renderings (scale 1)

| Rendering | Different line breaks | Largest position difference | Verdict |
|---|---|---|---|
| Read-only TipTap editor | 0 of 64 | 0 px | identical |
| **Our static renderer with the four rules** | **0 of 64** | **0.02 px** | **matches** |
| TipTap's `generateHTML` | 0 of 64 | 43.2 px, one line high in 8 documents | needs the soft-return rule |
| Our static renderer with plain browser CSS | 44 of 64 | 43.2 px | does not match |

### Same wraps in every engine

A fingerprint of every line break in the editor came out identical (`8a7b0f82`) in Chrome 155 and Edge 155 (Windows), Chromium and WebKit (Windows), Firefox (Linux) and WebKit (Linux). So the same text breaks in the same places in five engine and operating system combinations. The one exception is Chromium on Linux, which broke some lines differently (`4a23d842`) until we added `text-rendering: geometricPrecision`; with it, Linux Chromium produced the same `8a7b0f82`.

### Scale and screen density

Drawing the slide at 0.5 and 0.3 of its size (what thumbnails and the presenter's preview do) changed no line break and no position beyond 0.06 px, in every engine. Screens at 1.25×, 1.5× and 2× pixel density wrapped exactly like a 1× screen, in every engine. So the plan to draw at 1920 × 1080 and scale with a CSS transform is safe for text.

## The text rendering rules (the contract for `render`)

1. **Same structure as the editor's output:** `p`, `ul` or `ol` with `li` and `p` inside, `strong`, `em`, and a `span` with inline `font-family`, `font-size` and `color` (any CSS colour, including `rgba` for transparency).
2. **Same CSS as ProseMirror puts on the editor** (read from the live editor): `white-space: break-spaces; overflow-wrap: break-word; font-variant-ligatures: none; font-feature-settings: "liga" 0`. Turning off ligatures is what most affects wrapping.
3. **`text-rendering: geometricPrecision`** on the slide, in the editor too. It makes Chromium on Linux agree with every other engine and costs nothing elsewhere.
4. **An extra `<br>` after a paragraph that ends in a soft return**, and a `<br>` in an empty paragraph, as ProseMirror does. `generateHTML` leaves the first out.

Also: load every font face the text uses before measuring or drawing it (`document.fonts.load`), otherwise a thumbnail briefly shows a fallback font.

## Cost

TipTap with the extensions we use (starter kit, text style, font family, size and colour) is about **121 KB gzipped** in the spike bundle, against our first-load budget of 300 KB (the app is 67 KB today). Load it only when the user starts editing text. The presenter, audience and export runtimes use the small static renderer and never need it.

## Not covered (still to do)

- **Pixel comparison** of editor, presenter and export (SV-5 "within one pixel", TR-3 opacity). This checks boxes, not painted pixels. It belongs to the visual-regression work (F6 and sprints 3 and 10).
- **Real macOS and Linux desktops with their own fonts.** Linux was checked only in CI (headless Chromium, Firefox, WebKit). The bundled fonts remove most variation, but this stays on the manual list.
- **Safari itself.** Playwright's WebKit is a stand-in.
- **Typing, selection, caret, paste and input methods.** The spike renders stored text; it does not edit it.
- **Left-to-right text only, Latin only**, no tabs, no letter-spacing or line-height controls (not in v1).
- **Synthetic bold:** DM Serif Display has no bold design, so bold would be made by the browser. See decision 11.

## Reproduce

`SPIKE=sp-2 npx playwright test -c spikes/playwright.config.ts --project=chrome` (also `edge`, `chromium`, `webkit`; the Firefox and Linux numbers came from the Spikes workflow, removed at Gate 1; see `docs/spikes/README.md`). Print the numbers with `node spikes/sp-2/report.mjs chrome`.
