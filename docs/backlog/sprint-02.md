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
- [x] Drag to move; corner and edge handles resize; a rotation handle turns the element. (end to end with a real mouse on Chromium and WebKit; Firefox in CI; geometry property tests keep the opposite side fixed at any rotation)
- [x] Arrow keys nudge by 1 px, and Shift+arrow by 10 px.
- [x] Multi-select with Shift-click or a drag-selection box; the group moves, resizes and rotates together. (moving and resizing a group are end to end; turning a group is covered by unit tests of the geometry and of the gesture, not by an end-to-end drag)
- [x] Dragging shows size and position readouts. (X and Y, W and H, or the angle, in the chip above the selection)

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### EL-3 Add shapes (Must)

As a presenter, I want to insert and style shapes, so that I can build diagrams and visual structure.

Acceptance criteria:
- [x] Available shapes: rectangle, rounded rectangle, ellipse, triangle, line and arrow.
- [x] Style controls: fill colour, gradient (Could), border colour, width and dash style, and corner radius. (all but the gradient, which is a Could and was not built; colours are the design palette plus any hex)
- [ ] ~~A shape can hold text, centred by default.~~ Moved to sprint 3 (Peter, 2026-10-16): it needs the rich-text editor of EL-1. Not part of sprint 2.
- [x] Holding Shift while dragging keeps proportions; lines snap to 15° steps. (drawing and resizing)

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### ZO-1 Reorder with commands (Must)

As a presenter, I want to move an element up or down the stack, so that I can control what covers what.

Acceptance criteria:
- [x] Bring to Front, Bring Forward, Send Backward and Send to Back are in the toolbar, the right-click menu and keyboard shortcuts. (the "toolbar" is the Arrange row of the format panel, as in the Main board, which has no such buttons in the top bar; the right-click menu and Ctrl+[ and Ctrl+] with Shift are also there)
- [x] The command works on a multi-selection and preserves the relative order of the selected elements. (property tests, and end to end)
- [x] Commands that would have no effect (already at the front, say) are disabled. (panel buttons and right-click menu)
- [x] New elements are added on top.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### TR-1 Fade any element (Must)

As a presenter, I want an opacity control for images, shapes and text, so that I can layer content and create subtle effects.

Acceptance criteria:
- [x] A slider with a numeric field (0–100%) appears in the format panel for every element type. (every type that exists: shapes; text and images get it when they arrive in sprints 3 and 4)
- [x] The canvas updates live while the slider is dragged.
- [x] Opacity applies to the whole element, including its fill, border and text, and to a whole group. (fill and border are tested; text arrives in sprint 3; a selection of several is faded together)
- [ ] Image transparency also respects PNG and SVG transparency already in the file. (waits for images, EL-4, sprint 4)

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SV-7 One tab per deck (Must)

As a presenter, I want to be told when a deck is already open in another tab, so that two tabs never overwrite each other's edits.

Acceptance criteria:
- [x] Opening a deck that is already open in another tab of the same browser shows "This deck is open in another tab" and does not let this tab edit it; a link goes back to the library.
- [x] When the other tab is closed, this tab becomes editable by itself, with no reload, and shows the deck as the other tab left it.
- [x] Different decks can be open in different tabs, and the library can be open in as many tabs as you like.
- [x] Where the browser has no Web Locks, nothing changes and nothing breaks.

Design: none yet. It reuses the "This deck isn't here" screen of sprint 1 (a message and a link back); the wording is Claude's, for Peter to review.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story): two pages in one browser context, the same deck in both.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
