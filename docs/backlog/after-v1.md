# After v1.0: stretch stories

About two more sprints, ordered by what the product owner values once the app is in daily use. Cut first if a milestone is at risk.

Themes and templates (TH) are only worth building if they are easy. The Home board already shows four starter layouts (Blank, Title and content, Section divider, Image feature).

### EL-9 Group elements (Could)

As a presenter, I want to group elements, so that I can move and animate them as one.

Acceptance criteria:
- [ ] Group and ungroup via shortcut and menu.
- [ ] A group behaves as a single element for z-order, opacity and animation.

Design: no board needed (behaviour, not a screen). Follow `design/README.md` for tokens.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### PM-8 Show a pointer (Could)

As a presenter, I want a laser-pointer mode, so that I can draw attention to a detail.

Acceptance criteria:
- [ ] Pressing L toggles a pointer dot, and my cursor movement in the presenter view's slide area appears on the audience window.

Design: no board needed (behaviour, not a screen). Follow `design/README.md` for tokens.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### SV-6 Export as PDF or images (Could)

As a presenter, I want a printable copy, so that I can hand out slides.

Acceptance criteria:
- [ ] Use the browser's print dialog with a one-slide-per-page layout, or export PNG images.

Design: [`Export-Dialog`](../../design/screenshots/Export-Dialog.png) ([source](../../design/boards/Export-Dialog.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### TH-1 Pick a theme (Could)

As a presenter, I want to apply a ready-made theme, so that my deck looks consistent without design effort.

Acceptance criteria:
- [ ] Four to six themes, each a palette of colours plus a heading font and a body font.
- [ ] Choosing a theme restyles new text and shapes, and offers to restyle existing ones.
- [ ] Colour pickers show the theme palette first.

Design: no board needed (behaviour, not a screen). Follow `design/README.md` for tokens.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### TH-2 Start from a template (Could)

As a presenter, I want to begin from a starter deck, so that I am not facing a blank slide.

Acceptance criteria:
- [ ] The new-deck screen offers Blank plus a few starters, such as Title and content, Section divider and Image feature.
- [ ] A starter is a normal deck with placeholder text that can be freely edited.

Design: [`Home`](../../design/screenshots/Home.png) ([source](../../design/boards/Home.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### TH-3 Reuse my own slide layouts (Could)

As a presenter, I want to save a slide as a reusable layout, so that repeated designs are quick.

Acceptance criteria:
- [ ] "Save as layout" stores the slide's structure, and the add-slide menu lists my layouts.

Design: no board needed (behaviour, not a screen). Follow `design/README.md` for tokens.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.
