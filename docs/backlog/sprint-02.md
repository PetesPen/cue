# Sprint 2: Elements you can move

- Capacity: 16 engineering days (2 engineers, about 80% focus, 2 weeks). Planned load is 18: SV-7 (2 days) was added on 2026-10-15 by decision 16, and velocity is re-estimated after this sprint
- Next: [sprint-03.md](sprint-03.md) · Previous: [sprint-01.md](sprint-01.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Elements you can move.

## Demo at the review

Draw shapes, then move, resize, rotate, layer and fade them.

## Key automated tests

Z-order property tests; drag and resize end to end; opacity snapshots.

## Stories (5)

5 Must, 0 Should. Story order below is the suggested build order.

### EL-5 Move, resize and rotate (Must)

As a presenter, I want direct-manipulation handles, so that layout feels natural.

Acceptance criteria:
- [ ] Drag to move; corner and edge handles resize; a rotation handle turns the element.
- [ ] Arrow keys nudge by 1 px, and Shift+arrow by 10 px.
- [ ] Multi-select with Shift-click or a drag-selection box; the group moves, resizes and rotates together.
- [ ] Dragging shows size and position readouts.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### EL-3 Add shapes (Must)

As a presenter, I want to insert and style shapes, so that I can build diagrams and visual structure.

Acceptance criteria:
- [ ] Available shapes: rectangle, rounded rectangle, ellipse, triangle, line and arrow.
- [ ] Style controls: fill colour, gradient (Could), border colour, width and dash style, and corner radius.
- [ ] A shape can hold text, centred by default.
- [ ] Holding Shift while dragging keeps proportions; lines snap to 15° steps.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### ZO-1 Reorder with commands (Must)

As a presenter, I want to move an element up or down the stack, so that I can control what covers what.

Acceptance criteria:
- [ ] Bring to Front, Bring Forward, Send Backward and Send to Back are in the toolbar, the right-click menu and keyboard shortcuts.
- [ ] The command works on a multi-selection and preserves the relative order of the selected elements.
- [ ] Commands that would have no effect (already at the front, say) are disabled.
- [ ] New elements are added on top.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### TR-1 Fade any element (Must)

As a presenter, I want an opacity control for images, shapes and text, so that I can layer content and create subtle effects.

Acceptance criteria:
- [ ] A slider with a numeric field (0–100%) appears in the format panel for every element type.
- [ ] The canvas updates live while the slider is dragged.
- [ ] Opacity applies to the whole element, including its fill, border and text, and to a whole group.
- [ ] Image transparency also respects PNG and SVG transparency already in the file.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SV-7 One tab per deck (Must)

As a presenter, I want to be told when a deck is already open in another tab, so that two tabs never overwrite each other's edits.

Acceptance criteria:
- [ ] Opening a deck that is already open in another tab of the same browser shows "This deck is open in another tab" and does not let this tab edit it; a link goes back to the library.
- [ ] When the other tab is closed, this tab becomes editable by itself, with no reload, and shows the deck as the other tab left it.
- [ ] Different decks can be open in different tabs, and the library can be open in as many tabs as you like.
- [ ] Where the browser has no Web Locks, nothing changes and nothing breaks.

Design: none yet. It reuses the "This deck isn't here" screen of sprint 1 (a message and a link back); the wording is Claude's, for Peter to review.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story): two pages in one browser context, the same deck in both.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
