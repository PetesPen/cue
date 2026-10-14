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
| 7 | Italic for fonts that have none | Bricolage Grotesque, Space Grotesk and Caveat have no italic design. If a user presses italic, the browser slants the upright letters itself, and that slant can differ between browsers, which puts the one-pixel match with the HTML export (SV-5) at risk. Options: hide the italic button for those three fonts (my recommendation), or accept the difference. | Settled 2026-10-14: hide the italic button for those three fonts. Added to EL-2 as an acceptance criterion |
| 8 | Languages beyond Western European | Only the Latin subset of each font is bundled (English and Western European text, euro sign and common punctuation). Characters outside it, such as Polish, Czech, Vietnamese, Greek or Cyrillic, fall back to the computer's own font, so they would look different on another machine. Adding Latin Extended costs roughly 30 to 50 KB per file. | Settled 2026-10-14: Latin only for v1. Revisit only if Peter asks |
| 9 | Off-scale values in the boards, and the top-bar title | The Main board uses a few values the token scale does not have (10 px logo gap, 22 px logo, 7 px dot, 36 px canvas padding, 44 px tab height, 20 px and 6 px notes spacing). `design/README.md` says to ask before adding values, so the shell copies them from the board as commented literals in `src/editor/shell.css`. Also, the shell's top bar shows "Cue" where the board shows the deck title, because no deck exists yet. Question: add those values to the tokens, or change the board? | Settled 2026-10-14, Peter left it to Claude: leave `design/` and the tokens untouched and keep the board's values as commented literals in the shell styles. The top bar shows "Cue" until a deck is open, then the deck title as in the board (SV-2, sprint 1) |
| 10 | How a show opens its windows (PM-1) | Spike SP-1 (`docs/spikes/SP-1.md`): in real Chrome, Edge and Firefox with the default pop-up blocker, one click opens only the first new window and the second is blocked until the user allows pop-ups for the site. PM-1 says one click opens both. **Option A** (as written): try both, and show the "blocked" card in the design (Try again, or Present in one window) until pop-ups are allowed once. **Option B** (my recommendation): one click opens only the audience window and the editor tab itself becomes the presenter view, returning to the editor when the show ends. One window per click was never blocked, so there is no prompt in the normal case, and the presenter view sits on the laptop. | Settled 2026-10-14: **Option B**. PM-1, PM-3 and the intro to the presenting stories are updated. Design change for Peter: the States board card "Your browser blocked the presenter window" should say "audience window"; until then the app copy follows this decision |
| 11 | Bold for DM Serif Display | It has no bold design (Regular and Italic only), so bold would be made by the browser, like the italic in decision 7, and can differ between browsers. My recommendation: hide the bold button for it, as for italic on the other three. Needed before sprint 3 (EL-2) | Open |

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
| 2026-10-14 | First-load bundle budget set: 300 KB JavaScript and 30 KB CSS, gzipped; `npm run build` fails above it | Baseline is 67 KB and 1.9 KB. Rich text, storage and undo will use a lot of the room, so presenting and export must load lazily. Raising a number needs Peter's OK | Claude |
| 2026-10-14 | Deployed app sends a strict content security policy (own files only, no inline scripts, no external hosts) plus nosniff, no referrer and no camera, microphone or location | Enforces the rule that Cue makes no external requests, and an end-to-end test proves the browser blocks one. Styles allow inline attributes because React and the slide renderer set them. Any host added later needs Peter's OK | Claude |
| 2026-10-14 | GitHub Actions pinned by commit hash, read-only token, 15-minute job limit; versions at least two weeks old (checkout 7.0.1, setup-node 7.0.0, upload-artifact 7.0.1) | Supply-chain safety; `tests/ci.test.ts` enforces it. The `gh` command is not installed on this PC, so the GitHub repository is created by Peter in the browser (see `docs/hosting.md`) | Claude |
| 2026-10-14 | Decisions 7, 8 and 9: italic button hidden for Bricolage Grotesque, Space Grotesk and Caveat; Latin text only; tokens and board left untouched and the top bar shows "Cue" until a deck is open | Peter answered 7 and 8 and left 9 to Claude. Italic rule added to EL-2 (user stories and sprint 3) | Peter |
| 2026-10-14 | Repository `PetesPen/cue` stays public; `main` pushed to GitHub; first CI run green on all four jobs | Peter: "public is fine". The push needed Peter to sign in to GitHub in a browser window. The commit author email (peter.is.brainy@gmail.com) is now publicly visible in the history. Netlify is still to be linked | Peter |
| 2026-10-14 | Standing permission to push after each piece of work, straight to `main` during sprint 0; branches and pull requests from sprint 1 once Netlify is linked | Peter: "yes and yes". No `gh` command here, so pull requests cannot be opened from this PC until that changes; previews need Netlify anyway. Force-pushes and other repository changes still need his OK | Peter |
| 2026-10-14 | SP-1 finished: sync is a go; opening both windows from one click is a no-go as written | BroadcastChannel keeps windows within about 17 ms; Web Locks detect a closed window; Chrome, Edge and Firefox block the second window of a click. Decision 10 asks Peter to choose how a show opens its windows. Details in `docs/spikes/SP-1.md` | Claude |
| 2026-10-14 | Decision 10: a show opens only the audience window; the editor tab becomes the presenter view (Option B) | Browsers block a second pop-up from the same click, and one window per click was never blocked. PM-1, PM-3 and the presenting stories reworded. The States board card needs "presenter" changed to "audience" (Peter's design change) | Peter |
| 2026-10-14 | SP-2 finished: TipTap stays; text on slides is drawn by a small static renderer that follows four rules | 1,013 measured lines matched to 0.02 px; without the rules 44 of 64 blocks wrap differently. Linux Chromium needs `text-rendering: geometricPrecision`. TipTap is about 121 KB gzipped and must load lazily. Decision 11 (bold for DM Serif Display) opened. Details in `docs/spikes/SP-2.md` | Claude |
| 2026-10-14 | SP-3 finished: single-file export is a go; WebP re-encoding is not done at export | 30 slides export in under 0.4 s (Chrome, Edge) and under 1.2 s (slowest engine) against a 10 s limit, up to 52 MB; file is about 1.35 x photo bytes plus 0.16 MB; no external requests. WebP re-encode takes 6 to 12 s. WebKit could not store Blobs in IndexedDB, so store raw bytes plus a type until real Safari is checked (SP-5). Details in `docs/spikes/SP-3.md` | Claude |
| 2026-10-14 | SP-4 finished: motion design is a go; fps budgets on the nightly runner are relative, 60 fps is confirmed by hand | 60 fps on real hardware (Chrome, Edge) with 0 to 4% dropped frames, unchanged with the CPU slowed 6x; stepping back is exact. The Linux runners have no graphics card: a normal slide holds 60 fps in Chromium and Firefox, a heavy one does not in Chromium, and software WebKit is slow. Prefer fade and push to zoom. Details in `docs/spikes/SP-4.md` | Claude |
