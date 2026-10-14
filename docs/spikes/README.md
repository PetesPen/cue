# Sprint 0 spikes

Six short experiments that tested the riskiest assumptions in the plan before anything was built on them. Each ended in a written finding with numbers. The spike code is throwaway and lives in `spikes/`; the findings, not the code, are what we keep.

| Spike | Question | Verdict | What changed because of it |
|---|---|---|---|
| [SP-1 Two-window show](SP-1.md) | Can one click open both windows, kept in sync within 100 ms? | **Sync: go** (about 17 ms). **One click opening both windows: no-go as written** | Decision 10, Option B: one click opens only the audience window; the editor tab becomes the presenter view. PM-1 and PM-3 reworded. Web Locks detect a closed window. |
| [SP-2 Rich text fidelity](SP-2.md) | Do TipTap text and the static renderer wrap identically? | **Go**, with four rules | Static renderer must copy ProseMirror's CSS, add an extra break after a final soft return and set `text-rendering: geometricPrecision`. TipTap (121 KB gzipped) loads only when editing text. Decision 11 opened. |
| [SP-3 Single-file export](SP-3.md) | How big and how slow is a 30-slide image-heavy HTML export? | **Go** | Exports in under 0.4 s (limit 10 s); file is about 1.35 × the photos + 0.16 MB; no external requests, enforced by a policy in the file. No WebP re-encoding at export. |
| [SP-4 Motion at 60 fps](SP-4.md) | Do 50 elements and a full-slide transition hold 60 fps, and does stepping back work? | **Go** | Stepping back is exact. The nightly runner has no graphics card, so its fps budgets are relative; 60 fps is confirmed by hand. Prefer fade and push to zoom. |
| [SP-5 Storage limits](SP-5.md) | What does IndexedDB hold, and what happens when it is full or cleared? | **Go** | Dexie confirmed. Save a deck and its photos in one transaction. Photos stored as raw bytes plus a type. Never await `persist()`. Decision 12 opened. |
| [SP-6 Installable and offline](SP-6.md) | Can a service worker and manifest give offline use and install, with updates that wait? | **Go**, with a fallback for WebKit | Workbox through vite-plugin-pwa confirmed: the whole app (0.6 MB, fonts included) works offline, Chrome and Edge report no installability errors, updates wait for the user, development registers nothing. In WebKit the new version may not take over after the user chooses to update, so "Update now" needs a fallback. Installed-app behaviour and Safari are manual checks. |

## What no spike covered

- **Real Safari and any Mac.** Every spike used Playwright's WebKit, which is not Safari. Safari needs a Mac for: pop-up blocking, closing windows, fullscreen, storage limits and private windows, motion on the graphics chip, and installing as a Dock app.
- **A second display and a projector.**
- **Firefox on Peter's PC** (Playwright's Firefox does not start there; it ran in CI on Linux).
- **Immer commands, undo and the `.slides` zip format**: not spiked. Undo is decided in sprint 2 (one history stack), and the zip library is chosen in sprint 9.

## Running a spike again

`SPIKE=sp-N npx playwright test -c spikes/playwright.config.ts --project=chrome` (also `edge`, `chromium`, `webkit`; the `-blocker` projects are for SP-1). Then `node spikes/sp-N/report.mjs chrome` prints what was recorded. The Spikes workflow on GitHub runs a spike on Linux with Firefox when files under `spikes/` change; it is for the sprint 0 spikes and is deleted at Gate 1.
