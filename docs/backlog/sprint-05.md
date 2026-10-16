# Sprint 5: Keyboard, speed and first animations

- Capacity: 14 engineering days (the plan, `docs/plans/sprint-05.md`, comes to 19 with SL-5, AN-4 and the first Preview bar; Peter approved that on 2026-10-16) (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-06.md](sprint-06.md) · Previous: [sprint-04.md](sprint-04.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Keyboard, speed and first animations.

## Demo at the review

Drive the editor by keyboard; set a slide background; elements fade in and out on click in preview, with duration, delay and easing you choose.

## Key automated tests

Performance budgets for 50 elements and 50 slides; motion resolver unit tests; easing and duration unit tests; opacity match across renderers.

## Stories (7)

5 Must, 2 Should. Story order below is the suggested build order.

### SL-5 Set a slide background (Should)

As a presenter, I want to set a background colour or image, so that slides can have their own look.

Pulled into this sprint by Peter on 2026-10-16 (the Gate 2 rebuild needed it). Built here: the solid colour and "Apply to all slides". The image and its opacity stay in sprint 12.

Acceptance criteria:
- [x] Choose a solid colour or an image, with an optional opacity. (Solid colour here, in the Slide section of the Design tab with nothing selected, through the colour picker; the image and its opacity are carried to sprint 12.)
- [x] "Apply to all slides" is available.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

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

### AN-4 Control timing and feel (Should)

As a presenter, I want duration, delay and easing, so that motion feels deliberate.

Moved here from sprint 11 by Peter on 2026-10-16.

Acceptance criteria:
- [ ] Duration from 0.1 to 5 seconds and delay from 0 to 5 seconds.
- [ ] Easing presets: linear, ease-in, ease-out and ease-in-out.
- [ ] Sensible defaults (0.5 s, ease-out) mean most steps need no tuning.

Design: [`Editor-Animate`](../../design/screenshots/Editor-Animate.png) ([source](../../design/boards/Editor-Animate.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
