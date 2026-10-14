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

## Open (found during the build)

| # | Decision | Notes | Status |
|---|---|---|---|
| 7 | Italic for fonts that have none | Bricolage Grotesque, Space Grotesk and Caveat have no italic design. If a user presses italic, the browser slants the upright letters itself, and that slant can differ between browsers, which puts the one-pixel match with the HTML export (SV-5) at risk. Options: hide the italic button for those three fonts (my recommendation), or accept the difference. Needed before sprint 3 (EL-2) | Open |
| 8 | Languages beyond Western European | Only the Latin subset of each font is bundled (English and Western European text, euro sign and common punctuation). Characters outside it, such as Polish, Czech, Vietnamese, Greek or Cyrillic, fall back to the computer's own font, so they would look different on another machine. Adding Latin Extended costs roughly 30 to 50 KB per file. Needed before sprint 3 (EL-2) | Open (assumed Latin only) |

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

Pinned in F1 (2026-10-14), from the npm registry that day: React 19.3, Vite 8.3, `@vitejs/plugin-react` 6.1, Prettier 3.9, TypeScript **6.0.3** and ESLint **9.39**. Why not newer: TypeScript 7.0 is out, but `typescript-eslint` only supports TypeScript below 6.1; ESLint 10 is out, but `eslint-plugin-jsx-a11y` does not declare support for it. npm marks ESLint 9.39 as no longer supported, which matters little for a dev-only tool. Revisit both at Gate 1 and again whenever those two plugins publish support. Node 20.19 or newer; `.nvmrc` says 24.

Test tooling pinned in F2 (2026-10-14): Vitest 5.0 with `@vitest/browser-playwright` (component tests in real Chromium) and `vitest-browser-react` 2.3, fast-check 4.10, fake-indexeddb 6.2, Playwright 1.64 and `@axe-core/playwright` 4.13. Playwright runs against `vite preview` of the production build.

Known local problem: on Peter's Windows PC, Playwright's Firefox 157 will not start. Windows reports a side-by-side configuration error ("dependent assembly mozglue could not be found"), even though `mozglue.dll` is present and a clean reinstall did not help. Chromium and WebKit run fine, and the Visual C++ 2022 runtime (14.51) is installed. A repair of the Visual C++ redistributable is the likely fix and needs admin rights, so it is Peter's call. Firefox runs in CI on Linux. Until then Firefox is not checked on this machine, and real Firefox on Windows stays a manual check.

Fonts confirmed in F3 (2026-10-14): all seven families (Instrument Sans, Figtree, Bricolage Grotesque, DM Serif Display, Space Grotesk, JetBrains Mono, Caveat) are under the SIL Open Font License 1.1; the licence text and copyright of each was read from its Fontsource 5.3.0 package and is kept next to the files in `src/fonts/<family>/OFL.txt`. DM Serif Display reserves the name "Source" (Adobe), which only restricts modified versions using that name. The files are used unmodified. Two duties for later sprints: the licence text of every embedded family must travel inside a `.slides` file and a standalone HTML export (SV-3, SV-4), and the fonts may not be sold on their own. Source, versions and SHA-256 of every file are in `src/fonts/README.md`.

## Log

| Date | Decision | Why | Decided by |
|---|---|---|---|
| 2026-10-14 | Plan, stories and design handed to Claude Code | Start of the build | Peter |
| 2026-10-14 | Working name is **Cue** | Names the click-by-click cue; the logo's yellow dot matches the yellow step badge. Short, works as a package name. Not checked for trademark or domain, so confirm before any public launch. The design wordmark still reads "Slides" until Peter decides to change it | Peter |
| 2026-10-14 | Team is Claude; stack is React; hosting is Netlify; phone remote out of scope for now | Peter's answers to open decisions 1, 2, 3 and 5 | Peter |
| 2026-10-14 | PWA is in v1 as story UX-7 (sprint 9); spike SP-6 added to sprint 0 | Peter: "yes please". Totals now 57 stories, 38 Must, 212 days. Sprint 0 is about 16.5 days, and the visual-container pinning moves to sprint 1 if it runs behind | Peter |
| 2026-10-14 | Sprint 0 plan approved. Repo moves out of OneDrive to `C:\Users\peter\Projects\cue`; commits use peter.is.brainy@gmail.com | `node_modules` and `.git` do not mix with OneDrive sync | Peter |
| 2026-10-14 | Layering rule spelled out: `model` imports nothing; `render` imports `model`; `storage` imports `model`, `render`; `editor` and `present` import `model`, `render`, `storage`, never each other | `CLAUDE.md` said editor and present may use render and model, but both must also reach storage to open and save decks. This is my reading of "one way only"; Peter can change it | Claude |
