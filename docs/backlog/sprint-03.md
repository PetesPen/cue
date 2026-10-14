# Sprint 3: Rich text and notes

- Capacity: 16 engineering days (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-04.md](sprint-04.md) · Previous: [sprint-02.md](sprint-02.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Rich text and notes.

## Demo at the review

Format mixed text in several fonts, paste, write notes.

## Key automated tests

Text JSON round trip; typing and font picker end to end; font loading check.

## Stories (4)

4 Must, 0 Should. Story order below is the suggested build order.

### EL-1 Add rich text (Must)

As a presenter, I want to add a text box and format parts of it independently, so that my text has emphasis and structure.

Acceptance criteria:
- [ ] A toolbar button and the shortcut T add a text box; double-click to edit in place.
- [ ] Within one box I can mix bold, italic, underline, strikethrough, colour, size and font on selected text.
- [ ] Paragraph options: alignment, bullet and numbered lists, indent level and line spacing.
- [ ] Text boxes can have a fill, border and padding.
- [ ] Pasting from other apps keeps basic formatting but drops unsupported styles.

Design: [`Editor-Text`](../../design/screenshots/Editor-Text.png) ([source](../../design/boards/Editor-Text.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### EL-2 Choose fonts (Must)

As a presenter, I want to pick from a good set of fonts, so that decks look distinctive.

Acceptance criteria:
- [ ] A font picker previews each font in its own typeface and shows recently used fonts first.
- [ ] A curated set of web fonts is bundled with the app so decks look the same on every machine.
- [ ] Fonts are embedded in HTML exports so the presentation renders correctly offline.
- [ ] A style control is hidden when the selected font has no such design, so the editor never shows a browser-made slant or thickening that could differ in the export: italic for Bricolage Grotesque, Space Grotesk and Caveat; bold for DM Serif Display. The same rule applies to any other control that does not apply to the selected font (decided by Peter, 2026-10-14 and 2026-10-15). Only Latin text is bundled; other characters fall back to the computer's own font (decided by Peter, 2026-10-14). Planning note: decide in sprint 3 how a selection that mixes fonts, and italic text pasted into one of these fonts, behave. Test: a component test that each unavailable style button is absent for its fonts and present for the others.

Design: [`Editor-Text`](../../design/screenshots/Editor-Text.png) ([source](../../design/boards/Editor-Text.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SL-6 Add speaker notes (Must)

As a presenter, I want a notes field under each slide, so that I can prepare what to say.

Acceptance criteria:
- [ ] Notes are plain or lightly formatted text, saved with the slide.
- [ ] Notes appear in the presenter view (see Presentation mode).

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### EL-7 Copy, paste and delete (Must)

As a presenter, I want standard clipboard actions, so that I can reuse elements.

Acceptance criteria:
- [ ] Cut, copy, paste, duplicate and delete work on selections, including across slides.
- [ ] Pasted elements keep their formatting and appear slightly offset.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
