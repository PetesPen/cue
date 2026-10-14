# Sprint 1: Decks, shell and saving

- Capacity: 16 engineering days (2 engineers, about 80% focus, 2 weeks)
- Next: [sprint-02.md](sprint-02.md) · Previous: [sprint-00.md](sprint-00.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Decks, shell and saving.

## Demo at the review

Create decks, add slides, close the tab and find everything again.

## Key automated tests

Persistence integration tests; create-and-reload end to end; axe on the shell.

## Stories (5)

5 Must, 0 Should. Story order below is the suggested build order.

### UX-1 A sleek, uncluttered editor (Must)

As a presenter, I want a clean interface, so that I can focus on my content.

Acceptance criteria:
- [ ] Layout: thumbnail sidebar on the left, canvas in the centre, and a context-sensitive format panel on the right that shows only what applies to the selection.
- [ ] A slim top toolbar holds the core actions; everything else lives in menus or the right-click menu.
- [ ] A restrained palette, generous spacing, one typeface for the interface, and subtle motion.
- [ ] Light and dark interface modes follow the system setting; the slide itself is never affected.

Design: [`Style-Guide`](../../design/screenshots/Style-Guide.png) ([source](../../design/boards/Style-Guide.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SL-1 Add a slide (Must)

As a presenter, I want to add a new slide after the current one, so that I can build my deck in order.

Acceptance criteria:
- [ ] A visible "+" button and the shortcut Ctrl/Cmd+M add a blank 16:9 slide directly after the selected slide.
- [ ] The new slide is selected and ready to edit immediately.
- [ ] A new deck starts with one blank slide.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SL-2 Navigate between slides (Must)

As a presenter, I want to click a thumbnail to open a slide, so that I can jump around quickly.

Acceptance criteria:
- [ ] The sidebar shows a live thumbnail of every slide with its number.
- [ ] The current slide is clearly highlighted.
- [ ] Up and Down arrows move the selection when the sidebar has focus.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SV-1 Autosave locally (Must)

As a presenter, I want my work saved continuously, so that I never lose a deck to a closed tab.

Acceptance criteria:
- [ ] Changes save within 2 seconds of the last edit, with a quiet "Saved" indicator.
- [ ] Reopening the app restores the deck exactly as left, including images.
- [ ] Storage uses the browser's database storage, not the small key-value store, so image-heavy decks fit.
- [ ] If storage is nearly full (90% or more of the quota the browser reports through `navigator.storage.estimate()`; real quotas are about 1 GB to 10 GB), a warning shows the real numbers and offers to export the deck. If a save fails because the store is full, a stronger banner says changes cannot be saved and offers Export deck (decided by Peter, 2026-10-15).

Design: [`States`](../../design/screenshots/States.png) ([source](../../design/boards/States.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SV-2 Manage multiple decks (Must)

As a presenter, I want a home screen of my decks, so that I can work on more than one presentation.

Acceptance criteria:
- [ ] The home screen lists decks with a thumbnail, title and last-edited date, newest first.
- [ ] I can create, rename, duplicate and delete a deck; delete asks for confirmation.
- [ ] Titles can be edited inline in the editor header.

Design: [`Home`](../../design/screenshots/Home.png) ([source](../../design/boards/Home.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
