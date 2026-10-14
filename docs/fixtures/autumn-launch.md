# Fixture deck: Autumn Launch

The one deck that feeds the end-to-end, visual and performance tests (`CLAUDE.md`, testing rules), so a failure always points at the same slides. This file is the plan. The deck itself is built as typed data in `tests/fixtures/autumn-launch.ts` once the model exists (sprints 1 and 2), and is checked against this file.

Everything here is read from the design boards (`design/boards/Main.dc.html`, `Presenter.dc.html`, `Editor-Animate.dc.html`), not invented. The geometry of slide 3 matches the inspector in `Main.png` (image at X 922, Y 86, W 730, H 648).

## The 12 slides

Colours are from `design/tokens.json`. "Title bar", "line" and "dot" are the three shapes the boards draw on every thumbnail; they stand for the slide's title, body text and a decorative shape.

| # | Background | Title | Body lines | Shape | Motion |
|---|---|---|---|---|---|
| 1 | Forest `#14281B` | `#F4F8F1` | `#3F5A48` | circle, yellow `#F5C542` | none |
| 2 | White | forest | `#CBD8C6` | circle, mint `#7FC8A0` | none |
| 3 | White | forest | `#CBD8C6` | circle, forest | **3 clicks (below)**; selected, "Our approach" |
| 4 | Yellow `#F5C542` | forest | forest | circle, white | none |
| 5 | White | forest | `#CBD8C6` | circle, yellow | animated (one element appears on click) |
| 6 | Accent tint `#DDF1E3` | forest | `#8FB89B` | circle, accent green `#17803F` | none |
| 7 | Forest | `#F4F8F1` | `#3F5A48` | circle, mint | none |
| 8 | White | accent green | `#CBD8C6` | circle, yellow | none |
| 9 | Sage `#E8F0E4` | forest | `#A9BDA4` | square, forest | none |
| 10 | White | forest | `#CBD8C6` | circle, mint | none |
| 11 | Forest | yellow | `#3F5A48` | square, `#F4F8F1` | none |
| 12 | Yellow | forest | forest | circle, forest | none |

The mix of dark, white, yellow, tint and sage backgrounds is deliberate: it exercises contrast, thumbnails and the transition between very different slides.

## Slide 3, the hero ("Our approach")

Slide space 1920 × 1080. Percentages in the board become pixels here.

| Element (layer name) | Position and size | Style |
|---|---|---|
| Label "03 — STRATEGY" | x 115, y 97 | accent green, 29 px, weight 600, tracking .14em |
| Title "Our approach" (two lines) | x 115, y 162 | forest, 138 px, weight 700, line height 1, tracking -.03em |
| Pillars list: "01 Listen first", "02 Ship in small steps", "03 Measure what matters" | x 115, y 583, width 653 | 38 px, weight 500, a 1 px forest rule above each row, 21 px padding, numbers muted `#5B6F61` |
| Rectangle | x 1114, y 259, 653 × 605 | yellow `#F5C542` |
| Image (a placeholder photo, "harbour.jpg", alt text "Boats in the harbour at dawn") | **x 922, y 86, 730 × 648** | mint placeholder, **opacity 60%** |
| Circle | x 806, y 583, 250 × 250 | forest |

Layer order, back to front: Rectangle, Image, Circle, Pillars list, Title (the Layers panel in `Main.png` lists them top to bottom as Title, Pillars list, Circle, Image, Rectangle).

Animation (`Editor-Animate.png`, "4 steps, 3 clicks"):

1. **Click 1:** Image appears (fade, 0.5 s, on click), and Pillars list appears with the previous one.
2. **Click 2:** Circle moves (the presenter's next-click preview says "Circle moves").
3. **Click 3:** Rectangle disappears.

Speaker notes (the presenter board wording, which includes the click marker): "Open with the customer problem, not the product. [Click 1] brings in the image; pause for questions." and "Three pillars: listen first, ship in small steps, measure what matters. Say the Q2 number out loud." The editor board words the first paragraph slightly differently; the fixture uses the presenter wording.

Slide 3 is the one drawn identically in the editor, the presenter, the audience window and the HTML export, so the three-renderer comparisons (TR-3, SV-5) use it.

## Generated decks for performance and size tests

These are built by code, not by hand, and reuse the generators from the sprint 0 spikes:

| Deck | Contents | Used by | Budget |
|---|---|---|---|
| Fifty slides | 50 slides with a title, a few text lines and shapes | UX-3 open time, thumbnail rail | opens in under 2 s |
| Fifty elements | one slide with 50 mixed elements (shapes, text, images) | UX-3 drag and resize, AN-3 motion | drag at 60 fps (see `docs/spikes/SP-4.md` for how that is judged) |
| Photo-heavy | 30 slides, one 2000 × 1500 photo each (about 130 KB, 700 KB and 1.3 MB variants) | SV-4 export time and size, EL-4, SV-1 | export under 10 s, file about 1.35 × the photos + 0.16 MB |
| Long text | the random rich-text documents of `spikes/sp-2` | EL-1, EL-2, SV-5 wrapping | line breaks identical in editor and static renderer |

## How it is used

- **End to end (every Must story):** open the deck, edit slide 3, run the show through slide 3's three clicks.
- **Visual regression (Chromium, pinned container):** the 12 thumbnails in the slide rail, slide 3 in the editor, the presenter window and the audience window, and each state of its three clicks.
- **Accessibility:** axe on the editor with this deck open.
- **Performance:** the generated decks above.

Building the deck in code is part of sprint 1 (SL-1 and SV-2 need a deck to open) and sprint 2 (shapes and the 60% opacity); until the model exists there is nothing to build it with.
