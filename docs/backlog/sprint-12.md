# Sprint 12: Polish: layout, timer, access

- Capacity: 14 engineering days (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-13.md](sprint-13.md) · Previous: [sprint-11.md](sprint-11.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Polish: layout, timer, access.

## Demo at the review

Image backgrounds, timer colours, zoom, keyboard-only use.

## Key automated tests

Timer state tests; full axe scan and keyboard end to end.

## Stories (4)

EL-6 (align and snap) moved to sprint 6 on 2026-10-16: Peter values the snap lines and asked for them earlier. SL-5 is split: its colour part is in sprint 5.

0 Must, 4 Should. Story order below is the suggested build order.

### SL-5 Set a slide background: the image (Should)

Carried from sprint 5, where the solid colour and "Apply to all slides" were built.

Acceptance criteria:
- [ ] Choose an image as the background, with an optional opacity.

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

### TN-6 Morph transition (Should; proposed, Peter decides with the plans for sprints 11 and 12)

As a presenter, I want a Morph transition, so that when the next slide has the same things arranged differently, they glide from where they were to where they now are instead of cutting.

Added 2026-10-18 at Peter's request. About 6 days (between a medium and a large story); this sprint is loaded at 8 of 14 days, so it fits here without swapping anything out; sooner means swapping it with ZO-3 in sprint 11.

Acceptance criteria: see `docs/user-stories.md`, TN-6.

How it would work (Claude's feasibility note, 2026-10-18): it needs no new engine. The stage already draws the two slides as two layers and moves only whole layers. Morph would move the matched elements instead: each incoming element starts where its twin was (position, size, turn, opacity) and glides to its own place, while the outgoing twin glides to the incoming place and fades, so a colour change reads as a dissolve on the move. Only `transform` and `opacity` change, so the budget of TN-5 applies as it is. What is missing is knowing which elements are twins: duplicating a slide gives every element a new id today, so an element would carry a small optional "lineage" mark that copies keep (an additive change to the deck, with a schema step). In-between frames stretch an element whose width and height change at different rates (a text box becoming a narrower one); the end state is always exact. The exported page gets it for free, as it uses the same stage.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
