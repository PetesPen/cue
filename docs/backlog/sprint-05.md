# Sprint 5: Keyboard, speed and first animations

- Capacity: 14 engineering days (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-06.md](sprint-06.md) · Previous: [sprint-04.md](sprint-04.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Keyboard, speed and first animations.

## Demo at the review

Drive the editor by keyboard; elements fade in and out on click in preview.

## Key automated tests

Performance budgets for 50 elements and 50 slides; motion resolver unit tests; opacity match across renderers.

## Stories (5)

5 Must, 0 Should. Story order below is the suggested build order.

### UX-2 Fast, keyboard-first work (Must)

As a presenter, I want shortcuts for common actions, so that I can work efficiently.

Acceptance criteria:
- [ ] Shortcuts exist for add slide, text, shapes, z-order, duplicate, undo, redo, present and save.
- [ ] A "?" key opens a shortcut cheat sheet.
- [ ] Every toolbar tooltip shows its shortcut.

Design: [`Shortcuts`](../../design/screenshots/Shortcuts.png) ([source](../../design/boards/Shortcuts.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### UX-3 Responsive performance (Must)

As a presenter, I want the editor to stay smooth, so that it never gets in my way.

Acceptance criteria:
- [ ] Dragging and resizing elements holds 60 fps on slides with up to 50 elements.
- [ ] A deck of 50 slides opens in under 2 seconds.
- [ ] Thumbnails update without blocking typing.

Design: no board needed (behaviour, not a screen). Follow `design/README.md` for tokens.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### AN-1 Make an element appear (Must)

As a presenter, I want an element to fade or pop into view on a click, so that I can reveal content one point at a time.

Acceptance criteria:
- [ ] Select an element and choose Appear in the animation panel; it is hidden until its step plays.
- [ ] Appear options: instant, fade, or fade with a slight rise.
- [ ] Elements with an Appear step are shown faded in the editor, with a step badge on the canvas.

Design: [`Editor-Animate`](../../design/screenshots/Editor-Animate.png) ([source](../../design/boards/Editor-Animate.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### AN-2 Make an element disappear (Must)

As a presenter, I want an element to leave on a click, so that I can clear the stage for what comes next.

Acceptance criteria:
- [ ] Disappear options: instant or fade out.
- [ ] An element can have both an Appear and a later Disappear step.

Design: [`Editor-Animate`](../../design/screenshots/Editor-Animate.png) ([source](../../design/boards/Editor-Animate.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### TR-3 Transparency in animation and export (Must)

As a presenter, I want opacity to behave the same everywhere, so that what I design is what the audience sees.

Acceptance criteria:
- [ ] Presentation mode and HTML export render opacity identically to the editor.
- [ ] Appear and Disappear animations respect an element's set opacity as their "fully visible" level.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
