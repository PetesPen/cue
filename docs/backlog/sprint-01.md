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
- [x] Layout: thumbnail sidebar on the left, canvas in the centre, and a context-sensitive format panel on the right that shows only what applies to the selection. (e2e measures rail 208, inspector 296, notes 124 px; nothing can be selected yet, so the panel says "Nothing selected")
- [x] A slim top toolbar holds the core actions; everything else lives in menus or the right-click menu. (the toolbar holds Add slide, the only core action that exists; the other actions and the right-click menu arrive with their stories)
- [x] A restrained palette, generous spacing, one typeface for the interface, and subtle motion. (`tests/styles.test.ts`: no colour outside the tokens or the marked board values, one UI font, no motion over 200 ms, reduced motion honoured; spacing and feel are for Peter to judge)

Design: [`Style-Guide`](../../design/screenshots/Style-Guide.png) ([source](../../design/boards/Style-Guide.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SL-1 Add a slide (Must)

As a presenter, I want to add a new slide after the current one, so that I can build my deck in order.

Acceptance criteria:
- [x] A visible "+" button and the shortcut Ctrl/Cmd+M add a blank 16:9 slide directly after the selected slide. (button, New slide, Ctrl+M and Cmd+M tested; on a Mac the system may keep Cmd+M for Minimize, so Ctrl+M is the one that works there: decision 15)
- [x] The new slide is selected and ready to edit immediately. (selected, and keyboard focus moves to the canvas; nothing on a slide can be edited until EL-1)
- [x] A new deck starts with one blank slide.

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SL-2 Navigate between slides (Must)

As a presenter, I want to click a thumbnail to open a slide, so that I can jump around quickly.

Acceptance criteria:
- [x] The sidebar shows a live thumbnail of every slide with its number.
- [x] The current slide is clearly highlighted. (accent outline, bold accent number and aria-selected, so not colour alone)
- [x] Up and Down arrows move the selection when the sidebar has focus. (Home and End too)

Design: [`Main`](../../design/screenshots/Main.png) ([source](../../design/boards/Main.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SV-1 Autosave locally (Must)

As a presenter, I want my work saved continuously, so that I never lose a deck to a closed tab.

Acceptance criteria:
- [x] Changes save within 2 seconds of the last edit, with a quiet "Saved" indicator. (0.5 s of quiet or 1.5 s at most)
- [ ] Reopening the app restores the deck exactly as left, including images. (decks: shown by e2e on three engines; images: the store saves and returns photos byte for byte in one transaction, but a photo cannot be added until EL-4, sprint 4)
- [x] Storage uses the browser's database storage, not the small key-value store, so image-heavy decks fit. (IndexedDB through Dexie; `tests/storage-rules.test.ts` keeps localStorage out of the app)
- [ ] (partly: warning and banner are done, the Export deck action waits for SV-3 in sprint 9; until then they offer Manage storage and Try again) If storage is nearly full (90% or more of the quota the browser reports through `navigator.storage.estimate()`; real quotas are about 1 GB to 10 GB), a warning shows the real numbers and offers to export the deck. If a save fails because the store is full, a stronger banner says changes cannot be saved and offers Export deck (decided by Peter, 2026-10-15).

Design: [`States`](../../design/screenshots/States.png) ([source](../../design/boards/States.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SV-2 Manage multiple decks (Must)

As a presenter, I want a home screen of my decks, so that I can work on more than one presentation.

Acceptance criteria:
- [x] The home screen lists decks with a thumbnail, title and last-edited date, newest first.
- [x] I can create, rename, duplicate and delete a deck; delete asks for confirmation.
- [x] Titles can be edited inline in the editor header.

Design: [`Home`](../../design/screenshots/Home.png) ([source](../../design/boards/Home.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
