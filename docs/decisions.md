# Decisions

Keep this file current. One line per decision, newest at the bottom of each table.

## Open (needed before sprint 0 starts)

| # | Decision | Notes | Status |
|---|---|---|---|
| 1 | Team and start date: how many engineers, and when does sprint 0 start? | Turns sprint numbers into calendar dates. The plan assumes two engineers at about 80% focus (16 engineering days per sprint). One engineer roughly doubles the calendar time. | Team: Claude is the engineering team (2026-10-14). Start date not given; sprint 0 planning began 2026-10-14. Calendar length of a sprint to be re-measured after sprint 2 |
| 2 | The stack | Confirm TypeScript, React, TipTap and Dexie, or name a preference, before the spikes begin. See `CLAUDE.md`. | React confirmed (2026-10-14). The rest stays proposed until the spikes at Gate 1 |
| 3 | Hosting | Which static host and address for the live site and the pull-request previews. | Netlify (2026-10-14). Address not chosen: default `*.netlify.app` until Peter names one |
| 4 | A second real deck, besides Autumn Launch | To rebuild at Gate 3 as a test that the editor can make something worth presenting. | Open |
| 5 | Phone as a remote control | The plan assumes it is out of v1. | Settled: out of scope for now (2026-10-14) |
| 6 | Installable offline editor (PWA) | The plan assumes it is out of v1; exported HTML already works offline. | Settled: in v1 (2026-10-14). New story UX-7 (priority Must is proposed; Peter can change it), planned in sprint 9, with spike SP-6 in sprint 0 |

## Settled (from the user stories)

- Storage is local only: browser storage, no accounts, no sharing links.
- Export is a proprietary deck file (`.slides`, re-importable) plus a standalone HTML presentation.
- Transparency applies to every element: images, shapes and text.
- Text is rich: mixed formatting within a box, and a choice of fonts.
- Slides are 16:9 only. Themes and templates only if they are easy (after v1.0).
- Animations run click by click: one step per click, in a set order.
- Supported browsers: current Chrome, Edge, Firefox and Safari on desktop.
- Cue is installable and works offline (PWA), as story UX-7.
- Both presentation windows run on the same computer and browser.
- The product owner is Peter: a 45-minute review each sprint and quick answers in between.

## Stack (proposed; confirm at Gate 1, the end of sprint 0)

TypeScript strict, React, Vite, Immer patches for commands, TipTap for rich text, Web Animations API, Dexie over IndexedDB, BroadcastChannel, zip for `.slides`, Vitest, fast-check, Playwright, axe-core. Fallbacks for each risky part are in the spike table in `docs/development-plan.md`.

## Log

| Date | Decision | Why | Decided by |
|---|---|---|---|
| 2026-10-14 | Plan, stories and design handed to Claude Code | Start of the build | Peter |
| 2026-10-14 | Working name is **Cue** | Names the click-by-click cue; the logo's yellow dot matches the yellow step badge. Short, works as a package name. Not checked for trademark or domain, so confirm before any public launch. The design wordmark still reads "Slides" until Peter decides to change it | Peter |
| 2026-10-14 | Team is Claude; stack is React; hosting is Netlify; phone remote out of scope for now | Peter's answers to open decisions 1, 2, 3 and 5 | Peter |
| 2026-10-14 | PWA is in v1 as story UX-7 (sprint 9); spike SP-6 added to sprint 0 | Peter: "yes please". Totals now 57 stories, 38 Must, 212 days. Sprint 0 is about 16.5 days, and the visual-container pinning moves to sprint 1 if it runs behind | Peter |
| 2026-10-14 | Sprint 0 plan approved. Repo moves out of OneDrive to `C:\Users\peter\Projects\cue`; commits use peter.is.brainy@gmail.com | `node_modules` and `.git` do not mix with OneDrive sync | Peter |
