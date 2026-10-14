# Sprint 12: Polish: layout, timer, access

- Capacity: 14 engineering days (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-13.md](sprint-13.md) · Previous: [sprint-11.md](sprint-11.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Polish: layout, timer, access.

## Demo at the review

Backgrounds, snapping, timer colours, zoom, keyboard-only use.

## Key automated tests

Snap and align unit tests; timer state tests; full axe scan and keyboard end to end.

## Stories (5)

0 Must, 5 Should. Story order below is the suggested build order.

### SL-5 Set a slide background (Should)

As a presenter, I want to set a background colour or image, so that slides can have their own look.

Acceptance criteria:
- [ ] Choose a solid colour or an image, with an optional opacity.
- [ ] "Apply to all slides" is available.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### EL-6 Align and snap (Should)

As a presenter, I want smart guides and alignment tools, so that slides look tidy without effort.

Acceptance criteria:
- [ ] Elements snap to slide edges, slide centre and other elements, with visible guide lines.
- [ ] Align left, centre, right, top, middle and bottom for a selection.
- [ ] Distribute horizontally and vertically for three or more elements.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### PM-7 Time my talk (Should)

As a presenter, I want a timer, so that I stay on schedule.

Acceptance criteria:
- [ ] The timer starts with the first advance, and can be paused and reset.
- [ ] An optional target duration turns the timer amber at 90% and red when exceeded.

Design: [`Presenter`](../../design/screenshots/Presenter.png) ([source](../../design/boards/Presenter.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### UX-4 Zoom and fit (Should)

As a presenter, I want to zoom the canvas, so that I can do detailed work.

Acceptance criteria:
- [ ] "Fit to window" is the default and re-fits when the window resizes.
- [ ] Zoom in and out with the shortcuts, the pinch gesture or a zoom control, with a reset to fit.

Design: no board needed (behaviour, not a screen). Follow `design/README.md` for tokens.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### UX-6 Accessible by default (Should)

As a presenter, I want the app to be usable with a keyboard and readable by everyone, so that nobody is excluded.

Acceptance criteria:
- [ ] All controls are reachable by keyboard with visible focus.
- [ ] Interface text meets WCAG AA contrast.
- [ ] Images can have alt text, which is carried into the HTML export.

Design: no board needed (behaviour, not a screen). Follow `design/README.md` for tokens.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
