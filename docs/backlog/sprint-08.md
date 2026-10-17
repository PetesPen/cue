# Sprint 8: A complete presenting experience

- Capacity: 14 engineering days (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-09.md](sprint-09.md) · Previous: [sprint-07.md](sprint-07.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

A complete presenting experience.

## Demo at the review

Rehearse a full talk: synced windows, resizable notes, next preview, navigation; set a transition's direction and length and apply it to every slide.

## Key automated tests

Sync under 100 ms; divider and text size memory; keyboard navigation table tests.

## Stories (6)

TN-2 and TN-3 moved here from sprint 11 on 2026-10-17: sprint 7 had built much of PM-3 to PM-6 (see `docs/plans/sprint-08.md`), and Peter approved the move with the plans.

4 Must, 2 Should. Story order below is the suggested build order.

### PM-3 Keep both windows in sync (Must)

As a presenter, I want both windows to show the same moment, so that the audience never sees a mismatch.

Acceptance criteria:
- [x] Slide changes and animation steps made in either window appear in the other within 100 ms.
- [x] If the audience window is closed, the presenter view keeps working, and a "reconnect" action reopens the audience window and catches it up. If the presenter tab is closed, the audience window notices and closes. (Use Web Locks to notice a gone window: `docs/spikes/SP-1.md`.)
- [x] Ending the show from either window closes the audience window and returns the presenter tab to the editor.

Design: [`Presenter`](../../design/screenshots/Presenter.png) ([source](../../design/boards/Presenter.dc.html)), [`Audience`](../../design/screenshots/Audience.png) ([source](../../design/boards/Audience.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### PM-4 Read and resize notes (Must)

As a presenter, I want to read my notes in a panel I can resize, so that I can fit the text to my eyes and screen.

Acceptance criteria:
- [x] A draggable divider resizes the notes panel against the slide previews, and the presenter view reflows smoothly.
- [x] A text size control (A− and A+) scales the notes independently of the panel size.
- [x] Long notes scroll within the panel.
- [x] The panel size and text size are remembered between shows.

Design: [`Presenter`](../../design/screenshots/Presenter.png) ([source](../../design/boards/Presenter.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### PM-5 Preview what comes next (Must)

As a presenter, I want to see the next slide, so that I can prepare my next line before I click.

Acceptance criteria:
- [x] The next-slide preview shows the following slide in its starting state.
- [x] When animation steps remain on the current slide, the preview shows the next step instead and says so ("Next: step 2 of 3").
- [x] On the last slide, the preview reads "End of presentation".

Design: [`Presenter`](../../design/screenshots/Presenter.png) ([source](../../design/boards/Presenter.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### PM-6 Navigate the deck (Must)

As a presenter, I want to move around the show quickly, so that I can respond to questions.

Acceptance criteria:
- [x] Right arrow, Space, Enter and click advance by one animation step, then to the next slide.
- [x] Left arrow and Backspace go back one step.
- [x] A scrolling slide navigator in the presenter view lets me click any slide to jump to it.
- [x] Typing a slide number then Enter jumps to that slide.
- [x] B blanks the audience window to black, and W to white, until pressed again.
- [x] Esc ends the show.

Design: [`Presenter`](../../design/screenshots/Presenter.png) ([source](../../design/boards/Presenter.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### TN-2 Set duration and direction (Should)

As a presenter, I want to adjust how long a transition takes and which way it moves, so that it suits the moment.

Acceptance criteria:
- [x] Duration from 0.2 to 3 seconds, defaulting to 0.6 seconds.
- [x] Slide and Push can come from the left, right, top or bottom.

Design: [`Editor-Transition`](../../design/screenshots/Editor-Transition.png) ([source](../../design/boards/Editor-Transition.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### TN-3 Apply to all slides (Should)

As a presenter, I want to apply one transition to the whole deck, so that I do not have to set it slide by slide.

Acceptance criteria:
- [x] An "Apply to all slides" button copies the transition settings to every slide.
- [x] It can be undone in one step.

Design: [`Editor-Transition`](../../design/screenshots/Editor-Transition.png) ([source](../../design/boards/Editor-Transition.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
