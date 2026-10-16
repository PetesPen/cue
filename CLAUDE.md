# Slides: a web app for building and presenting 16:9 decks

Working name: **Cue** (decided by Peter, 2026-10-14). Use it for the package, app title and code. The docs and the design still say "Slides" as the description of the product; the design wordmark changes only when Peter says so.

A local-first web app. One presenter builds a deck (rich text, shapes, images), animates it click by click, and presents from two synced windows: an audience window and a presenter view (resizable notes, next-slide preview, navigation). One click opens the audience window and the editor tab itself becomes the presenter view; ending the show returns it to the editor (decision 10). No server and no accounts. Decks live in the browser (IndexedDB) and leave it as a `.slides` file or a single standalone HTML file. The feel is sleek, simple, attractive and efficient.

The product owner is Peter. Ask him when a requirement is unclear or a decision is his; do not guess on product questions.

## Where things are

| Need | Read |
|---|---|
| How we work, architecture, test strategy, release plan, risks | `docs/development-plan.md` |
| All 59 user stories with acceptance criteria | `docs/user-stories.md` |
| The sprint you are working on (stories, demo, key tests, design links) | `docs/backlog/sprint-NN.md` (index: `docs/backlog/README.md`) |
| Decisions made and still open | `docs/decisions.md` |
| Screens, tokens, style rules | `design/README.md`, `design/screenshots/*.png`, `design/tokens.css` |

Story IDs (SL-1, EL-3, AN-5 ...) are the vocabulary: use them in branch names, commit messages, test names and code comments where a rule comes from a story.

## Current state

**Sprints 0 to 4 are accepted; Gates 1 (2026-10-15) and 2, "Editor alpha" (2026-10-16), have passed.** Sprints 3 and 4 (rich text, fonts, colour picker, paste, notes, copy and delete; images, undo and redo, reorder, duplicate and delete slides) are merged and live; the fixture deck Autumn Launch and the end-to-end test that rebuilds its hero slide are in `main`. **Sprints 5 and 6 are built and merged** (pull request 26 on 2026-10-17; Peter reviewed them and had no objections) (the entry "Sprints 5 and 6" in `docs/sprint-log.md`): keyboard and the shortcut sheet, performance (`npm run perf`), slide background (colour), Appear, Disappear, Move, timing, order, Preview, transitions as a choice, align and snap. The reference images of the visual tests were refreshed by the "Update screenshots" workflow on `main` (pull request 28, waiting for Peter to look at the pictures); sprint 7 adds a Present button to the top bar, so the workflow is run again on the sprint 7 branch and its pull request is Peter's to review (the workflow makes every picture again). **Peter approved the plan for sprint 7 on 2026-10-17** (`docs/plans/sprint-07.md`, with the Gate 3 criteria and decisions 29 to 31). **Sprint 7 (transitions and the two windows: TN-4, TN-5, PM-1, PM-2) was built the same day and waits for the Gate 3 review**; its pull request, the refreshed reference images and the review notes (`docs/sprint-log.md`) are for Peter. Do not start sprint 8 until he has reviewed. Reviews are every other sprint (rule 9 below). Decisions 14 to 31 are settled; the build choices of sprints 3 and 4 were confirmed by Peter on 2026-10-16 and those of sprints 5 and 6 reviewed on 2026-10-17 (log in `docs/decisions.md`). Sprint 0 left: foundations F1 to F6 and spikes SP-1 to SP-6 (findings in `docs/spikes/`, index `docs/spikes/README.md`; the spike code in `spikes/` is archived). The live site is https://cue-presentations.netlify.app/ (Netlify; the Drawer and the badge are off). Decisions 10 to 14 are settled; the States board source was updated, but `design/screenshots/States.png` and Peter's live canvas still show the old wording. Work goes through short branches and pull requests (`gh` is installed and signed in as PetesPen; do not delete remote branches without asking). Review notes: `docs/sprint-log.md`. Work sprint by sprint, in order. Use `/start-sprint N` to begin a sprint and `/finish-sprint N` to close it. Keep this section current: which sprint is active and which gate was last passed.

## Stack (proposed; confirmed or changed by the sprint 0 spikes, then recorded in `docs/decisions.md`)

- TypeScript (strict) and React, built with Vite. Static output, no server.
- One immutable deck document. Every edit is a command that produces patches (Immer). That one mechanism gives undo and redo (EL-8), autosave diffs (SV-1) and window sync (PM-3).
- Slides are DOM elements in a fixed 1920 x 1080 space, scaled to fit with a CSS transform. Editor, thumbnails, presenter, audience and HTML export all use the same renderer, so they match.
- Rich text: TipTap (ProseMirror), stored as JSON inside the text element. Everything that only shows text (thumbnails, presenter, audience, export) uses a small static renderer of our own that follows the four rules in `docs/spikes/SP-2.md` (same structure, ProseMirror's CSS, `text-rendering: geometricPrecision`, the extra break after a final soft return). Load TipTap only when text editing starts: it is a lazy chunk of about 118 KB gzipped with its own budget (160 KB) in `config/budgets.json`.
- Motion: a pure function from (slide, step) to element states; the Web Animations API plays the change, using only `transform` and `opacity`. Stepping back is free and exact (AN-7). Performance budgets: the nightly runner has no graphics card, so fps targets there are relative; 60 fps is confirmed by hand on a real laptop and a Mac (`docs/spikes/SP-4.md`).
- Storage: IndexedDB through Dexie. Images are stored once, by content hash, as raw bytes plus a type and loaded one at a time. Save a deck and its new photos in one transaction (a failed save then leaves nothing behind) and sweep orphan photos at startup. Treat `QuotaExceededError`, also as `error.inner` (Dexie wraps it), as "full store". Never await `navigator.storage.persist()`: Firefox prompts and may never answer (`docs/spikes/SP-5.md`).
- Two windows: BroadcastChannel carrying only deck, slide, step and blank state. Each window renders from the stored deck.
- Deck file `.slides`: a zip holding `deck.json` (with a schema version) plus images and fonts. Older versions migrate; newer ones get a clear message.
- HTML export: one file with deck JSON, images and fonts inlined and a small runtime built from the shared renderer. It must make no external requests; a content security policy inside the file makes the browser enforce that. Photos go in as base64 `text/plain` script blocks, only the fonts used are embedded with their licences, and the file is built as a list of pieces for the browser to join (`docs/spikes/SP-3.md`). Re-encoding to WebP is not done at export: it is too slow.
- Fonts: bundled WOFF2 from open-licence families only; embedded in exports only when used. They live in `src/fonts` with their licences and are loaded only when text uses them. An embedded family's `OFL.txt` must travel with it in a `.slides` file or HTML export.
- Installable and offline (UX-7): a web app manifest and a service worker that caches the app files. Workbox through `vite-plugin-pwa` is proposed, and spike SP-6 confirms it. Register the service worker in production builds only, so development never serves stale files.
- Hosting: Netlify (static files, a deploy preview for every pull request). Decided by Peter on 2026-10-14.

## Architecture rules

Module boundaries, with dependencies pointing one way only (an import-lint rule in CI enforces it):

- `model`: pure TypeScript, no DOM. Deck types, commands, undo, schema migrations. Most unit tests live here.
- `render`: the slide renderer and the motion engine, shared with the export runtime.
- `editor`: the React interface (canvas, handles, panels). The only place that knows about selection and tools.
- `present`: the audience and presenter windows and the sync channel.
- `storage`: IndexedDB, deck file pack and unpack, and the HTML exporter.

`editor` and `present` may use `render` and `model`; `model` uses nothing. Keep it that way. No `any`, no unchecked casts at module boundaries.

The exact rule, enforced by ESLint in `eslint.config.js`: `model` imports nothing; `render` imports `model`; `storage` imports `model` and `render`; `editor` and `present` import `model`, `render` and `storage`, and never each other. `model` also may not touch the DOM or React. `src/main.tsx` and `src/App.tsx` sit above the modules. Import across modules with the `@/` alias (for example `@/model`).

Out of scope for v1 (do not build): accounts, cloud storage, sharing links, collaboration; `.pptx` import or export; audio, video, charts, tables, comments; aspect ratios other than 16:9; editing on a phone; a phone as a remote control. (The installable offline editor, a PWA, is in scope as UX-7.)

## Commands

Sprint 0 fills this list in. Scripts that exist today are marked "now"; the rest are expected and arrive as noted. Keep it accurate.

- `npm run dev`: dev server (now)
- `npm run typecheck`, `npm run lint`: static checks; lint includes accessibility and import-layering rules (now)
- `npm run format`, `npm run format:check`: Prettier on code and config; docs, design and Markdown are not formatted (now)
- `npm test`: unit, integration and component tests (Vitest, three projects; now). Naming: `*.test.ts` is unit, `*.integration.test.ts` runs with fake-indexeddb, `src/**/*.component.test.tsx` runs in real Chromium, in a 1440 x 900 window with the app's tokens and base styles (`tests/component-setup.ts`). Run one level with `npx vitest run --project unit` (or `integration`, `component`)
- `npm run test:coverage`: the same with coverage; fails under 90% on `model` and `render` (now; it passes vacuously until those hold code)
- `npm run e2e:install`: download the Playwright browsers, once (now)
- `npm run e2e`: Playwright end-to-end on Chromium, Firefox and WebKit, against the production build (now). On Peter's Windows PC Firefox cannot start (see `docs/decisions.md`); run `npx playwright test --project=chromium --project=webkit` there. CI runs all three
- `npm run e2e:deployed`: the same end-to-end tests against a deployed address, with `E2E_BASE_URL` set (the live site or a Netlify deploy preview) (now)
- `npm run e2e:visual`: visual regression, Chromium only. It refuses to run outside the pinned container (`config/visual.json`, `CUE_VISUAL_CONTAINER=1`); CI runs it there. `npm run e2e:visual:docker` runs it in the container where Docker is installed (not on Peter's PC). Baselines are made by the manual GitHub workflow "Update screenshots" (`.github/workflows/update-screenshots.yml`; run it on the branch whose screenshots change): it regenerates them in the container and opens a pull request into that branch for Peter to review (decision 13). Never make baselines elsewhere
- `npm run perf`: the performance suite, against the production build (now; the nightly job runs it). Drags and resizes of one of 50 elements, opening a deck of 50 slides (also 50 slides of 50 elements, and with the processor 4 times slower), typing in it; the export timing arrives with SV-4. Chromium and Firefox are held to `config/budgets.json` (`perf`); WebKit is measured and printed, not failed (software drawing, `docs/spikes/SP-4.md`). Fixtures: `tests/fixtures/heavyDeck.ts`. Run `npm run perf -- --project=chromium` on Peter's PC
- `npm run build`: typecheck, production build and the bundle-size check (now). `npm run size` runs only the check; budgets are in `config/budgets.json`
- `npm run audit`: dependency audit, high severity and up (now; CI runs it nightly)
- `npm run preview`: serve the production build locally with the deployed security headers (now)

## Testing rules

- Every acceptance criterion becomes an automated check wherever a machine can judge it. Write it first as a Given / When / Then example; each example becomes a test name.
- Pyramid: most checks are fast unit tests in `model` and `render`; a thin layer of end-to-end tests on top. Every Must story has at least one end-to-end test. Push everything else down.
- Property tests (fast-check), early: z-order commands keep the relative order of the selection (ZO-1); command then undo returns the original deck (EL-8); save to file then open returns the same deck (SV-3, SV-5); element opacity and colour alpha multiply as the format panel shows (TR-2).
- One fixture deck, "Autumn Launch" (12 slides, from the design), feeds the end-to-end, visual and performance tests so failures point at the same slides every time.
- Visual baselines come from one pinned container with the bundled fonts and are checked in Chromium only. Updating a baseline needs a reviewed pull request.
- Performance budgets are failing tests, not reports. Accessibility: axe-core on every main screen, zero violations; a unit test computes contrast for every pair in `design/tokens.json` (AA, 4.5:1).
- A flaky test is quarantined within a day and fixed within the sprint. PR checks finish in under 10 minutes. Aim for at least 90% coverage on `model` and `render`; there is no overall target.
- Stays manual (do not fake it): the audience window on a real second display and projector; trackpad pinch zoom; how motion feels; fonts and wrapping on Windows, macOS and Linux; a full rehearsal before each milestone. List these in the sprint review notes for Peter.

## Definition of ready (a story can enter a sprint when)

- Its acceptance criteria are written as examples and the test approach is noted.
- It points at a board in the design, or says why none is needed.
- It is no bigger than about a week of work (larger stories are split first), and its dependencies are done or earlier in the same sprint.

## Definition of done (a story is finished when)

- Every acceptance criterion is shown working on the preview deployment.
- Its automated tests are merged and green: unit tests for logic, at least one end-to-end test per Must story, passing on Chromium, Firefox and WebKit.
- No new accessibility violations, and the screen matches the style guide and board.
- No performance budget is broken (UX-3, TN-5, SV-4).
- A normal session shows no console errors and no known bugs remain on the story.
- Anything unfinished sits behind a feature flag that is off in production.

## Git and CI

- Trunk-based: short branches (`sl-1-add-slide`) merged to `main` within two days. Every change is a pull request with a preview link. `main` is always releasable and deploys automatically.
- Commit messages start with the story ID: `SL-1: add slide command and shortcut`. Use `chore:` for tooling and `spike:` for spikes.
- Pipeline: PR checks (install, typecheck, lint, unit and component tests, build, bundle-size check) in parallel with end-to-end, visual and accessibility jobs; deploy a preview and post the link; on merge repeat and deploy; nightly performance suite, full browser matrix including Edge, dependency audit; on a release tag run the manual checklist.
- Remote: `origin` is https://github.com/PetesPen/cue (public). Peter gave standing permission on 2026-10-14 to push after each piece of work, with CI as the check. During sprint 0 push straight to `main`; once Netlify is linked and UI stories start (sprint 1), switch to short branches and pull requests with preview links. Still ask first before: force-pushing or rewriting pushed history, deleting remote branches, deploying anywhere other than Netlify, creating other remotes or repositories, or changing the repository's settings.
- Never commit secrets. The repository is public: nothing private goes in it.

## How to work

1. Start every session by reading this file and the active sprint file. Do not rely on memory of earlier sessions; the repo is the memory.
2. Plan before building: for a sprint or a large story, outline the approach and the order, and show it to Peter before writing code. Use the task list to track stories and sub-tasks.
3. Build in thin vertical slices: a story is a working path through model, render, editor and tests, not a layer. Run the relevant checks before saying anything is done.
4. Stay inside the sprint goal. New ideas go to the backlog as stories (with a priority), not into the current sprint, unless they swap out work of the same size. Cut Could stories first, then Should; never cut a Must without Peter's decision.
5. A bug that can lose a user's deck jumps the queue. A bug found in a story during its own sprint is fixed as part of the story.
6. Never edit `design/` yourself. If a screen needs to change, describe the change and ask Peter.
7. When you finish something, say what works and how it was verified, and what is still manual. Do not claim a criterion is met without a test or a demo that shows it.
8. When commands, structure or decisions change, update this file and `docs/decisions.md` in the same pull request.
9. Peter's working preference: on 2026-10-15 he asked to touch base at the end of each sprint, not during it; on 2026-10-16 he agreed to **review every other sprint**. Reviews fall after sprints 4 (Gate 2), 6, 7 (Gate 3), 9, 10 (Gate 4), 12 and 13 (Gate 5). Between reviews, finish a sprint, write its notes in `docs/sprint-log.md`, merge it, and start the next without waiting. He approves plans in pairs (3 with 4, 5 with 6, 8 with 9, 11 with 12; sprints 7, 10 and 13 alone), a short summary each, before the first sprint of a pair is built. Work through the sprint, and keep findings, questions and answers in the repo (`docs/decisions.md`, `docs/sprint-log.md`). Interrupt him mid-sprint only for a significant decision: one that changes scope, the design or the plan, or that cannot be undone cheaply. A finding that changes the plan may be raised mid-sprint; small ones wait for the review. Put the questions you need answered at the end of the review summary, most important first.
