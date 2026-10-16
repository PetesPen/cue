# Sprint 11: Polish: layers, motion, transitions

- Capacity: 16 engineering days (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-12.md](sprint-12.md) · Previous: [sprint-10.md](sprint-10.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Polish: layers, motion, transparency.

## Demo at the review

Layers panel, step back, fill and text transparency.

## Key automated tests

Layer drag tests; step-back resolver tests.

## Stories (4)

AN-4 (timing and easing controls) moved to sprint 5 on 2026-10-16: Peter asked for it with the first animations. TN-2 and TN-3 (transition direction and duration, apply to all) moved to sprint 8 on 2026-10-17: sprint 7 had built much of sprint 8, and Peter approved the move with the plans.

0 Must, 4 Should. Story order below is the suggested build order.

### ZO-2 See and rearrange layers (Should)

As a presenter, I want a layers panel, so that I can select and reorder elements that are hidden behind others.

Acceptance criteria:
- [ ] The panel lists every element on the slide, top layer first, with a small preview and a name.
- [ ] Drag a row to change its stacking position; the canvas updates live.
- [ ] Clicking a row selects the element on the canvas, and selecting on the canvas highlights the row.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### ZO-3 Lock, hide and rename layers (Should)

As a presenter, I want to lock, hide and name elements, so that a busy slide stays manageable.

Acceptance criteria:
- [ ] A locked element cannot be moved or edited by accident, but can still be selected from the panel.
- [ ] A hidden element is invisible in both the editor and presentation mode, and can be shown again from the panel.
- [ ] Double-click a layer name to rename it; names also label animation steps.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### TR-2 Control fill and text transparency separately (Should)

As a presenter, I want separate opacity for a shape's fill, border and text, so that I can have a see-through panel with fully solid text.

Acceptance criteria:
- [ ] Fill, border and text colour pickers each include an alpha slider.
- [ ] Element opacity and colour alpha multiply together, and the format panel shows the result.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html)), [`Editor-Text`](../../design/screenshots/Editor-Text.png) ([source](../../design/boards/Editor-Text.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### AN-7 Go back a step (Should)

As a presenter, I want to step backward during a show, so that I can recover from a misclick or revisit a point.

Acceptance criteria:
- [ ] The Left arrow or Backspace reverses the last animation step, then returns to the previous slide's final state.

Design: [`Editor-Animate`](../../design/screenshots/Editor-Animate.png) ([source](../../design/boards/Editor-Animate.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
