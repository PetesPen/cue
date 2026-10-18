# Slides Web App: Development Plan

> Exported from the Claude document of 2026-10-14. This file is the working copy now: edit it here as the plan changes.

2026-10-14 · Peter Alexander

## Summary

Slides can reach a v1.0 release in about 14 two-week sprints (about 28 weeks) with two engineers, with a working, tested app at the end of every sprint. This plan turns the 61 user stories and the Studio design canvas into that sequence.

**How we work**

- Build in thin vertical slices, following the five phases in the user stories: editor core, motion, present and export, polish, stretch.
- Open with one sprint of foundations and risk spikes, because the two-window show, rich text and single-file HTML export are the least certain parts.
- Ship a milestone every three to four sprints. The product owner uses the app for real decks from sprint 4.
- Turn every story's acceptance criteria into automated tests. A story is not done until those tests run in CI.
- Re-plan every sprint. Scope after the next sprint can change; a sprint's goal does not change mid-sprint.

**Assumptions**

- Two engineers at about 80% focus give roughly 16 engineering days per sprint. One engineer roughly doubles the calendar time.
- Peter is the product owner: a 45-minute review each sprint and quick answers in between.
- The Studio design canvas is the visual reference. Changes to it go through the product owner.
- Estimates are first guesses (give or take 30%) and are checked again after sprint 2, once real velocity is known.
- There is no server and no accounts. Everything ships as static files.

## Architecture and technology

One TypeScript web app with no server: a single deck model drives the editor, both presentation windows and the HTML export through one shared renderer. These choices follow the suggestion in the user stories and are confirmed or changed by the sprint 0 spikes.

> *Diagram: architecture. Three surfaces (editor, presenter window, audience window) share one core (deck model, renderer, animation engine) and produce three outputs (browser storage, `.slides` deck file, standalone HTML). See the module boundaries below.*

Arrows show who uses whom. The presenter and audience windows only pass slide and step numbers to each other; each one draws from the stored deck.

| Area | Decision | Why |
|---|---|---|
| App | TypeScript (strict) and React, built with Vite | Mainstream and well supported; Vite gives fast feedback and plain static output |
| Deck state | One immutable deck document; every edit is a command that produces patches (Immer) | One mechanism gives undo and redo (EL-8), autosave diffs (SV-1) and window sync (PM-3) |
| Rendering | Slides are DOM elements in a fixed 1920 × 1080 space, scaled to fit with a CSS transform | Editor, thumbnails, presenter, audience and export share one renderer, so they match (TR-3, SV-5) |
| Rich text | TipTap (ProseMirror), stored as JSON inside the text element | Mixed formatting, lists and paste handling come ready-made (EL-1) |
| Motion | A pure function from (slide, step) to element states; the Web Animations API plays the change | Testable without a browser, reused in the HTML export, and stepping back is free (AN-7) |
| Storage | IndexedDB through Dexie: decks and slides, with images stored once by content hash | Copes with image-heavy decks, autosave and quota errors (SV-1, EL-4) |
| Two windows | BroadcastChannel carrying only deck, slide, step and blank state | Each window renders from the stored deck, so messages stay tiny and sync stays under 100 ms (PM-3) |
| Deck file | A zip (.slides) holding deck.json with a schema version, plus images and fonts | Self-describing, with migrations for older files and a clear message for newer ones (SV-3) |
| HTML export | One file: deck JSON, images and fonts inlined, plus a small runtime built from the shared renderer | No external requests, so it works offline (SV-4) |
| Fonts | Bundled WOFF2 files from open-licence families, embedded in exports only when used | Decks look the same on every machine (EL-2) |
| Hosting | Netlify: static files, with a deploy preview URL for every pull request (decided 2026-10-14) | Cheap, nothing to operate, and anyone can open any branch |
| Installable and offline | A web app manifest and a service worker that caches the app files. Workbox through `vite-plugin-pwa` is proposed; spike SP-6 confirms it. The service worker is registered in production builds only | Cue installs and opens with no network (UX-7), and development never serves stale files |

**Module boundaries**

- model: pure TypeScript with no DOM. Deck types, commands, undo and schema migrations. Most unit tests live here.
- render: the slide renderer and the motion engine, shared with the export runtime.
- editor: the React interface (canvas, handles, panels). The only place that knows about selection and tools.
- present: the audience and presenter windows and the sync channel.
- storage and files: IndexedDB, deck file pack and unpack, and the HTML exporter.
- Dependencies point one way only: editor and present use render and model, and model uses nothing. An import-lint rule in CI enforces this.

## Test strategy

Every acceptance criterion becomes an automated check wherever a machine can judge it. Most checks are fast unit tests, with a thin layer of end-to-end tests on top, and only a short list needs a human.

**Test levels**

| Level | Tool | What it proves | When it runs |
|---|---|---|---|
| Static checks | TypeScript strict, ESLint with accessibility and import rules | Types, layering, common accessibility mistakes | Every commit |
| Unit | Vitest, with fast-check for property tests | Deck model, commands, undo, z-order, opacity maths, motion resolver, file packing, migrations | Every commit |
| Component | Vitest browser mode and Testing Library | Panels, font picker, layers list, shortcut map | Every pull request |
| Integration | Vitest with fake-indexeddb | Autosave, many decks, quota errors, restore after reload | Every pull request |
| End to end | Playwright on Chromium, Firefox and WebKit | Real journeys through the running app, including two windows | Every pull request; Edge nightly |
| Visual regression | Playwright screenshots in a pinned container | Editor, presentation and export draw the same pixels; no style drift | Every pull request |
| Accessibility | axe-core in Playwright, plus a token contrast unit test | No violations on main screens; text contrast of at least 4.5:1 | Every pull request |
| Performance | Playwright with frame-time and timing marks | Frame rate, open time and export time stay inside budgets | Nightly, or on request for a pull request |
| Manual | People, with a checklist | Real displays, touch, and how motion feels | Each sprint review and release |

**Property tests worth writing early**

- Z-order commands keep the relative order of the selected elements (ZO-1).
- Applying any command and then undoing it returns the original deck (EL-8).
- Saving a deck to a file and opening it gives back the same deck (SV-3, SV-5).
- Element opacity and colour alpha multiply as the format panel shows (TR-2).

**Criteria that look hard to test, and how we test them**

| Criterion | How it is tested |
|---|---|
| Windows stay in sync within 100 ms (PM-3) | Playwright opens audience and presenter in one browser context, advances one, and times how long the other takes to show the same step |
| A blocked audience window gives a clear prompt (PM-1) | A test hook makes window.open return null and the prompt must appear. Real pop-up blocking is checked by hand in real Chrome, Edge, Firefox and Safari (Playwright's own Chromium does not enforce the blocker; see `docs/spikes/SP-1.md`) |
| An export makes no external requests (SV-4) | Open the exported file in a context that fails every request except the file itself, then click through every slide |
| Export matches the editor to within one pixel (SV-5) | A fixture deck is drawn in editor, presentation and export at 1920 × 1080; element boxes must match within 1 px and screenshots within a small pixel tolerance |
| Opacity is identical everywhere (TR-3) | A fixture slide with images, shapes and text at several opacities is captured in all three renderers and compared |
| Transitions run smoothly (TN-5) | Frame times are sampled during each transition and the 95th percentile must stay under budget on the nightly runner, then confirmed on a real laptop |
| 50 elements drag at 60 fps; a 50-slide deck opens in under 2 seconds (UX-3) | Generated fixture decks and timing marks. Budgets are failing tests, not reports |
| A 30-slide export finishes in under 10 seconds (SV-4) | A generated image-heavy fixture, with the time asserted |
| Large images are downscaled (EL-4) | A 6000 × 4000 fixture is imported; the stored image must be smaller, with the original kept when space allows |
| Notes panel and text size are remembered (PM-4) | Drag the divider, press A+, end and restart the show, then check both values |
| Corrupt or foreign files are rejected (SV-3) | Truncated and fuzzed files must show the message and leave stored decks untouched |
| Text contrast meets AA (UX-6) | A unit test computes the contrast of every colour pair in the design tokens |

**What stays manual**

- The audience window on a real second display and projector, including fullscreen (PM-1).
- Pinch zoom on a trackpad (UX-4). Synthesised wheel events cover the logic.
- How motion feels. A runner can pass the 60 fps check, but a person judges smoothness on a real laptop (TN-5).
- Fonts and text wrapping on Windows, macOS and Linux, once per release.
- One full rehearsal of a real talk before each milestone.

**Rules**

- Acceptance criteria are written as Given / When / Then examples during refinement, and each example becomes a test name.
- Every Must story has at least one end-to-end test; everything else is pushed down the pyramid.
- One fixture deck, Autumn Launch from the designs, feeds the end-to-end, visual and performance tests, so a failure points at the same slides every time.
- Visual baselines come from one pinned container with the bundled fonts and are checked in Chromium only. The other engines run behavioural tests. Updating a baseline needs a reviewed pull request.
- A flaky test is quarantined within a day and fixed within the sprint. Pull request checks should finish in under 10 minutes, split across parallel jobs.
- Coverage is watched, not worshipped: aim for at least 90% on model and render, with no overall target.

## Ways of working

Two-week sprints, a live preview of every change, and a short set of rules that make "done" mean the same thing every time.

**Cadence**

| Event | When | Length | Purpose |
|---|---|---|---|
| Sprint planning | First day | 1 hour | Agree one sprint goal and the stories that reach it |
| Daily check-in | Every day | 15 minutes, or written if solo | Blockers and handoffs |
| Refinement | Weekly | 45 minutes | Get the next two sprints' stories ready and write their Given / When / Then examples |
| Sprint review | Last day | 45 minutes | Demo on the live preview; the product owner accepts or rejects each story |
| Retrospective | Last day | 45 minutes | Choose one change to try next sprint |

**Definition of ready** (a story can enter a sprint when)

- Its acceptance criteria are written as examples and the test approach is noted.
- It points at a board in the design canvas, or says why none is needed.
- It is no bigger than about a week of work. Larger stories are split first.
- Its dependencies are done, or planned earlier in the same sprint.

**Definition of done** (a story is finished when)

- Every acceptance criterion is shown working on the preview deployment.
- Its automated tests are merged and green: unit tests for logic, and at least one end-to-end test for each Must story.
- There are no new accessibility violations, and the screen matches the style guide.
- No performance budget is broken (UX-3, TN-5, SV-4).
- It passes the end-to-end suite on Chromium, Firefox and WebKit.
- A normal session shows no console errors, and no known bugs stay open on the story.
- Anything unfinished sits behind a feature flag that is off in production.

**Branching and review**

- Trunk-based development: short branches merged to main within two days.
- Every change is a pull request with its own preview link. A second person reviews it. If working alone, a review checklist and green checks stand in.
- Main is always releasable and deploys automatically.

**Pipeline** (GitHub Actions or similar)

1. On every pull request: install, type check, lint, unit and component tests, build, and a bundle size check against a budget set in sprint 0.
2. In parallel: end-to-end tests on three browser engines, visual regression and the accessibility scan.
3. Deploy a preview and post its link on the pull request.
4. On merge to main: repeat the checks, then deploy to the live site.
5. Nightly: the performance suite, the full browser matrix including Edge, and a dependency audit.
6. On a release tag: run the manual checklist, publish, and record the changelog entry.

## Release plan

The first complete show, with every Must story, is ready at the end of sprint 10, and v1.0 follows after sprint 13. Each milestone is a gate: the next phase does not start until the gate's criteria hold.

### The five gates

Reviews with the product owner happen every other sprint (agreed 2026-10-16), and always at a gate: after sprints 4 (Gate 2), 6, 7 (Gate 3), 9, 10 (Gate 4), 12 and 13 (Gate 5); plans are approved in pairs. A gate is a checkpoint at the end of a phase. At the sprint review the product owner says yes or no to it. A yes means the next phase starts. A no, or "not yet", means the next sprint closes the gap before any new stories begin. Claude never marks a gate passed; only the product owner does, and the answer is recorded in `docs/decisions.md` and the "Current state" section of `CLAUDE.md`.

| Gate | Name | Ends sprint | The question being answered |
|---|---|---|---|
| 1 | Stack confirmed | 0 | Is the technology good enough to build everything on, given what the spikes found? |
| 2 | Editor alpha | 4 | Can you build and save a real deck of text, shapes and images, with undo? (The plan also rebuilds a second real deck here, decision 4: this plan says "milestone 2", `docs/decisions.md` says Gate 3; decide when the deck is chosen.) |
| 3 | Motion beta | 7 | Do animations, transitions and the two windows work well enough to try a real talk? |
| 4 | First full show | 10 | Can you deliver a real talk from start to finish, with all 39 Must stories working? |
| 5 | v1.0 | 13 | Is the release candidate good on all four browsers, with every budget met? |

**Status:** Gate 1 passed on 2026-10-15, Gate 2 on 2026-10-16 and Gate 3 ("Motion beta") on 2026-10-17 (all accepted by Peter). Gates 4 and 5 are open. The criteria for Gates 1 to 4 are written. The criteria for each later gate are written at the start of the sprint that ends in it.

**Gate 1 criteria** (written by Claude on 2026-10-15, because the plan did not define them; the product owner can change them):

1. Each of the six spikes has a written finding with numbers and a verdict (`docs/spikes/`).
2. CI is green on the empty app on Chromium, Firefox and WebKit, and the accessibility scan finds no violations.
3. The commands in `CLAUDE.md` are real, and the stack verdict is written (`docs/decisions.md`, "Stack").
4. The empty app is deployed with a preview, as the sprint 0 demo says.

Gate 1 is not about the spike code or about every risk being gone. It is the answer to "do we build on this stack, knowing what we now know?". The things the spikes could not check (real Safari, a second display) stay on the manual list either way.

**Gate 2 criteria** (written by Claude on 2026-10-16, at the start of sprint 3 and shown at the end of sprint 4; the product owner can change them). The question is "can you build and save a real deck of text, shapes and images, with undo?":

1. **Every acceptance criterion of sprints 3 and 4 is shown working** (EL-1, EL-2, SL-6, EL-7, EL-10, EL-4, EL-8, SL-3, SL-4), on the preview deployment, with its automated tests green on Chromium, Firefox and WebKit.
2. **A real deck can be built.** The fixture deck Autumn Launch (12 slides, from the design; decision 4 settled by Peter on 2026-10-16) opens in the editor and every slide is drawn; its hero slide, "Our approach", is rebuilt through the interface by an end-to-end test (text in several sizes and colours, shapes, a picture with a description and a fade, notes, undo and redo, a duplicate slide, and a reload). What was missing or awkward is written down (`docs/sprint-log.md`).
3. **Nothing is lost.** Everything survives a reload; a save that does not fit (a full store) is reported, keeps the work on screen, and saves everything together when it can; undo covers every command (property tests).
4. **Accessibility and budgets hold.** axe finds no violations on the editor with text editing, both pickers, a selected picture, a toast and the slide rail; the first load stays inside 300 KB gzipped and the text editor, loaded when text is first edited, inside its own 160 KB.
5. **Peter builds a slide himself** from a blank deck in the live app and says whether it feels like a tool he would use (manual; this is the part a machine cannot judge).

Gate 2 is not about polish (slide backgrounds, snapping and a layers panel are later stories) or about animation and presenting (sprints 5 to 8).

**Gate 3 criteria** (written by Claude on 2026-10-16, in `docs/plans/sprint-07.md`, and approved by Peter on 2026-10-17 with the plan; the product owner can change them). The question is "do animations, transitions and the two windows work well enough to try a real talk?":

1. **Every acceptance criterion of sprints 5 to 7 is shown working** on the preview deployment, with its tests green on Chromium, Firefox and WebKit.
2. **A real deck is presented in two windows.** The fixture deck Autumn Launch is presented from its first slide to its last, in two windows, by an end-to-end test: the hero slide plays its three clicks, slides arrive with their transitions, and Esc returns the editor as it was.
3. **Nothing is lost.** A show never changes the deck; ending a show, or closing the audience window or the browser during one, leaves the deck as it was.
4. **Accessibility and budgets hold.** axe finds nothing on the presenter view, the audience window and the transition bar; the first load stays inside 300 KB; the transition frame budgets are met on the nightly run.
5. **Peter presents a short talk** of his own from the live app in two windows, on his own machine, and says whether he would try a real one (manual).

**Gate 4 criteria** (written by Claude on 2026-10-17, in `docs/plans/sprint-10.md`, and approved by Peter on 2026-10-18 with the plan; the product owner can change them). The question is "can you deliver a real talk from start to finish, with all 39 Must stories working?":

1. **Every acceptance criterion of sprints 8 to 10 is shown working** on the preview deployment (PM-3 to PM-6, TN-2, TN-3, SV-3, UX-5, UX-7, SV-4, SV-5 and SV-8), with its tests green on Chromium, Firefox and WebKit.
2. **All 39 Must stories have an end-to-end test.** A test reads `docs/user-stories.md` and fails when a Must story's ID is in no end-to-end or performance test name, and the sprint log lists each Must story with its tests.
3. **A real deck goes the whole way.** By end-to-end tests, Autumn Launch is built in the editor, presented from first slide to last in two windows, exported as a file and as a web page, the page presented from first slide to last with the network off, and the deck file opened in a fresh profile and found whole.
4. **Nothing is lost.** An export never changes the deck; a failed export (a picture that cannot be read, a full disk) says so and leaves everything; a show never changes the deck.
5. **Accessibility and budgets hold.** axe finds nothing on the Export dialog, the exported page, the presenter view and the audience window; the first load stays inside 300 KB; the export budgets hold (30 slides in under 10 seconds, the page's program and the exporter's chunk inside their sizes); the exported page makes no request.
6. **Peter gives a short talk of his own** from the live app (two windows) and from an exported page in another browser, on his own machine, and says whether he would try a real one (manual).

If a gate's criteria are not met, the next sprint closes the gap before any new stories start.

**Sprint by sprint**

| Sprint | Goal | Stories | Days | Demo at the review | Key automated tests |
|---|---|---|---|---|---|
| 0 | Foundations and risk spikes | None. Spikes SP-1 to SP-6, app shell, CI pipeline, design tokens | 16 | Empty app deployed with previews; spike findings and a go or no-go on the stack | CI green end to end on an empty app; throwaway Playwright checks for each spike |
| 1 | Decks, shell and saving | UX-1, SL-1, SL-2, SV-1, SV-2 | 16 | Create decks, add slides, close the tab and find everything again | Persistence integration tests; create-and-reload end to end; axe on the shell |
| 2 | Elements you can move | EL-5, EL-3, ZO-1, TR-1, SV-7 | 18 | Draw shapes, then move, resize, rotate, layer and fade them | Z-order property tests; drag and resize end to end; opacity snapshots |
| 3 | Rich text and notes | EL-1, EL-2, SL-6, EL-7, EL-10 | 22 | Format mixed text in several fonts, paste, write notes | Text JSON round trip; typing and font picker end to end; font loading check |
| 4 | Images, undo and slide management | EL-4, EL-8, SL-3, SL-4 | 16 | Drop in images, undo anything, reorder and duplicate slides | Undo-redo property test; image drop end to end; storage-full mock |
| 5 | Keyboard, speed and first animations | UX-2, UX-3, AN-1, AN-2, TR-3, SL-5 (colour), AN-4 | 19 | Drive the editor by keyboard; set a slide background; elements fade in and out on click in preview, with timing you choose | Performance budgets for 50 elements and 50 slides; motion resolver unit tests; easing and duration unit tests; opacity match across renderers |
| 6 | Motion and sequencing | AN-3, AN-5, AN-6, TN-1, EL-6 | 20 | Move an element along a ghost path, reorder click steps, pick a transition; snap to guides and align | Step-order table tests; preview returns elements to editing positions; snap and align unit tests |
| 7 | Transitions and the two windows | TN-4, TN-5, PM-1, PM-2 | 14 | Preview transitions; start a show in two windows | Two-page end to end; blocked pop-up path; transition frame-time sampling |
| 8 | A complete presenting experience | PM-3, PM-4, PM-5, PM-6, TN-2, TN-3 | 14 | Rehearse a full talk: synced windows, resizable notes, next preview, navigation; set a transition's direction and length, apply it to every slide | Sync under 100 ms; divider and text size memory; keyboard navigation table tests |
| 9 | Deck files, browsers and offline use | SV-3, UX-5, UX-7 | 16 | Save a deck file and open it in another browser; install Cue and open it with the network off | File round-trip property test; corrupt-file rejection; four-browser end to end; offline reload with the service worker |
| 10 | Standalone HTML | SV-4, SV-5 | 12 | Present from one offline HTML file that matches the editor | No-network export test; three-renderer pixel comparison; 30-slide timing |
| 11 | Polish: layers, motion, transparency | ZO-2, ZO-3, TR-2, AN-7 | 14 | Layers panel, step back, fill and text transparency | Layer drag tests; step-back resolver tests |
| 12 | Polish: layout, timer, access | SL-5 (image), PM-7, UX-4, UX-6 | 8 | Image backgrounds, timer colours, zoom, keyboard-only use | Timer state tests; full axe scan and keyboard end to end |
| 13 | Release hardening | None. Bugs, performance, documentation, browser matrix | 16 | A v1.0 release candidate on all four browsers | Full matrix; nightly performance green; zero axe violations; long-session soak test |

Sprints loaded below 16 days keep a few days free for bugs and surprises. Stretch work after v1.0 (EL-9, PM-8, SV-6 and TH-1 to TH-3) is about two more sprints, ordered by what the product owner values once the app is in daily use.

## Backlog

The backlog is the 61 stories from [user-stories.md](user-stories.md), grouped into ten epics, and 39 of them are Must. The estimate is in engineering days (small = 2, medium = 4, large = 8) and covers Must and Should stories only.

| Epic | Stories | Must | Should | Could | Estimate (days) | Sprints |
|---|---|---|---|---|---|---|
| Slides | SL-1 to SL-6 | 5 | 1 | 0 | 16 | 1, 3, 4, 12 |
| Elements | EL-1 to EL-10 | 7 | 2 | 1 | 42 | 2, 3, 4, 12 |
| Z-order | ZO-1 to ZO-3 | 1 | 2 | 0 | 8 | 2, 11 |
| Transparency | TR-1 to TR-3 | 2 | 1 | 0 | 6 | 2, 5, 11 |
| Animations | AN-1 to AN-7 | 5 | 2 | 0 | 22 | 5, 6, 11 |
| Transitions | TN-1 to TN-6 | 3 | 3 | 0 | 20 | 6, 7, 8, 12 (TN-6 proposed) |
| Presenting | PM-1 to PM-8 | 6 | 1 | 1 | 24 | 7, 8, 12 |
| Saving and export | SV-1 to SV-8 | 5 | 2 | 1 | 32 | 1, 2, 9, 10 |
| Look, feel and quality | UX-1 to UX-7 | 5 | 2 | 0 | 24 | 1, 5, 9, 12 |
| Themes and templates | TH-1 to TH-3 | 0 | 0 | 3 | 0 | After v1.0 |
| Foundations and hardening | Not user stories | n/a | n/a | n/a | 32 | 0, 13 |
| Total | 61 stories | 39 | 16 | 6 | 226 | 14 sprints |

**How the backlog is managed**

- The sprint plan above is the starting order. The product owner can reorder anything that is not in the current sprint.
- New ideas enter the backlog as stories with a priority. They enter a sprint only by swapping out work of the same size.
- A bug found in a story during its own sprint is fixed as part of that story. Other bugs are triaged at refinement. Anything that can lose a user's deck jumps the queue.
- If a milestone is at risk, Could stories are cut first, then Should stories. Must stories are never cut without the product owner's decision.
- Acceptance criteria live in the user stories. The board titles in the Studio design canvas (the local copy is in [`design/`](../design/README.md)) carry the same story IDs, so every screen traces back to a story.

## Risks and early spikes

Six spikes of one to two days each, all in sprint 0, test the riskiest assumptions before anything is built on them. Each has a fallback, so a failed spike changes the design, not the date.

| Spike | Question to answer | Stories at stake | Fallback if it fails |
|---|---|---|---|
| SP-1 Two-window show | Can one click open audience and presenter windows reliably in Chrome, Edge, Firefox and Safari, and keep them in sync within 100 ms? | PM-1, PM-3, UX-5 | The presenter view opens as a second tab that the user places; a storage-event channel replaces BroadcastChannel if needed |
| SP-2 Rich text fidelity | Does TipTap text with mixed fonts, sizes and colour alpha wrap identically in the editor and in the static renderer? | EL-1, EL-2, SV-5 | Render presentation and export text through the same TipTap schema, and strip unsupported formatting on paste |
| SP-3 Single-file export | How large is a 30-slide, image-heavy deck as one HTML file, and how long does the export take? | SV-4 | Re-encode images to WebP on export and warn above a size threshold |
| SP-4 Motion at 60 fps | Do 50 animated elements and a full-slide transition hold 60 fps, and can the same engine step backward? | AN-3, AN-7, TN-5 | Limit transitions to opacity and transform, and use a snapshot of the outgoing slide |
| SP-5 Storage limits | How much can IndexedDB hold in each browser, and what happens when it is full or cleared? | SV-1, EL-4 | Lower the image downscale target, request persistent storage, and make backup reminders firmer |
| SP-6 Installable offline app | Can a manifest and a service worker make the app open fully offline and install in Chrome, Edge and Safari, with updates that wait for the user and no stale files in development? How does the installed app behave when it opens the two show windows? | UX-7, PM-1, PM-3 | Cache the app files with a small hand-written service worker, or ship offline use without an install prompt in browsers that cannot install |

**Other risks**

| Risk | Why it matters | What we do |
|---|---|---|
| Safari can remove a site's stored data after seven days without a visit | A deck could vanish between talks | Request persistent storage, keep the backup reminder on the library screen, and make export one click |
| Velocity is unknown | Dates slip without warning | Re-estimated after sprint 2 (2026-10-16, see `docs/sprint-log.md`): engineering days cannot be measured, so the unit is stories accepted per sprint (5 and 5 so far); the burn-up is by stories. Cut Could then Should stories first |
| The long tail of editor behaviour (text, selection, snapping) | One story eats a whole sprint | Use TipTap instead of a custom editor, keep animation to fades and straight-line moves, and route new ideas through the backlog rule |
| Undo across text and element edits clashes | Undo feels unpredictable | Decide one history stack in sprint 2, with typing bursts grouped into single steps |
| Visual tests flake between machines | Slow merges and ignored failures | Pin the container, bundle the fonts, compare pixels in one browser only, and set tolerance per fixture |
| Font licences | Legal risk when fonts are embedded in exports | Use open-licence families only, and confirm each licence in sprint 0 |

## Metrics and decisions needed

Progress is judged first by working software at each review, then by seven numbers. Six decisions from the product owner are needed before sprint 0 starts.

| Measure | Target | Source |
|---|---|---|
| Burn-up of finished engineering days against 218 | On or above the plan line at each review | Board |
| Velocity (days finished per sprint) | About 14 to 16; re-plan if two sprints in a row fall below 12 | Board |
| Pull request check time | Under 10 minutes | CI |
| Flaky test rate | Below 2% of runs | CI history |
| Accessibility violations | Zero on every main screen | CI |
| Performance budgets (60 fps drags, 2 second open, 10 second export) | All met on the nightly run | Nightly job |
| Bugs found after a story was accepted | Trending down, and none that lose a deck | Issue tracker |

**Decisions needed**

1. Team and start date: how many engineers, and when does sprint 0 start? This turns sprint numbers into calendar dates.
2. The stack: confirm TypeScript, React, TipTap and Dexie, or name a preference before the spikes begin.
3. Hosting: which static host and address to use for the live site and the pull request previews.
4. A second real deck, besides Autumn Launch, to rebuild at milestone 2 as a test of whether the editor can make something you would actually present.
5. Phone as a remote control (an open question in the user stories): the plan assumes it is out of v1.
6. Installable offline editor (a PWA): decided on 2026-10-14 to be in v1, as story UX-7 (sprint 9, with spike SP-6 in sprint 0).
