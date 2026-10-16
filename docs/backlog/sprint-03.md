# Sprint 3: Rich text and notes

- Capacity: 16 engineering days (2 engineers, about 80% focus, 2 weeks). Planned load is 22: the criterion carried from sprint 2 (2 days) and EL-10 (4 days, added by Peter on 2026-10-16) come on top
- Next: [sprint-04.md](sprint-04.md) · Previous: [sprint-02.md](sprint-02.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Rich text and notes.

## Demo at the review

Format mixed text in several fonts, paste, write notes.

## Key automated tests

Text JSON round trip; typing and font picker end to end; font loading check.

## Stories (5)

4 Must, 1 Should. Story order below is the suggested build order.

### EL-1 Add rich text (Must)

As a presenter, I want to add a text box and format parts of it independently, so that my text has emphasis and structure.

Acceptance criteria:
- [x] A toolbar button and the shortcut T add a text box; double-click to edit in place.
- [x] Within one box I can mix bold, italic, underline, strikethrough, colour, size and font on selected text.
- [x] Paragraph options: alignment, bullet and numbered lists, indent level and line spacing.
- [x] Text boxes can have a fill, border and padding.
- [x] Pasting from other apps keeps basic formatting but drops unsupported styles.

Design: [`Editor-Text`](../../design/screenshots/Editor-Text.png) ([source](../../design/boards/Editor-Text.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### Carried from sprint 2 (EL-3, Must): text inside a shape

- [x] A shape can hold text, centred by default. Build it first, as soon as the text element of EL-1 exists: a shape gets a text part that uses the same editor and the same static renderer, and fading the shape fades its text with it (TR-1).

### EL-2 Choose fonts (Must)

As a presenter, I want to pick from a good set of fonts, so that decks look distinctive.

Acceptance criteria:
- [x] A font picker previews each font in its own typeface and shows recently used fonts first. (Built as "fonts in this deck" first, as the plan said: the fonts the text of this deck uses.)
- [x] A curated set of web fonts is bundled with the app so decks look the same on every machine.
- [ ] Fonts are embedded in HTML exports so the presentation renders correctly offline.
- [x] A style control is hidden when the selected font has no such design, so the editor never shows a browser-made slant or thickening that could differ in the export: italic for Bricolage Grotesque, Space Grotesk and Caveat; bold for DM Serif Display. The same rule applies to any other control that does not apply to the selected font (decided by Peter, 2026-10-14 and 2026-10-15). Only Latin text is bundled; other characters fall back to the computer's own font (decided by Peter, 2026-10-14). Planning note: decide in sprint 3 how a selection that mixes fonts, and italic text pasted into one of these fonts, behave. Test: a component test that each unavailable style button is absent for its fonts and present for the others (done: `src/editor/Fonts.component.test.tsx`; mixed selections and pastes follow decision 20).

Design: [`Editor-Text`](../../design/screenshots/Editor-Text.png) ([source](../../design/boards/Editor-Text.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SL-6 Add speaker notes (Must)

As a presenter, I want a notes field under each slide, so that I can prepare what to say.

Acceptance criteria:
- [x] Notes are plain or lightly formatted text, saved with the slide. (Plain text.)
- [ ] Notes appear in the presenter view (see Presentation mode).

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### EL-7 Copy, paste and delete (Must)

As a presenter, I want standard clipboard actions, so that I can reuse elements.

Acceptance criteria:
- [x] Cut, copy, paste, duplicate and delete work on selections, including across slides.
- [x] Pasted elements keep their formatting and appear slightly offset.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### EL-10 Pick any colour (Should)

As a presenter, I want a proper colour chooser, so that I can pick any colour by eye without knowing its hex code.

Acceptance criteria:
- [x] Every colour control (shape fill and border, text colour, box fill) opens the same picker: the design's colours as swatches, an area to drag across for shade and brightness, a slider for hue, and a hex field.
- [x] Colours used in this deck are offered first.
- [x] Where the browser has an eyedropper, a button picks a colour from anywhere on screen.
- [x] The canvas updates live while a colour is dragged, and the change is one step (decision 18).
- [x] It works with the keyboard and tells a screen reader which colour it holds.

Design: not drawn (the boards show a swatch and a hex field only). Claude builds it from the Style Guide's pieces and shows Peter at the review.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
