# Sprint 6: Motion and sequencing

- Capacity: 16 engineering days (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-07.md](sprint-07.md) · Previous: [sprint-05.md](sprint-05.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Motion and sequencing.

## Demo at the review

Move an element along a ghost path, reorder click steps, pick a transition.

## Key automated tests

Step-order table tests; preview returns elements to editing positions.

## Stories (4)

4 Must, 0 Should. Story order below is the suggested build order.

### AN-3 Move an element (Must)

As a presenter, I want to animate an element from one position to another, so that I can show change, flow and emphasis.

Acceptance criteria:
- [ ] Move shows a ghost of the end position that I drag into place on the canvas, with a dotted path from start to end.
- [ ] Move animates position only; optional resize and rotation changes are Could.
- [ ] The element ends at the new position, and stays there for later steps.

Design: [`Editor-Animate`](../../design/screenshots/Editor-Animate.png) ([source](../../design/boards/Editor-Animate.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### AN-5 Sequence steps click by click (Must)

As a presenter, I want to order animations and group some to play together, so that I control the pace of a reveal.

Acceptance criteria:
- [ ] The animation panel lists steps in play order, each showing its element and effect.
- [ ] Drag steps to reorder them.
- [ ] Each step is set to "On click" or "With previous", so several elements can animate on a single click.
- [ ] Removing an element removes its steps.

Design: [`Editor-Animate`](../../design/screenshots/Editor-Animate.png) ([source](../../design/boards/Editor-Animate.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### AN-6 Preview animations (Must)

As a presenter, I want to preview a slide's animations without leaving the editor, so that I can fine-tune them quickly.

Acceptance criteria:
- [ ] A Preview button plays the slide's steps in the editor, and clicking advances step by step.
- [ ] After a preview, every element returns to its editing position.

Design: [`Editor-Animate`](../../design/screenshots/Editor-Animate.png) ([source](../../design/boards/Editor-Animate.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### TN-1 Choose a transition (Must)

As a presenter, I want to pick how a slide arrives, so that moving between slides feels polished.

Acceptance criteria:
- [ ] Options: None, Fade, Slide (from the right), Push, and Zoom.
- [ ] The choice is made in a transition panel for the selected slide, and shown as a small badge on its thumbnail.
- [ ] The default is None.

Design: [`Editor-Transition`](../../design/screenshots/Editor-Transition.png) ([source](../../design/boards/Editor-Transition.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
