# Sprint 6: Motion and sequencing

- Capacity: 16 engineering days (the plan, `docs/plans/sprint-06.md`, comes to 20 with EL-6) (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-07.md](sprint-07.md) · Previous: [sprint-05.md](sprint-05.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Motion and sequencing.

## Demo at the review

Move an element along a ghost path, reorder click steps, pick a transition; snap to guides and align.

## Key automated tests

Step-order table tests; preview returns elements to editing positions; snap and align unit tests.

## Stories (5)

4 Must, 1 Should. Story order below is the suggested build order.

### AN-3 Move an element (Must)

As a presenter, I want to animate an element from one position to another, so that I can show change, flow and emphasis.

Acceptance criteria:
- [x] Move shows a ghost of the end position that I drag into place on the canvas, with a dotted path from start to end. (A dashed copy labelled "Ends here · drag", draggable and movable with the arrow keys; End X and End Y in the panel.)
- [x] Move animates position only; optional resize and rotation changes are Could. (Position only; the Could part is not built.)
- [x] The element ends at the new position, and stays there for later steps.

Design: [`Editor-Animate`](../../design/screenshots/Editor-Animate.png) ([source](../../design/boards/Editor-Animate.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### AN-5 Sequence steps click by click (Must)

As a presenter, I want to order animations and group some to play together, so that I control the pace of a reveal.

Acceptance criteria:
- [x] The animation panel lists steps in play order, each showing its element and effect. (Under "Click n" headings, as on the board.)
- [x] Drag steps to reorder them. (With a drop line; Alt and the up and down arrows do it from the keyboard.)
- [x] Each step is set to "On click" or "With previous", so several elements can animate on a single click. (The first step is always On click.)
- [x] Removing an element removes its steps.

Design: [`Editor-Animate`](../../design/screenshots/Editor-Animate.png) ([source](../../design/boards/Editor-Animate.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### AN-6 Preview animations (Must)

As a presenter, I want to preview a slide's animations without leaving the editor, so that I can fine-tune them quickly.

Acceptance criteria:
- [x] A Preview button plays the slide's steps in the editor, and clicking advances step by step. (Click the slide, Space or the right arrow plays the next click; the left arrow steps back.)
- [x] After a preview, every element returns to its editing position.

Design: [`Editor-Animate`](../../design/screenshots/Editor-Animate.png) ([source](../../design/boards/Editor-Animate.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### TN-1 Choose a transition (Must)

As a presenter, I want to pick how a slide arrives, so that moving between slides feels polished.

Acceptance criteria:
- [x] Options: None, Fade, Slide (from the right), Push, and Zoom.
- [x] The choice is made in a transition panel for the selected slide, and shown as a small badge on its thumbnail.
- [x] The default is None.

Design: [`Editor-Transition`](../../design/screenshots/Editor-Transition.png) ([source](../../design/boards/Editor-Transition.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### EL-6 Align and snap (Should)

As a presenter, I want smart guides and alignment tools, so that slides look tidy without effort.

Pulled forward from sprint 12 by Peter on 2026-10-16 ("I really value the snap lines"). Built last in this sprint, after the four Must stories.

Acceptance criteria:
- [x] Elements snap to slide edges, slide centre and other elements, with visible guide lines. (Edges and middles, within 6 screen pixels; also the end of a Move; Alt turns it off for a drag. A turned element snaps by its outer box on a move, and the corner or edge middle being dragged when it is resized.)
- [x] Align left, centre, right, top, middle and bottom for a selection. (One element aligns to the slide, several to the box around them.)
- [x] Distribute horizontally and vertically for three or more elements.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
