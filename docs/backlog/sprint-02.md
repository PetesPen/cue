# Sprint 2: Elements you can move

- Capacity: 16 engineering days (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-03.md](sprint-03.md) · Previous: [sprint-01.md](sprint-01.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Elements you can move.

## Demo at the review

Draw shapes, then move, resize, rotate, layer and fade them.

## Key automated tests

Z-order property tests; drag and resize end to end; opacity snapshots.

## Stories (4)

4 Must, 0 Should. Story order below is the suggested build order.

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

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
