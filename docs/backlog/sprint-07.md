# Sprint 7: Transitions and the two windows

- Capacity: 14 engineering days (2 engineers, about 80% focus, 2 weeks)
- Ends with Gate 3: Motion beta (end of sprint 7)
- Next: [sprint-08.md](sprint-08.md) · Previous: [sprint-06.md](sprint-06.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Transitions and the two windows.

## Demo at the review

Preview transitions; start a show in two windows.

## Key automated tests

Two-page end to end; blocked pop-up path; transition frame-time sampling.

## Stories (4)

4 Must, 0 Should. Story order below is the suggested build order.

### TN-4 Preview a transition (Must)

As a presenter, I want to preview a transition in the editor, so that I can judge it before presenting.

Acceptance criteria:
- [x] A Preview button plays the transition from the previous slide into the selected one.
- [x] The first slide has no incoming transition, and its panel says so.

Design: [`Editor-Transition`](../../design/screenshots/Editor-Transition.png) ([source](../../design/boards/Editor-Transition.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### TN-5 Transitions play smoothly (Must)

As a presenter, I want transitions without stutter, so that the show looks professional.

Acceptance criteria:
- [ ] Transitions run at 60 fps on a typical laptop with a fully populated slide. (Frame budgets are tested on the nightly runner; 60 fps on a real laptop and a Mac is a manual check for the review.)
- [x] Animations that belong to the new slide only begin once the transition finishes.
- [x] Moving backward plays the same transition in reverse, or a plain fade if reversing does not make sense.

Design: [`Editor-Transition`](../../design/screenshots/Editor-Transition.png) ([source](../../design/boards/Editor-Transition.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### PM-1 Start a presentation (Must)

As a presenter, I want to start a show from any slide, so that I can rehearse a section or deliver the whole deck.

Acceptance criteria:
- [x] "Present" starts from slide 1, and "Present from current slide" starts where I am.
- [x] One click opens the audience window and turns this tab into the presenter view. Ending the show returns this tab to the editor exactly as it was left. If the browser blocks the audience window, a clear prompt explains how to allow it, and the show can run in this one window without notes. (Option B, decided by Peter on 2026-10-14 after spike SP-1: `docs/spikes/SP-1.md`.) The States board card "presenter window blocked" needs rewording to "audience window"; that design change is Peter's.
- [ ] The audience window goes fullscreen, and slides scale to fit with letterboxing so they are never cropped. (Scaling to fit is tested at several sizes; full screen is a click or F in the window, to check by hand in each browser.)
- [ ] Where the browser allows it, the audience window opens on the second display and the presenter view stays on the laptop. (Built for Chromium's Window Management API; needs a real second display to check.)

Design: [`States`](../../design/screenshots/States.png) ([source](../../design/boards/States.dc.html)), [`Audience`](../../design/screenshots/Audience.png) ([source](../../design/boards/Audience.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### PM-2 Present from the presenter view (Must)

As a presenter, I want a private control view, so that I can see everything I need while the audience sees only the slide.

Acceptance criteria:
- [x] The presenter view shows the current slide, a next-slide preview, speaker notes, a slide navigator, an elapsed timer and the current time.
- [x] The audience window shows only the current slide, with no controls or cursor.

Design: [`Presenter`](../../design/screenshots/Presenter.png) ([source](../../design/boards/Presenter.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
