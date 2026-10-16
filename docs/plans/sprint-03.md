# Sprint 3 plan: Rich text and notes

Status: **approved by Peter on 2026-10-16**, with the colour picker (EL-10) in this sprint and the palette switcher left to TH-1 (written together with `sprint-04.md`; the review after sprint 4 is Gate 2). Stories: EL-1, EL-2, SL-6, EL-7 (all Must) and the criterion carried from sprint 2 (text inside a shape, EL-3). Nominal load 18 days against 16 (the carried criterion is 2). If Peter adds the colour picker (EL-10, decision 19) it is about 4 more.

## Outcome at the next review (after sprint 4)

Add text boxes, edit them in place, mix fonts, sizes, colours and styles within one box, make lists, type into shapes, write speaker notes, and copy, paste, duplicate and delete elements across slides, all saved with the deck and drawn identically on the canvas, in thumbnails and (later) in the presenter and the export.

## Approach: seven thin slices, in this order

1. **Rich text in the model** (`model`). A small, strict rich-text format (a "text document") that is the same shape TipTap produces: paragraphs, bullet and numbered lists, and the marks bold, italic, underline, strikethrough, plus font family, size and colour. `parseDeck` validates it. New element `text` (box, rotation, opacity, fill, border, padding, and its text document) and an optional text part on shapes (centred by default). New commands: set the text of an element, remove elements, add several elements (paste), duplicate. Pure helpers (plain text of a document, whether it is empty). Property tests: parse then write returns the same document; every command's inverse restores the deck.
2. **Drawing text** (`render`). A small static renderer of our own that follows the four rules from spike SP-2 (same structure as the editor, ProseMirror's CSS, `text-rendering: geometricPrecision`, the extra break after a final soft return), so thumbnails, the presenter and the export draw text exactly as the editor does. It waits for the fonts a slide uses before drawing, so a thumbnail never flashes a fallback font. Shapes draw their text centred inside.
3. **Editing text** (`editor`). The T tool and the toolbar's Text button add a text box; double-click edits in place. TipTap is loaded only when editing starts (about 121 KB gzipped, as measured in SP-2), so the first load stays small. A box keeps its width and grows in height with its text. The floating toolbar from the Editor-Text board: font, size, bold, italic, underline, strikethrough, colour, alignment, lists. The Design tab gains the Text section (font, weight, size, line spacing, tracking, colour) and the Box section (fill, border, padding), both from the board.
4. **Fonts** (EL-2). The font picker from the board: a search field, "Fonts in this deck" first, each name in its own typeface, with a small label (Sans, Serif, Mono, Hand) and the line "Bundled fonts travel with exported files". Style buttons that a font does not have are hidden, per your rule (italic for Bricolage Grotesque, Space Grotesk and Caveat; bold for DM Serif Display). Decision 20 below says what happens with a mixed selection and with pasted italics.
5. **Paste and the clipboard** (EL-1, EL-7). Pasting from other programs keeps bold, italic, underline, strikethrough, lists and links' text, and drops everything else (fonts we do not have, colours outside what the box allows, sizes in odd units, scripts, styles). Cut, copy, paste, duplicate and delete work on selected elements, including to another slide; pasted elements keep their formatting and appear slightly offset. Delete, Backspace, Ctrl+C, X, V and D, with the same code path used by the right-click menu.
6. **Speaker notes** (SL-6). The notes strip under the canvas becomes an editable field (plain text with line breaks), saved with the slide and autosaved like everything else. "Notes appear in the presenter view" is ticked when the presenter view exists (sprint 8).
7. **Checks and screenshots.** End-to-end and component tests for every criterion (below), axe on the new screens, and screenshot tests for text (reference images made by the "Update screenshots" workflow, for your review).

## Acceptance criteria as examples, and how each is tested

U = unit, C = component (real Chromium), E = end to end, V = screenshot, A = axe, M = manual.

### EL-1 Add rich text
- Given a slide, When T is pressed (or the toolbar's Text button) and the slide is clicked or dragged, Then a text box is added in edit mode with the cursor in it. (C, E)
- Given a text box, When it is double-clicked, Then it is edited in place; Escape or a click outside finishes. (E)
- Given words selected in one box, When bold, italic, underline, strikethrough, a colour, a size and a font are applied, Then each applies to the selection only and the others stay as they were. (C, E)
- Given paragraphs, When alignment, a bullet or numbered list, an indent level and a line spacing are chosen, Then they apply to the paragraphs touched. (C)
- Given a text box, When a fill, border and padding are set, Then the box shows them and text keeps clear of the edge by the padding. (C, V)
- Given text copied from a web page or a word processor, When it is pasted, Then bold, italic, underline, strikethrough and lists survive and everything else is dropped. (U on the sanitiser with real examples, E)
- Given a text box edited in the editor, When the same box is drawn by the static renderer, Then the lines break in the same places (the SP-2 measure, as a component test on every text in the fixture). (C)
- Given a text document, When it is saved and loaded, Then it is identical. (U property test, I)

### EL-2 Choose fonts
- Given the font picker, When it opens, Then every name is in its own typeface, fonts used in this deck come first, and typing narrows the list. (C)
- Given any font, When it is chosen, Then only that family is loaded (not all seven), and a slide never shows a fallback font while it loads. (C, E: network log)
- Given Caveat or DM Serif Display, When it is selected, Then italic (or bold for DM Serif) is not offered; for the other fonts it is. (C: every style button, every font)
- Given text in a font with no italic, When a selection of mixed fonts is made, Then see decision 20. (C)

### SL-6 Add speaker notes
- Given a slide, When text is typed in the notes field, Then it is saved with that slide within 2 seconds and is there after a reload. (C, E)
- Given two slides, When the slide changes, Then each shows its own notes. (C)

### EL-7 Copy, paste and delete
- Given two shapes and a text box selected, When copied and pasted on another slide, Then three new elements appear there, formatted the same, offset slightly, and selected. (C, E)
- Given a selection, When Delete is pressed, Then it is removed; Cut removes it and pastes back; Duplicate makes copies right away. (C, E)
- Given text typed inside a text box being edited, When Delete or Ctrl+C is pressed, Then the text editor handles it, not the element commands. (C)

### Carried from sprint 2: text inside a shape
- Given a selected shape, When Enter is pressed or it is double-clicked, Then it is edited in place with centred text; fading the shape fades its text. (C, E, V)

## Decisions needed from Peter

1. **Approve this plan** (and sprint 4's, in `sprint-04.md`).
2. **Colour picker (decision 19).** Your question on 2026-10-16. Recommendation: a new story EL-10 "Pick any colour" inside this sprint, because text colour is needed here and a good picker is easier to build once and use for shape fills and borders, text and later the slide background. It adds about 4 days to a sprint already at 18. The design has no picker drawn (the boards show a swatch and a hex field), so I would build it from the Style Guide's pieces and show you, or you can have it drawn first. The alternative is sprint 4.

## Decision I am making (technical; Peter can overrule)

20. **Fonts, italics and mixed selections.** Text never stores a style the font does not have. (a) If a selection spans fonts, the toolbar shows "Mixed" for the font, and Bold and Italic are offered only when every font in the selection has that style. (b) If the font changes to one that lacks italic (or bold, for DM Serif Display), that style is removed from the changed text; the same applies to text pasted in. (c) A line of text in a font is never "faked" bolder or slanted by the browser. This is the safe reading of your rule: what you see in the editor is what the export will draw.

## Assumptions to check

- A text box keeps its width and grows in height with its text; resizing it by a handle sets the width (and a minimum height). A shape's text does not change the shape's size.
- Notes are plain text for now ("plain or lightly formatted" allows that); formatted notes can come later if you want them.
- Text colours offered are the same palette as shape colours plus a hex field, until the colour picker exists.

## Risks

- **Rich text is the hardest part of the whole product** (plan risk table). The static renderer must match the editor line for line; SP-2 measured it at 0.02 px, and the test above keeps it so.
- **Undo and typing** (plan risk): TipTap has its own history. In this sprint typing is committed to the deck in bursts; sprint 4's undo (EL-8) takes over TipTap's history so there is only one stack (decision 18).
- **Input methods and paste** differ by browser; IME composition and pasting from Word are checked by hand.
- **Bundle:** the text editor is a separate chunk that loads on first edit; a new budget keeps it under 160 KB gzipped.

## Manual checks for the review

Typing with an input method, pasting from Word, a web page and a PDF, selecting across fonts, the feel of the floating toolbar, how text looks at 200% browser zoom, your own Firefox.
