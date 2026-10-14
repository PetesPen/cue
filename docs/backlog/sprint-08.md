# Sprint 8: A complete presenting experience

- Capacity: 14 engineering days (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-09.md](sprint-09.md) · Previous: [sprint-07.md](sprint-07.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

A complete presenting experience.

## Demo at the review

Rehearse a full talk: synced windows, resizable notes, next preview, navigation.

## Key automated tests

Sync under 100 ms; divider and text size memory; keyboard navigation table tests.

## Stories (4)

4 Must, 0 Should. Story order below is the suggested build order.

### PM-3 Keep both windows in sync (Must)

As a presenter, I want both windows to show the same moment, so that the audience never sees a mismatch.

Acceptance criteria:
- [ ] Slide changes and animation steps made in either window appear in the other within 100 ms.
- [ ] If one window is closed, the other keeps working, and a "reconnect" action reopens the second window.
- [ ] Ending the show from either window closes both.

Design: [`Presenter`](../../design/screenshots/Presenter.png) ([source](../../design/boards/Presenter.dc.html)), [`Audience`](../../design/screenshots/Audience.png) ([source](../../design/boards/Audience.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### PM-4 Read and resize notes (Must)

As a presenter, I want to read my notes in a panel I can resize, so that I can fit the text to my eyes and screen.

Acceptance criteria:
- [ ] A draggable divider resizes the notes panel against the slide previews, and the presenter view reflows smoothly.
- [ ] A text size control (A− and A+) scales the notes independently of the panel size.
- [ ] Long notes scroll within the panel.
- [ ] The panel size and text size are remembered between shows.

Design: [`Presenter`](../../design/screenshots/Presenter.png) ([source](../../design/boards/Presenter.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### PM-5 Preview what comes next (Must)

As a presenter, I want to see the next slide, so that I can prepare my next line before I click.

Acceptance criteria:
- [ ] The next-slide preview shows the following slide in its starting state.
- [ ] When animation steps remain on the current slide, the preview shows the next step instead and says so ("Next: step 2 of 3").
- [ ] On the last slide, the preview reads "End of presentation".

Design: [`Presenter`](../../design/screenshots/Presenter.png) ([source](../../design/boards/Presenter.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### PM-6 Navigate the deck (Must)

As a presenter, I want to move around the show quickly, so that I can respond to questions.

Acceptance criteria:
- [ ] Right arrow, Space, Enter and click advance by one animation step, then to the next slide.
- [ ] Left arrow and Backspace go back one step.
- [ ] A scrolling slide navigator in the presenter view lets me click any slide to jump to it.
- [ ] Typing a slide number then Enter jumps to that slide.
- [ ] B blanks the audience window to black, and W to white, until pressed again.
- [ ] Esc ends the show.

Design: [`Presenter`](../../design/screenshots/Presenter.png) ([source](../../design/boards/Presenter.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
