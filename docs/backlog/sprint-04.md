# Sprint 4: Images, undo and slide management

- Capacity: 16 engineering days (2 engineers, about 80% focus, 2 weeks)
- Ends with Gate 2: Editor alpha (end of sprint 4)
- Next: [sprint-05.md](sprint-05.md) · Previous: [sprint-03.md](sprint-03.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Images, undo and slide management.

## Demo at the review

Drop in images, undo anything, reorder and duplicate slides.

## Key automated tests

Undo-redo property test; image drop end to end; storage-full mock.

## Stories (4)

4 Must, 0 Should. Story order below is the suggested build order.

### EL-4 Add images (Must)

As a presenter, I want to bring in images by upload, drag and drop or paste, so that adding pictures is effortless.

Acceptance criteria:
- [ ] PNG, JPEG, GIF, SVG and WebP are accepted.
- [ ] Images keep their aspect ratio by default and are scaled to fit the slide on insert.
- [ ] Large images are downscaled on import to protect local storage, with the original resolution kept for export where space allows.
- [ ] A friendly message appears if an image cannot be read or storage is full.
- [ ] Carried over from sprint 1 (SV-1): a deck with an image on a slide is restored exactly, image included, after the tab is closed and reopened (end-to-end test). The store already saves photos with the deck in one transaction; this story is the first that can put one on a slide. Also call `sweepOrphanImages` at startup with the hashes the decks refer to.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html)), [`States`](../../design/screenshots/States.png) ([source](../../design/boards/States.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### EL-8 Undo and redo (Must)

As a presenter, I want unlimited undo and redo, so that I can experiment safely.

Acceptance criteria:
- [ ] Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo any edit, including slide-level changes.
- [ ] Dragging, resizing and typing bursts each count as a single step.
- [ ] History survives switching slides but resets when the deck is closed.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SL-3 Reorder slides (Must)

As a presenter, I want to drag thumbnails into a new order, so that I can restructure the story.

Acceptance criteria:
- [ ] A drop indicator shows where the slide will land.
- [ ] Slide numbers update immediately.
- [ ] Reordering can be undone.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SL-4 Duplicate and delete slides (Must)

As a presenter, I want to duplicate or delete a slide, so that I can reuse and tidy up.

Acceptance criteria:
- [ ] Right-click and keyboard shortcuts offer Duplicate and Delete.
- [ ] A duplicate copies every element, animation, transition and note, and appears right after the original.
- [ ] Deleting the only remaining slide leaves a blank slide rather than an empty deck.
- [ ] Delete can be undone.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
