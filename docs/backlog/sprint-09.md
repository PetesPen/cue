# Sprint 9: Deck files, browsers and offline use

- Capacity: 16 engineering days (was 12; UX-7 added 2026-10-14)
- Next: [sprint-10.md](sprint-10.md) · Previous: [sprint-08.md](sprint-08.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Deck files, browsers and offline use.

## Demo at the review

Save a deck file and open it in another browser; install Cue and open it with the network off.

## Key automated tests

File round-trip property test; corrupt-file rejection; four-browser end to end; offline reload with the service worker.

## Stories (3)

3 Must, 0 Should. Story order below is the suggested build order.

### SV-3 Save and open a deck file (Must)

As a presenter, I want to save a deck to a file and open it again, so that I can back it up and move it between computers.

Acceptance criteria:
- [ ] "Save as file" downloads a single self-contained file in the app's own format, with images and fonts included.
- [ ] Opening the file recreates the deck exactly, including animations, transitions and notes.
- [ ] Files from a newer version of the app open with a clear message if some features are unsupported.
- [ ] A corrupt or foreign file is rejected with a clear message and nothing is overwritten.
- [ ] Carried over from sprint 1 (SV-1): the "Storage is almost full" and "Changes can't be saved" banners offer **Export deck** (today they offer Manage storage and Try again), and the delete confirmation says "Export a copy first if you might want it back". Also show a deck Cue cannot read as a card with a Delete action (decision 17).

Design: [`Home`](../../design/screenshots/Home.png) ([source](../../design/boards/Home.dc.html)), [`Export-Dialog`](../../design/screenshots/Export-Dialog.png) ([source](../../design/boards/Export-Dialog.dc.html)), [`States`](../../design/screenshots/States.png) ([source](../../design/boards/States.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### UX-5 Works in modern browsers (Must)

As a presenter, I want it to run in my browser, so that I can use it anywhere without installing anything.

Acceptance criteria:
- [ ] Supported: current versions of Chrome, Edge, Firefox and Safari on desktop.
- [ ] Presentation mode's two-window behaviour is tested in all four, with any browser-specific limits explained in the app.
- [ ] Phone-sized screens show a friendly "use a larger screen to edit" message, though HTML exports play on any device.

Design: [`States`](../../design/screenshots/States.png) ([source](../../design/boards/States.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### UX-7 Install and work offline (Must)

As a presenter, I want to install Cue and open it with no internet connection, so that I can build and present anywhere, including a venue with no Wi-Fi.

Acceptance criteria:
- [ ] After one visit, the app opens and my decks load with the network switched off.
- [ ] Where the browser supports installing, a clear "Install" action adds Cue as an app with its own window and icon. Where it does not, no install prompt shows and the app works in a tab.
- [ ] A new version waits until I choose to update, never replaces the app while I am editing, and never touches my stored decks.
- [ ] Starting a show from the installed app opens the audience window and keeps it in sync with the presenter view, or explains any browser-specific limit.
- [ ] The app makes requests only to its own files.

Design: none yet. The install action and the update prompt should reuse the toast and banner styles in [`States`](../../design/screenshots/States.png). If a new screen is needed, describe it and ask Peter.

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story): load once, switch the context offline, reload, open a deck. Manual: the real install flow in Chrome, Edge and Safari, and the update prompt. Spike SP-6 in sprint 0 settles the approach.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
