# Sprint 13: Release hardening

- Capacity: 16 engineering days (2 engineers, about 80% focus, 2 weeks)
- Ends with Gate 5: v1.0 (end of sprint 13)
- Next: [after-v1.md](after-v1.md) · Previous: [sprint-12.md](sprint-12.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Release hardening.

## Demo at the review

A v1.0 release candidate on all four browsers.

## Key automated tests

Full matrix; nightly performance green; zero axe violations; long-session soak test.

## Stories (0)

No new stories. Bugs, performance, documentation, browser matrix.

### Release checklist

- [ ] Full browser matrix green: Chrome, Edge, Firefox, Safari (Safari on a real Mac for the two-window show)
- [ ] Nightly performance suite green: 60 fps drags with 50 elements, 2 s open for 50 slides, 10 s export for 30 slides, transition frame times
- [ ] Zero axe violations on every main screen; keyboard-only run through the whole app
- [ ] Long-session soak test (hours of editing, repeated present / end cycles) with no memory growth or lost deck
- [ ] Manual checklist from the test strategy (real second display and projector, trackpad pinch zoom, fonts on Windows, macOS and Linux, a full rehearsal of a real talk)
- [ ] Documentation: README for users, a "your decks live in this browser" explainer, changelog entry, release tag

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
