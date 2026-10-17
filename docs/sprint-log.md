# Sprint log

One entry per sprint, newest at the bottom. Written by Claude at the end of a sprint (`/finish-sprint N`). Peter accepts or rejects each story at the review; nothing here is marked accepted.

## Sprint 0: Foundations and risk spikes

**Dates:** started and finished 2026-10-14 (one long working session). **Gate 1 (stack confirmed): accepted by Peter on 2026-10-15.**

**Goal:** an empty, tested, deployable Cue app, plus a written go or no-go on each risky assumption. **Met, except for the Netlify preview** (see "Not done").

### What finished

Sprint 0 has no user stories. Its checklist (`docs/backlog/sprint-00.md`):

| Item | Status | How it is shown |
|---|---|---|
| F1 Repository, strict TypeScript, ESLint (accessibility and layering), Prettier, module folders | done | `npm run typecheck`, `lint`, `format:check` in CI |
| F2 Test tooling at every level | done | Vitest (unit, integration, component), Playwright on three engines, axe; 182 tests |
| F3 Design tokens, contrast test, bundled fonts with licences | done | `tests/tokens.test.ts`, `tests/fonts.test.ts` |
| F4 Empty app shell in the Studio layout | done | `e2e/layout.spec.ts` measures the four sizes; axe clean |
| F5 CI, Netlify config, security headers, bundle budget | **partly**: CI proven on GitHub; Netlify not linked | CI green on every push; `docs/hosting.md` |
| F6 Pinned visual container and the fixture plan | done (no baselines yet) | `config/visual.json`, CI visual job, `docs/fixtures/autumn-launch.md` |
| SP-1 to SP-6 | done | `docs/spikes/` (index: `docs/spikes/README.md`) |
| Commands section of `CLAUDE.md` filled in | done, `npm run perf` still to come (sprint 5) | `CLAUDE.md` |
| Stack confirmed in `docs/decisions.md` | written, awaiting Peter | "Stack" section |

### Not done

- **Netlify is not linked**, so there is no preview deployment and the live site does not exist. The sprint's own demo line ("empty app deployed with previews") is therefore not met. `netlify.toml` and the security headers are written and tested locally; they are unproven on the real service until you link it (`docs/hosting.md`).
- **No visual baselines.** The container is pinned and CI runs it, but screenshot tests start in sprint 1; decision 13 asks how baselines are made, because Docker is not installed on your PC.
- **`npm run perf`** does not exist yet (it arrives with UX-3 in sprint 5).

### Engineering days

Not measured. Claude did the work in one continuous session, so the plan's 16-day capacity cannot be compared with anything real. The plan already says velocity is re-estimated after sprint 2; from sprint 1 the unit is stories finished and accepted. Treat the sprint 0 estimate (16.5 days with SP-6) as unconfirmed.

### Problems found along the way (and fixed)

- Firefox and Safari refuse to connect to port 4190, which made the first WebKit spike runs fail. Spikes use 4200; the finding is in SP-1.
- Playwright's own Chromium does not enforce the pop-up blocker, which hid the main SP-1 result until real Chrome and Edge were used.
- Playwright's throwaway browser sessions have small, unrepresentative storage quotas and, in WebKit, refuse Blobs; spikes that need storage use persistent profiles.
- My own spike scripts hit the unauthenticated GitHub API limit (60 an hour); later polling is gentler.
- The spike build needed a browser to draw icons, which the Firefox and WebKit CI jobs do not have; the three icons are now committed.
- Firefox does not start on your PC (a Windows runtime problem outside our code); it runs in CI.

### What stays manual (please check by hand)

1. **Real Safari on a Mac**, for everything: pop-up blocking, closing windows, fullscreen, storage limits and private windows, motion on the graphics chip, installing as a Dock app.
2. **A second display and a projector**: audience window placement and fullscreen.
3. **A covered audience window** (SP-1): the audience page shows how long it was hidden.
4. **Your own Firefox 157** for the pop-up behaviour (Playwright's Firefox ran only on Linux).
5. **60 fps on your laptop** with the motion page, normal and `?heavy` (SP-4).
6. **Installing Cue** in Chrome and Edge, and opening it offline (SP-6).
7. Fonts and text wrapping on macOS and Linux desktops (the bundled fonts remove most variation; checked in CI on Linux only).

### Demo script (45 minutes)

Run the spike pages with the `npm run spike:sp-N` commands from the project folder; each serves http://127.0.0.1:4200.

1. (3 min) Open https://github.com/PetesPen/cue/actions and look at the latest run: every job green, including Firefox and the visual container check.
2. (4 min) `npm run dev`, open the address it prints. Compare with `design/screenshots/Main.png`: top bar, slide rail, slide, notes strip, inspector. Click the Design, Animate and Transition tabs and use the arrow keys. Resize the window: the slide stays 16:9.
3. (6 min) SP-1, `npm run spike:sp-1`: in Chrome press "Open audience and presenter". Expect the first window to open and the second to be blocked. Allow pop-ups for the site and try again. Step with the arrow keys in either window; close the audience window and press "Reconnect audience". Read `docs/spikes/SP-1.md`, then decision 10 (settled as Option B).
4. (4 min) SP-4, `npm run spike:sp-4`: press the buttons, then add `?heavy` to the address and press them again. Judge by the figures in the box and by eye.
5. (5 min) SP-3, `npm run spike:sp-3`: make the deck, export it, then switch the network off and open the downloaded `cue-sp3-export.html`. Click through the slides.
6. (3 min) SP-5, `npm run spike:sp-5`: press the three buttons.
7. (5 min) SP-6, `npm run spike:sp-6`: in Chrome install Cue from the address bar, stop the server (Ctrl-C), and open the installed app: it still works offline.
8. (6 min) `docs/spikes/README.md`: the verdict table. Then `docs/decisions.md`: open decisions 11, 12 and 13, and the design change on the States board.
9. (5 min) Link Netlify (`docs/hosting.md`), so the next push produces a preview.
10. (4 min) Decide Gate 1.

### Retrospective questions

1. The spikes changed the plan twice (the way a show opens its windows, and how performance is judged). Do you want that kind of finding raised earlier, mid-sprint, rather than collected at the review?
2. Several of the biggest risks need things only you can provide (a Mac, a second display, Netlify, Docker). Which of those can you arrange before sprint 1?
3. The sprint was done in one long session, so there was no natural place to stop and ask you things. Would you prefer a checkpoint after each foundation item and spike next time, even if it slows things down?

### Peter's answers (2026-10-15)

1. Findings that change the plan can be raised mid-sprint; that is fine.
2. (Not answered yet: which of a Mac, a second display and Docker he can arrange.)
3. He prefers to touch base only at the end of each sprint, unless a significant decision is needed. Recorded as working rule 9 in `CLAUDE.md`.

Also on 2026-10-15: Peter linked Netlify to the repository, and asked where Gate 1 is defined. It was only a one-line placeholder in the plan; "The five gates" in `docs/development-plan.md` now explains gates and writes out Gate 1's criteria.

### Review outcome (2026-10-15)

- **Gate 1 accepted.**
- Decisions 11, 12 and 13 settled (see `docs/decisions.md`); the two design changes to the States board were approved and made in the board source.
- Netlify linked: https://cue-presentations.netlify.app/ serves the current build with our security headers. Our end-to-end tests pass against it except two that catch a script Netlify injects (the Netlify Drawer). Peter to switch it off.
- Sprint 0's last open item, the preview deployment, is therefore met for the live site; previews of pull requests start in sprint 1.

## Sprint 1: Decks, shell and saving

**Dates:** started 2026-10-15 after Peter approved the plan (dark mode dropped: decision 14), built the same day.

**Goal:** create decks, add slides, close the tab and find everything again. **Met.** The five stories are built and shown working on the Netlify preview of pull request 2 (the same build that is on the live site once merged). Four stories are complete; SV-1 is complete except two criteria that cannot be met yet (see "Not done").

### What finished

| Story | Status | How it is shown |
|---|---|---|
| UX-1 A sleek, uncluttered editor | done | `e2e/layout.spec.ts` measures rail 208, inspector 296, notes 124 px; `tests/styles.test.ts` keeps colours, the UI font and motion within the design; axe clean |
| SL-1 Add a slide | done | button, New slide, Ctrl+M and Cmd+M (component and end-to-end tests); property tests on the command |
| SL-2 Navigate between slides | done | listbox with Up, Down, Home, End; current slide marked by outline, bold number and `aria-selected` |
| SV-1 Autosave locally | **partly** | saved within 2 s, indicator, reopen restores decks (end to end on every engine), IndexedDB only, warning at 90% of the real quota, "Changes can't be saved" banner |
| SV-2 Manage multiple decks | done | library newest first with thumbnail, count and date; new, open, rename, duplicate, delete with confirmation; title edited in place |

Tests now: 347 Vitest tests (178 at the end of sprint 0): unit, integration with a fake IndexedDB, and 54 component tests in a real Chromium window of 1440 x 900 with the app's own styles. End to end: 17 tests per browser engine, run on Chromium and WebKit locally (34 pass), on all three engines in CI, and against the preview (34 pass). Coverage on `model` and `render`: above 90% (model 96%, render 100%). First-load bundle: 108 KB of 300 KB, CSS 3.7 KB of 30 KB.

### Not done

- **SV-1: images in a reopened deck.** The store saves and returns photos byte for byte in the same transaction as the deck (integration tests), but there is no way to put a photo on a slide until EL-4 (sprint 4), so "including images" cannot be shown end to end yet.
- **SV-1: the Export deck action** on the "almost full" and "can't be saved" banners. Export is SV-3 (sprint 9). Until then the banners offer **Manage storage** (opens the library in a new tab so the open deck keeps its unsaved edits) and **Try again**. The delete confirmation also lacks the design's "Export a copy first" sentence for the same reason.
- Library features that belong to other stories and were left out on purpose: search, the starter layouts row (TH-2), Open file and the backup reminder (SV-3), the Recent / Name toggle.

### Where the screens differ from the boards

`design/` was not touched. These are deliberate, for you to confirm or change:

- The library's wordmark reads "Cue" (the board says "Slides"), as in the editor shell.
- The "almost full" and "can't be saved" banners offer Manage storage and Try again, not Export deck (SV-3, sprint 9).
- The delete confirmation drops "Export a copy first if you might want it back" until export exists.
- The library has no search, starter layouts, Open file, backup reminder or Recent / Name toggle (other stories).
- The editor top bar has only Add slide and the save status; Text, Shape, Image, Undo, Redo, Export and Present arrive with their stories.
- The deck title in the editor is an input that looks like plain text until hovered or focused.
- A dialog dims the page behind it (a 40% forest tint); the boards show the dialog on its own.
- "Rename" is a small dialog; the boards show the menu item but not what it opens.

### Engineering days

Not measured (same reason as sprint 0: one continuous session). The plan's 16 days cannot be compared with anything real. From here the unit is stories accepted per sprint.

### Problems found along the way (and fixed)

- **A real data-freshness bug**, found by a component test written for it: leaving the editor straight after an edit could open the library before the save landed and show the old title. The store now makes every read wait for writes already running, with an integration test.
- **One damaged deck, or one saved by a newer Cue, hid the whole library.** The library now skips a deck it cannot read and leaves it untouched in storage (decision 17 asks how to show such decks later).
- Component tests were running in a 414 px window, where the three-column editor collapses, so some "visible" checks failed for the wrong reason. They now run at 1440 x 900 with the app's tokens and fonts.
- The first CI run failed on two checks: the WebKit-on-Linux engine ignored the way a test replaced the browser's storage report, and the visual job still looked for the old page heading. Both fixed.
- Installing the GitHub tool needed a Windows administrator prompt, which a background shell cannot show; it was run in your Terminal tab.
- Netlify's injected Drawer script is off (you switched it off), and the end-to-end suite now passes against the preview including "no console errors".

### What stays manual (please check by hand)

1. **Real Safari on a Mac**: everything in the demo script, and **Cmd+M** (macOS keeps it for Minimize; Ctrl+M is the one that should work there; decision 15).
2. **Your own Firefox** (it cannot start through our test tool on your PC): the demo script.
3. **How it feels and looks** against `Main.png` and `Home.png`: spacing, the weight of the thumbnails' outline, the dialog's dimmed backdrop (the boards do not show one).
4. **Keyboard only and a screen reader**: Tab through the library and the editor; the rail is one Tab stop and Up and Down move inside it; menus close with Escape. Automated checks cover the roles and names, not how a screen reader sounds.
5. **Zoom to 200%** and your system's **reduced motion** setting (the only moving thing is the Saving spinner, which then stops).
6. **Two tabs on the same deck** (decision 16): edit the same deck in two tabs and see that the later save wins. Known, not handled yet.

### Demo script (45 minutes)

Use https://cue-presentations.netlify.app/ (or the preview link on pull request 2). Use a private window first if you want to start from an empty library.

1. (2 min) Open the site. Expect "Your decks" with "No decks yet" and a New deck button. Compare with `design/screenshots/Home.png` (it has more than this sprint builds: search, starter layouts, backup reminder).
2. (4 min) New deck. Expect the editor with one blank slide titled "Untitled deck". Compare with `Main.png`: rail, slide, notes strip, inspector. Click the title, type "Autumn Launch", press Enter. Watch the top right: "Saving…", then "Saved".
3. (5 min) Add slides: the "+ Slide" button, then Ctrl+M (also Cmd+M on a Mac, which may only minimise the window), then "New slide" under the rail. Each new slide appears after the current one, is highlighted, and the canvas has the focus ring.
4. (4 min) Click thumbnails. Then with a thumbnail focused press Up, Down, Home and End: the selection and the canvas follow and stop at the ends.
5. (4 min) Close the tab, reopen the site: Autumn Launch is in the library with its slide count and "Edited just now". Open it: every slide is there.
6. (8 min) In the library: make two more decks. Use each card's "..." menu: Rename (try Cancel and Escape too), Duplicate, Delete (try Cancel first, then Delete deck). Reload to confirm it all stayed. Note the order: newest edit first.
7. (4 min) Keyboard only: Tab to a card's "..." button, open the menu with Enter, move with Up and Down, close with Escape (focus returns to the button).
8. (3 min) Look at "Stored on this device" in the library: it is the browser's own figure.
9. (5 min) The "almost full" and "Changes can't be saved" banners need a nearly full store, which is hard to reach by hand; the automated tests cover them. If you want to see them, in Chrome's DevTools use Application, Storage, "Simulate custom storage quota".
10. (4 min) Open the same deck in two tabs and edit both (decision 16), then read decisions 15, 16 and 17.
11. (2 min) Decide what to accept (see "Retrospective questions" below).

### Retrospective questions

1. This sprint was planned in a summary and built straight through. Did the summary give you enough to approve, or would you want to see the screens (a mock-up or the first build) before the sprint is far along?
2. Pull requests with previews are now the default. Do you want the app to fix failing checks automatically and tell you (an option in this app), or only be told when a pull request is ready?
3. The library leaves out search, starter layouts and Open file until their stories. Do you want any of them earlier than planned?

### Peter's answers (2026-10-15)

1. "I'm happy with everything": accepted every story. Retrospective questions 1 and 3 (was the summary enough, and any library features earlier) were not answered separately; nothing suggests a change.
2. Decision 15 (Cmd+M on a Mac): keep as it is; he uses only Windows and Linux, so macOS is not a concern for him.
3. Decision 16 (same deck in two tabs): agreed. New story SV-7 in sprint 2.
4. Decision 17 (decks Cue cannot read): agreed. Sprint 9.
5. Pull-request Auto-fix: no thank you. Claude reads the checks itself.
6. Can arrange a second display and Docker.

### Review outcome (2026-10-15)

- **Sprint 1 accepted** (UX-1, SL-1, SL-2, SV-2 complete; SV-1 accepted as complete for now, with its image and Export deck parts carried to sprints 4 and 9).
- Pull requests 1 and 2 are merged (squash) after green CI; the live site serves the sprint 1 build.
- **One thing found on the live site after the merge:** the production page still logs one console error, so four of the end-to-end tests fail when run against production (they pass against the pull-request preview). The cause is Netlify's "Powered by Netlify" badge, which Netlify adds to public sites on the free plan; our content policy blocks its inline script, so nothing shows and nothing breaks, but the error is logged. It is switched off with one project setting (see `docs/hosting.md`).
- Story SV-7 added from decision 16; totals are now 58 stories, 39 Must, 214 days.
- The sprint 2 plan is in `docs/plans/sprint-02.md` and waits for Peter's approval.

## Sprint 2: Elements you can move

**Dates:** plan approved 2026-10-16; built the same day.

**Goal:** draw shapes, then move, resize, rotate, layer and fade them. **Met.** All five stories (EL-5, EL-3, ZO-1, TR-1 and the new SV-7) are built and shown working on the Netlify preview of pull request 6 (the same build as the live site once merged). Two criteria wait for other stories (see "Not done"), and the first screenshot images wait for your review.

### What finished

| Story | Status | How it is shown |
|---|---|---|
| EL-5 Move, resize and rotate | done | end to end with a real mouse on Chromium and WebKit (Firefox in CI): drag, corner and edge handles, the turning handle, line ends, arrow keys, selection box, Shift-click, group move and resize, live readouts; geometry property tests |
| EL-3 Add shapes | done (text inside a shape moved to sprint 3; gradient is a Could and not built) | the six shapes, Shift for square and 15-degree lines, fill, border colour/width/dash, corner radius, all surviving a reload |
| ZO-1 Reorder with commands | done | property tests (the selection keeps its relative order); panel buttons, right-click menu and Ctrl+[ ] shortcuts; disabled when they would do nothing |
| TR-1 Fade any element | done for shapes (images and text arrive with their stories) | slider fades live; number field; the whole shape fades, border included; a selection fades together, differing values read "Mixed"; screenshot test pending your review |
| SV-7 One tab per deck | done | two tabs of one browser: the second says "This deck is open in another tab" and opens by itself when the first closes; different decks and the library are never blocked; no Web Locks, no change |

Tests now: 560 Vitest tests (347 at the end of sprint 1): the geometry and z-order property tests, 23 gesture tests, 108 component tests in real Chromium. End to end: 42 tests per engine (25 new for shapes and tabs), passing on Chromium and WebKit locally, on all three in CI, and against the preview. Coverage on `model` 99%, `render` 100%. First-load bundle 117 KB of 300 KB; CSS 4.6 KB of 30 KB.

### Not done

- **Text inside a shape** (the third EL-3 criterion) moved to sprint 3 with your approval; it needs the rich-text editor.
- **Image transparency in a PNG or SVG file** (the fourth TR-1 criterion) waits for images in sprint 4 (EL-4).
- **The opacity screenshot is not merged yet.** The three screenshot tests and their reference images are in two open pull requests that need your eye: pull request 8 (the tests, a draft) and pull request 9 (the images, into pull request 8's branch). They are explained under "Demo script".
- **Turning a group** is covered by unit tests but has no end-to-end drag.

### Velocity re-estimate (the plan asks for this after sprint 2)

Engineering days cannot be measured here: a sprint of work was done in one working session each time, so "16 days" has no real counterpart. The honest unit is stories accepted per sprint: **5 in sprint 1 and 5 built in sprint 2**, each with its tests. What this means for the plan:

- **Order and scope stay as they are.** Nothing found so far argues for moving a story between sprints; one criterion moved (text in a shape) because of a real dependency.
- **The calendar is set by your reviews, not by the building.** At the current pace the 12 remaining sprints are about 12 review cycles. If you want the whole plan sooner, the lever is reviewing less often (every two sprints, say), not building faster. This is the question at the end of this entry.
- **Where the effort and the risk are concentrated** (so reviews there are worth more): sprint 3 (rich text), sprints 7 and 8 (the two windows, with a second display), sprint 9 (deck files, offline, install), sprint 10 (the standalone HTML file).

### Problems found along the way (and fixed)

- **Lines were invisible.** An SVG with no height is not drawn at all, even with overflow shown, so a line (height 0) painted nothing. A test now checks that lines really paint.
- **The size and position chip lagged one mouse move behind** what was being dragged (the saved values were right). It is computed from the new values now.
- **In WebKit a drag stopped after the first move**: the browser started its own selection or drag from the slide and stopped sending events. The slide now forbids both.
- **A property test found a corner case** (two points a hair apart made the 15-degree snap lose precision); fixed.
- **Accessibility scans found two things**: panel section headings skipped a level, and the right-click menu sat outside any landmark. Both fixed.
- **Test harness traps** (not product bugs): a Windows path too long for Vitest's failure screenshots (those are now ignored by git), and substring matching of button names ("Back" also matches "Backward").
- One housekeeping note, for transparency: I force-pushed a branch of my own once (`el-5-select-and-move`), after pushing it by mistake a few minutes earlier and before it had a pull request. Your rule asks me to check first for force pushes; I should have used a new branch name instead and will.

### What stays manual (please check by hand)

1. **How dragging, resizing and turning feel**, with a mouse and with your trackpad: the pointer follows exactly; the 3 px before a click becomes a drag; the handles' size (7 px squares with a bigger grab area).
2. **Very small and very large shapes**: handles on a shape smaller than a few pixels sit on top of each other.
3. **Your own Firefox**: the demo script (it runs in CI on Linux).
4. **The three reference images** (pull request 9), including the green frame around the slide in `selection.png`, which is the keyboard-focus ring (the picture was made by selecting with Tab).
5. **Shortcuts on your keyboard layout**: Ctrl+[ and Ctrl+] use the physical bracket keys; on a layout where those need Shift or AltGr they may not work.
6. **The look of the format panel** against `Main.png`; the style controls (swatches and hex) are my own design.

### Demo script (45 minutes)

Use https://cue-presentations.netlify.app/. New deck, then:

1. (6 min) Open the **Shape** menu in the top bar. Draw each of the six shapes by dragging on the slide. Try Shift while drawing a rectangle (square) and a line (15-degree steps). Press Escape after choosing a shape: nothing is drawn.
2. (8 min) Click a shape: handles and the green chip. Drag it: the chip shows X and Y. Drag a corner handle (then with Shift), an edge handle, the round handle above the shape (then with Shift). Use the arrow keys (and Shift+arrow). Select a line: it has two end handles.
3. (6 min) Select several: Shift-click, or drag a box over empty slide. Move them, resize the group by its handles. Press Tab on the slide to walk through the shapes; Escape clears the selection.
4. (6 min) Format panel (Design tab): type into X, Y, W, H and Rotation (Enter to apply, Escape to undo the typing, Up and Down to step). Opacity: drag the slider (the canvas fades as you drag) and type a number. Select two shapes with different opacity: the field says Mixed. Change fill and border colour, width, dash, and the corner radius of a rounded rectangle.
5. (5 min) Arrange: overlap three shapes, select the bottom one, press Front. Try Forward and Backward, then the right-click menu on a shape, and the shortcuts Ctrl+] and Ctrl+[ (Shift for front and back). Note the disabled ones.
6. (3 min) Reload the page: everything is as you left it, in the slide's thumbnail too.
7. (3 min) Open the same deck in a second tab: it says it is open in another tab. Close the first tab: the second opens by itself.
8. (5 min) Open pull request 9 on GitHub (https://github.com/PetesPen/cue/pull/9), "Files changed": check the three images are what their names say, then merge it into pull request 8's branch, then mark pull request 8 ready (or tell me to).
9. (3 min) Read the open items at the end of `docs/decisions.md`.

### Retrospective questions

1. **How often do you want to review?** Reviewing every sprint is the plan. Every two sprints would roughly halve the calendar time, at the cost of bigger things to check at once. Which do you prefer?
2. **What did you expect to find that is not there?** For example, Delete and copy-paste of shapes are in sprint 3 (EL-7), Undo in sprint 4 (EL-8). Anything you would move earlier?
3. **Screenshot review** worked as designed (a workflow made the images and opened a pull request for you). Is that the right amount of effort for you each time a screenshot changes, or should I say in the pull request what to look at first?

### Peter's answers (2026-10-16)

1. Accepted all five stories (EL-5, EL-3, ZO-1, TR-1, SV-7).
2. "Merge the screenshots": done. The three reference images are merged into the screenshot-tests branch, and that pull request is made ready to merge once its own check has compared against them.
3. Review frequency: every other sprint is fine ("I've been happy with the progress to date"). Recorded as working rule 9: reviews after sprints 4, 6, 7, 9, 10, 12 and 13.
4. He turned the Netlify badge off. Checked: production serves no extra script and all 84 end-to-end checks pass against it.
5. Questions from him: is there a proper colour chooser on the to-do list, and are there plans for different design palettes? Answers are in decision 19: no picker was planned (only swatches and hex); palettes are TH-1, a Could after v1.0. A story EL-10 is proposed.
6. Not yet answered: the build choices to confirm (default shape size on a click, the Arrange row as the "toolbar", box-based hit-testing, palette plus hex).

### Review outcome (2026-10-16)

- **Sprint 2 accepted.** Pull requests 4 to 7 and 10 merged; the screenshot workflow ("Update screenshots") has worked once end to end and its first images are reviewed.
- Plans for sprints 3 and 4 are written for approval together (`docs/plans/sprint-03.md`, `sprint-04.md`); the next review is Gate 2 after sprint 4.


## Sprints 3 and 4: Rich text, notes, pictures, undo and slide management (Gate 2, "Editor alpha")

**Dates:** plans approved 2026-10-16 (with the colour picker, EL-10, added to sprint 3 and Autumn Launch as the Gate 2 deck); both sprints built the same day, with no review between them (the every-other-sprint rhythm).

**Goal:** build and save a real deck of text, shapes and pictures, with undo. **Met on the evidence below; the gate itself is yours to pass or not** (criteria in `docs/development-plan.md`, "Gate 2 criteria"). All nine stories are built and shown working on the Netlify previews, with their tests green on Chromium, Firefox (in CI) and WebKit. Two things wait for you: the reference images of the text screenshot tests (pull requests 15 and 17), and the manual checks.

### What finished

| Story | Status | How it is shown |
|---|---|---|
| EL-1 Add rich text | done | T or the Text button, click or drag; double-click or Enter to edit in place; mixed fonts, sizes, colours and styles in one box; lists, alignment, indent, line spacing; fill, border and padding; the floating toolbar and the Text section of the Design panel. A test compares where every piece of text sits in the editor and in the drawn slide for seven mixed samples (identical to 0.01 px); paste tests with the clipboard HTML of Word, Google Docs and a web page |
| EL-2 Choose fonts | done, except the export part (sprint 9) | font picker as on the board (search, fonts in this deck first, each name in its own typeface); a test for every style button for every font; only the fonts a deck uses are loaded until the picker is opened |
| SL-6 Add speaker notes | done, except "shown in presenter view" (sprint 8) | plain text under the slide, saved per slide within 2 seconds and when the tab closes |
| EL-7 Copy, paste and delete | done | Ctrl+C, X, V, D, Delete and Backspace, across slides; the right-click menu; plain text from other programs becomes a text box; a format of our own keeps all formatting |
| EL-10 Pick any colour | done | one picker for fill, border, text colour: swatches, "In this deck" colours, a shade and brightness area, a hue slider, a code field, an eyedropper where the browser has one; live while dragging, one step; keyboard and screen reader |
| Text inside a shape (carried from sprint 2) | done | Enter or double-click on a shape; fading the shape fades its text |
| EL-4 Add images | done | the Image button, drop (centred on the drop point) or paste; PNG, JPEG, GIF, SVG, WebP recognised by their bytes; scaled down over 2560 px with the toast; originals kept under 8 MB; friendly messages; saved with the deck in one transaction; unused photos swept at startup |
| EL-8 Undo and redo | done | Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y and the top bar buttons; one step per drag, resize, slider drag or burst of typing; property tests over every command, also with merging |
| SL-3 Reorder slides | done | drag with a drop line, or Ctrl+Shift+Up and Down; undoable |
| SL-4 Duplicate and delete slides | done | Ctrl+D, Delete, right-click menu; the "Slide N deleted" toast with Undo; the only slide leaves a blank one |

Tests now: 958 Vitest tests (560 at the end of sprint 2). End to end: 88 tests per engine (42 at the end of sprint 2), passing on Chromium and WebKit locally and on all three in CI, and the new ones against the preview of each pull request. Coverage on `model` 97.9%, `render` 99.6%. First-load bundle 134 KB of 300 KB (117 KB at the end of sprint 2); CSS 6.1 KB of 30 KB; the text editor, loaded when text is first edited, 118.5 KB of its own 160 KB budget.

### Not done

- **Notes in the presenter view** (SL-6) and **fonts embedded in the HTML export** (EL-2): they need the presenter (sprint 8) and the export (sprint 9).
- **Animations and transitions in a duplicated slide** (SL-4): they do not exist yet; sprints 5 and 6 add them to the duplicate.
- **The text screenshot tests** are written and their five reference images are made, but wait in pull requests 15 (the images) and 17 (the tests, a draft) for your eye. A picture-fading screenshot (the TR-1 criterion about transparency) will join them; the fade itself is tested on the real element.
- **From the Editor-Text board, not built:** "Track" (letter spacing; no story asks for it) and the "Weight" menu (the Bold button does that job); "Text colour opacity" is TR-2 in sprint 11.

### Gate 2 rehearsal: rebuilding "Our approach", and what was missing or awkward

The fixture deck Autumn Launch (12 slides, as data, in `tests/fixtures/autumnLaunch.ts`) opens and every slide is drawn. Its hero slide is rebuilt through the interface by an end-to-end test (`e2e/autumn-launch.spec.ts`): the eyebrow and the title in different sizes and colours, three rules and three rows of words, a rectangle, a circle, a picture with a description and a 60% fade, notes, undo and redo, a duplicate slide, and a reload. About fifty steps; it passes on Chromium and WebKit. What building it showed:

1. **No slide background.** The design's slides are dark, yellow and mint. There is no control for it (SL-5, a Should), so in the interface you would put a full-slide rectangle at the back. The fixture sets the background in the data. I recommend pulling SL-5 forward: it is small and the sample deck needs it.
2. **No letter spacing.** The eyebrow ("03 — STRATEGY") is spaced out in the design. Worth a story if you want that look.
3. **Weights.** The design's titles look heavier than Bold. The fonts are variable (a range of weights), but only Regular and Bold are offered.
4. **Aligning by eye is slow.** No snap lines or alignment buttons (EL-6, a Should): lining up the rules and rows meant typing positions into the panel.
5. **No layers panel** (ZO-2, a Should): with the picture and the circle overlapping, selecting the one underneath needs Tab or a selection box.
6. **List markers** (bullets and numbers) take the size of the box's base text, not the size of the words beside them.
7. **Rows like "01   Listen first"** are made with spaces; there are no tab stops.
8. **The Image panel** differs from the board: the description is its own section, not the line at the top beside the file name.

### Problems found along the way (and fixed)

- **ProseMirror puts back cursor moves it did not make for about 50 ms after it puts the cursor in place.** A key pressed in that moment (a test does this; a person cannot) seemed to do nothing. Tests wait a moment; focus is now set at once instead of a frame later, so typing is never lost.
- **In Safari and other WebKit browsers, a field that moves focus on Enter let the Enter key type a line in the text behind it.** Enter in the number and colour fields no longer does that.
- **Undoing a deletion of text would have deleted the text box.** Ending the editing of an empty new text box removes it, so undo restarts the editor without ending it.
- **Typed words could be lost when a tab closed within a second of typing.** Typing in a text box and in the notes now registers what is pending, and it is given to the deck before the deck is saved when the tab closes or the deck is left.
- **A squash-merge left a button twice** after a merge of main into a branch; found by reading the diff, removed.
- **Test harness traps** (not product bugs): clipboard and file-drop tests use synthetic events; fonts picked in one test were already loaded in the next, so that test has its own file.
- I force-pushed nothing this time; branches that depended on a squash-merged branch were brought up to date by merging main and keeping their own files.

### What stays manual (please check by hand)

1. **Typing with an input method** (Japanese, Chinese, accents by dead keys) in a text box; **pasting from Word, a web page and a PDF**, as you would.
2. **How the floating toolbar and the colour picker feel**, and the picker's layout (it is my own design, from the Style Guide's pieces; the boards show only a swatch and a code).
3. **Dragging pictures in from your file manager and from a browser; pasting a screenshot**; a real camera photo of 6000 x 4000.
4. **Undo with a trackpad** and the feel of undoing a burst of typing.
5. **Text at 200% browser zoom**, and on your Firefox.
6. **The reference images** (pull request 15): fonts, lists, fading text, the editor, both pickers.
7. **A full rehearsal:** build a slide of your own from a blank deck (Gate 2 criterion 5).

### Demo script (45 minutes)

Use https://cue-presentations.netlify.app/ (after pull requests 20 and the ones before it are merged; each pull request also has its own preview). New deck, then:

1. (8 min) **Text.** Press T, click the slide, type. Select words: make some bold, change the size and the font (the picker lists each font in its own typeface; try Caveat: no italic button; DM Serif Display: no bold). Make a bullet list, change the alignment and the line spacing. Press Escape, double-click to edit again. Fill a box, give it a border and padding in the Design panel.
2. (5 min) **Colour.** Select words, open the text colour button, drag across the colour area and watch the words change; type a code; use the eyedropper if your browser has it. Open a shape's fill: the colours the deck uses are listed first.
3. (4 min) **Paste.** Copy a paragraph from Word or a web page and paste it into a text box: bold, italic, underline and lists stay; other styles go. Copy shapes and a text box, paste on another slide.
4. (3 min) **Notes.** Type notes under the slide; change slides: each has its own; reload.
5. (6 min) **Pictures.** Click Image and choose a photo; drop one on the slide; paste a screenshot. Try a huge photo (the toast, Undo). Try a text file renamed .png (a clear message). Describe a picture in the Design panel; fade it; resize it by a corner (proportions stay) and by a side.
6. (6 min) **Undo.** Make a few edits, press Ctrl+Z many times, then Ctrl+Shift+Z. Type some words, press Ctrl+Z while typing. Delete a slide and use the toast's Undo.
7. (5 min) **Slides.** Drag a thumbnail (watch the line), Ctrl+Shift+Down on a slide, Ctrl+D to duplicate, right-click a thumbnail.
8. (8 min) **The real deck.** Open the fixture deck (a developer link on the preview, or run the test), look at slide 3, and try to rebuild a slide of it yourself. Write down what annoys you.

### Retrospective questions (most important first)

1. **Gate 2: yes, no, or not yet?** The five criteria are in `docs/development-plan.md`. Number 5 (building a slide yourself) is the one only you can answer.
2. **Slide background (SL-5) into sprint 5?** The rebuild needed it. It is small.
3. **Do you want letter spacing and a heavier weight?** Two small additions to the text controls; each would be a new Could or Should story.
4. **The colour picker's layout and the Text section of the panel:** are they what you want, or should they be drawn? (The boards do not show either.)
5. **Reference images** in pull requests 15 and 17: are they right?
6. **Originals of scaled pictures:** kept under 8 MB when there is room, as the plan said. Is that the right limit?
7. **Snap lines and a layers panel** (EL-6, ZO-2) made the rebuild slower. They are Shoulds in sprint 11; would you move them earlier?
8. **Plans for sprints 5 and 6** (written for you to approve together, `docs/plans/sprint-05.md` and `sprint-06.md`).

### Review outcome (2026-10-16)

Peter tried the live app: "I've had a play and I'm really happy with it."

1. **Gate 2 (editor alpha): accepted.** All nine stories of sprints 3 and 4 are accepted.
2. **Slide background (SL-5)** into sprint 5: yes. Built there as the solid colour and "Apply to all slides"; the image background and its opacity stay in sprint 12.
3. **Letter spacing and a heavier weight:** fine for the moment; no story added.
4. **The colour picker's layout and the Text section of the panel:** kept as built.
5. **The reference images** of pull requests 15 and 17: fine. Both still need merging (the first into the branch of the second, then the second into `main`); the merge waits for Peter to say "merge the screenshots", as before.
6. **Originals of scaled pictures** (under 8 MB): fine.
7. **Snap lines** earlier: yes, "I really value the snap lines": align and snap (EL-6) moved from sprint 12 to sprint 6. "Not so concerned about layers panels just yet": ZO-2 stays in sprint 11.
8. **The animation timing controls (AN-4)** into sprint 5 rather than sprint 11: yes.
9. **Decision 20** (fonts, italics and mixed selections): "that makes sense, I'm happy with things as you've done them".
10. **The plans for sprints 5 and 6:** approved, with the three changes above.

Next: sprints 5 and 6 are built with no review between them; the next review is after sprint 6.


## Sprints 5 and 6: Keyboard, speed, animations and transitions

**Dates:** plans approved 2026-10-16 (with the slide background and the timing controls added to sprint 5, and align and snap added to sprint 6); both sprints built the same day, with no review between them (the every-other-sprint rhythm). Review: now.

**Goal:** drive the editor from the keyboard on big slides and decks, animate elements (appear, disappear, move) click by click and play them in the editor, and choose how each slide arrives. **Met on the evidence below.** All twelve stories are built and shown working, with their tests green on Chromium and WebKit here and on Firefox in CI (pull requests 26 and its predecessors); two criteria that need the show and the export wait for sprints 7 and 10 (listed under "Not done").

### What finished

| Story | Status | How it is shown |
|---|---|---|
| UX-2 Keyboard-first work | done, except the Present keys | one table of shortcuts feeds the key handler, the hints and the sheet; new keys S, I, `?`, Ctrl/⌘ S (save now), Ctrl/⌘ Shift D (duplicate slide), up and down arrows between slides; the cheat sheet of the Shortcuts board; a hint with key caps on every toolbar and Arrange button. A component test per shortcut |
| UX-3 Responsive performance | done | `npm run perf` (nightly): 50 elements drag and resize at 60 fps in Chromium, also with the processor 4 times slower; a deck of 50 slides opens in 0.07 to 1 s; typing waits 17 to 25 ms for its frame; thumbnails drawn only near the visible rail (the worst case, 50 slides of 50 elements, opens in 0.5 s at 4 times slower, from 1.3 s). On every pull request: component tests count the work (one element redrawn, one thumbnail touched) |
| SL-5 Slide background | done (the solid colour; the image is sprint 12) | the Slide section of the Design tab, with Apply to all slides; one undo step |
| AN-1 Appear, AN-2 Disappear | done | the Animate tab as on the board; instant, fade, or fade and rise; faded in the editor with numbered badges; a resolver with table and property tests |
| AN-4 Timing and feel | done | Duration, Delay and the four easings, defaults 0.5 s, none, ease out |
| TR-3 Transparency in animation | done, except the show and the export | an element appears to its own opacity, not 100%; the same number in the editor, the thumbnail and Preview |
| AN-3 Move | done | the end is a dashed copy on the canvas, dragged, moved with the arrow keys or typed (End X, End Y); the element ends there and stays; a Preview returns every element to its place |
| AN-5 Sequence steps | done | steps under "Click n" headings, dragged or moved with Alt and the arrows, On click or With previous; table and property tests |
| AN-6 Preview | done | the bar of the board: Play click N, back, forward; Esc; never touches the deck, the history or the saved copy |
| TN-1 Choose a transition | done | the Transition tab of the board (five effects as small pictures), a small arrow on the thumbnail, the first slide says it has none |
| EL-6 Align and snap | done | snap lines while dragging and resizing (Alt turns them off), align and distribute in the Design panel; the end of a Move snaps too |

Tests now: 1,243 Vitest tests (958 at the end of sprint 4). End to end: 112 per engine (88 before), passing on Chromium and WebKit locally and on all three in CI. Coverage `model` 97.9%, `render` 99.4%. First-load bundle 145.5 KB of 300 KB (134 before), CSS 7.5 of 30 KB, the text editor 118.5 of 160 KB.

### Not done

- **Presenting keys and Export** (UX-2): they are in the table and appear on the sheet when the show (sprint 7) and the export (sprint 9) exist.
- **TR-3 in the show and the HTML export**: the editor, the thumbnails and Preview match; the show (sprint 7) and the export (sprint 10) have their own tests when they exist.
- **Stepping back with an animation** (AN-7, sprint 11): Preview's back arrow shows the earlier state at once, which is exact; the reverse animation is the story.
- **A slide background image** with an opacity (SL-5's rest, sprint 12), the **direction, duration and Apply to all** of a transition (TN-2, TN-3), and **playing** a transition (sprint 7).
- **Firefox numbers of `npm run perf`**: Firefox cannot start on your PC; the nightly job will give the first ones (WebKit's software drawing is slow by design: 19 fps for 50 elements here, reported, not failed).
- **The reference images of the text screenshot tests** are out of date: they were taken before sprint 4, when the top bar had three buttons. They still pass only because the check allows 0.1% of pixels to differ, and a small change to the bar (or the Arrange row) pushes it over. The "Update screenshots" workflow will refresh them in a pull request for your eye (it is the first thing to do after you have looked at this review).
- Accessibility to improve later (UX-6): the dot and the arrow on a thumbnail are drawn, not yet announced; Preview plays its motion even when the computer asks for reduced motion.

### What building them showed

- **Wrapping a control for its hint** put each Arrange button in a wrapper, and the CSS that gives the first button of a row no left divider (`:first-child`) then removed every divider. The visual job caught it; the wrapper now takes no part in the layout and the rule names the first button of a row.
- **The reference images** being stale (above) was found the same way.
- **A hover test depended on where the last test left the pointer** (a new page under a pointer that has not moved gets no events, as in a real browser); the tests move the pointer away first. A Delete-in-text test was made patient on a busy machine.
- **The end-to-end database seed raced the app** on a slow engine (WebKit); it now waits for the database to exist and never creates it.
- **Escape in a search box clears the box first**, so the shortcut sheet closes on Escape from its search field itself.
- **Undo after Align selects only the elements the step moved** (one that was already on the line did not move); a test reselects, and the behaviour is the same as for any other step.
- **axe flagged the faded look** (an element that starts hidden is drawn at 45% of its opacity, so its text fails the contrast rule): the slide's own drawing is excluded from the contrast check in the end-to-end accessibility runs, because the colours on a slide are the author's.
- I never force-pushed: branches stacked on a squash-merged branch were brought up to date by merging main and keeping their own files.

### What stays manual (please check by hand)

1. **How motion feels in Preview**: speed, the rise, the Move; dragging the end of a Move and the steps in the list with a mouse and a trackpad.
2. **Snap lines**: the 6-pixel pull, the guide colour, Alt to turn it off, on a real deck.
3. **The shortcuts in each browser**: Ctrl/⌘ Shift D, Ctrl/⌘ S and `?` on your keyboard layout (Chrome, Edge and Firefox may use some of them); the hints with a screen reader.
4. **60 fps drags on your laptop and a Mac**, and a 50-slide deck of your own.
5. **The Animate tab, the Transition tab and the shortcut sheet against the boards.**

### Demo script (45 minutes)

Use https://cue-presentations.netlify.app/ after pull request 26 is merged (each pull request also has its own preview). Open the fixture deck (a developer link on the preview, or build the slide) and go to slide 3.

1. (5 min) **Keyboard.** Press `?` (the sheet), search "dup". Press S and draw a rectangle, I (the file chooser), Ctrl+Shift+D, the up and down arrows, Ctrl+Z, Ctrl+S. Hover the toolbar buttons.
2. (5 min) **Slide background.** With nothing selected, pick a colour in the Slide section, Apply to all slides, Undo.
3. (8 min) **Appear, Disappear, timing.** Animate tab: the picture and rows on click 1, the block leaving; change the style, the duration, the delay and the easing; Preview with Space and the arrows; Esc.
4. (6 min) **Move.** Select the circle, + Move: drag the dashed copy, nudge it with the arrows, type End X and Y; Preview; note that it returns to its place.
5. (6 min) **Order.** Drag a step to another place, Alt+Down on a focused step, With previous, Remove step; watch the "Click n" headings and the badges on the slide.
6. (4 min) **Transitions.** Transition tab: choose Fade, Slide, Push, Zoom; the arrow on the thumbnails; the first slide's note.
7. (6 min) **Snap and align.** Drag shapes near each other, near the middle of the slide, with and without Alt; resize by a handle; select several and Align, Distribute; Undo.
8. (5 min) **Big decks.** Open a deck of 50 slides (the performance fixture: a developer link) and drag and type in it.

### Retrospective questions (most important first)

1. **Sprint 7's plan** (`docs/plans/sprint-07.md`, with the Gate 3 criteria): approve, or change?
2. **The text reference images** (see "Not done"): shall I run the "Update screenshots" workflow now, for you to look at and merge?
3. **Snap lines**: are 6 pixels, the green guide and Alt-to-turn-off right? Should a turned element snap its sides when resized (today it resizes freely)?
4. **Preview's back arrow** shows the earlier state at once instead of playing the animation in reverse (that is AN-7, sprint 11): fine for now?
5. **Reduced motion**: should Preview (and later the show) skip animations when the computer asks for it, or play them as set? I left them playing (the presenter chose them for the audience).
6. **The wording** "+ Appear", "+ Disappear", "+ Move" and "Add a step for ...": the board shows only the effect buttons of a step that already exists, so the way a first step is added is my design.

### Review outcome (2026-10-17)

Peter looked at the live app: "Looks good to me."

1. **The sprint 7 plan** (with the proposed Gate 3 criteria and decisions 29 to 31): approved ("The sprint 7 plan looks good to me"). Whether Esc should ask before ending a show was not answered; the plan keeps the Audience board's behaviour (Esc ends the show).
2. **Snap lines:** a turned element should also snap when it is resized: yes. Built the same day: the corner (or the middle of the edge) being dragged snaps to the guides; an edge only to a guide it reaches at a clear angle; Shift (proportions) and a picture dragged by a corner still resize freely.
3. **Preview's back arrow** showing the earlier state at once: fine. **Reduced motion:** keep playing animations as set. **The wording** "+ Appear", "+ Disappear", "+ Move": fine.
4. **The reference images:** the "Update screenshots" workflow was run on `main` after pull request 26 merged and found nothing to change: it rewrote only pictures that differ by more than the 0.1% the checks allow, and these differ by less. It now makes every picture again (`--update-snapshots=all`); run again after pull request 27, its pull request will wait for Peter to look at the images.
5. Peter asked whether centring on the slide and lining elements up with each other are in the backlog: yes, both are EL-6 (built in sprint 6): Align to the slide for one element (left, centre, right, top, middle, bottom), Align to each other for several, Distribute for three or more, and snap lines to the slide's edges and middle and to other elements while dragging. He also noticed Move missing from the live Animate tab: the live site was still on sprint 5; Move arrived with pull request 26, merged on 2026-10-17.

## Sprint 7: Transitions and the two windows (Gate 3, "Motion beta")

**Dates:** plan approved 2026-10-17 (alone: sprint 7 has its own review); built the same day. Review: now, with the Gate 3 decision.

**Goal:** preview a slide's transition in the editor, then press Present: an audience window opens, this tab turns into the presenter view, and you step through the whole deck by keyboard with every animation and transition playing in both windows, until you end the show and the editor is back exactly as you left it. **Met on the evidence below**, with three things only a real machine can confirm (listed under "What stays manual").

### What finished

| Story | Status | How it is shown |
|---|---|---|
| TN-4 Preview a transition | done | the bar of the Editor-Transition board on the Transition tab ("Slide 2 → Slide 3", Preview transition) plays the slide before into this one, in place; a click, Esc, another slide or tab lands it at once; it is not an edit (no history step, no save); the first slide has no bar, None cannot be previewed. Component and end-to-end tests |
| TN-5 Transitions play smoothly | done, except 60 fps on real hardware | Fade, Slide, Push and Zoom are two layers of the shared renderer moved with `transform` and `opacity` only; the end state is drawn first, so an interrupted transition lands exactly; going back plays the same motion undone (Zoom reversed is a plain fade); no step of the new slide plays during the transition (steps start on a click). 21 component tests; `npm run perf` has a test per kind between the fixture's slides and between slides of 50 elements (here, with a graphics card: no late frames in any of the eight) |
| PM-1 Start a presentation | done, except the second display and full screen on real hardware | Present and "Present from this slide" (the chevron beside it, Ctrl/⌘ Enter, Ctrl/⌘ Shift Enter); the audience window opens from the click and this tab becomes the presenter view; Esc or End show closes it and the editor is back with the same slide, selection and tab; a blocked window shows the card of the States board ("Your browser blocked the audience window", Try again, Present in one window); the audience window scales to fit with black bars at any size. Two-page end-to-end tests, a blocked-window test, component tests of the card |
| PM-2 Present from the presenter view | done | the Presenter board: the slide on screen now, the next press (the next click's state, the next slide, or "End of presentation") with a badge saying what the click does, the notes, a navigator of every slide with a jump box, elapsed time (with pause and reset) and the time of day; the audience window has only the slide and a hint that fades after 3 seconds, no controls and no cursor. axe finds nothing on either window |

Also built ahead of their stories because they cost almost nothing here: the keys of the show (Right, Down, Page Down, Space and Enter forward; Left, Up, Page Up and Backspace back; Home and End; B and W blank black or white; a number then Enter; Esc ends; F full screen) and the first half of PM-3 (a BroadcastChannel carrying only the place, with "hello" so a window that opens late is told where the show is). Their stories (PM-3 in full, PM-6) are still sprint 8's.

The fixture deck Autumn Launch is presented from slide 1 to slide 12 in two windows by an end-to-end test: the hero slide plays its three clicks, the slides with a transition arrive with it (seen in the audience window), the end says "End of presentation", and Esc closes the audience window and returns the editor.

Tests now: 1,389 Vitest tests (1,243 at the end of sprint 6). End to end: 126 per engine (112 before), 252 passing on Chromium and WebKit here and on all three in CI. Coverage `model` 98.1%, `render` 99.5%. First-load bundle 149.7 KB of 300 KB (145.5 before), CSS 7.8 of 30 KB, the text editor 118.5 of 160 KB; the show windows are a lazy chunk of 5.6 KB (budget 40 KB).

### Not done

- **PM-3 in full (sprint 8):** the 100 ms limit measured, the Web Locks "is that window gone" signal (a presenter tab that is closed or reloaded does not yet close the audience window; going Back in the browser does), the reconnect action when the audience window was closed.
- **PM-4 resizable notes, PM-5's wording ("Next: step 2 of 3"), PM-7's target duration (sprint 8):** the notes are a fixed panel at 22 px; the next preview already shows the next click's state.
- **The reference images** of the visual tests need refreshing for the new Present button (see the pull request of the "Update screenshots" workflow).
- **Heavy-slide budgets** for transitions (50 elements per slide) are provisional (25% late frames, 50% for Zoom): the first nightly runs will say what the runner can do, and I will set them from the numbers.

### What building it showed

- **A stage, not a picture of the old slide.** Two layers of the shared renderer cost nothing extra to build and keep the end state exact; decision 31 held. The slide renderer's own `update` must not cancel a click's animation (the editor draws the new look right after starting it), so the stage's `show` ends a transition but leaves clicks alone.
- **The editor and the show never import each other.** The app (`App.tsx`) gives the editor one thing, how to open the audience window; the addresses of the show (`#/show/<deck>…`) moved into `model` (pure) so both read them; the picture cache moved into `storage`. The show windows are a lazy chunk.
- **Ending a show is a route change.** The editor remembers its slide, selection and tab in memory as the show starts and reads them when it comes back (reloading the page is a fresh start, as it should be).
- **The deck is saved first.** Present waits for the autosave to finish before the window opens, because the show reads the stored deck; a test checks it with a title still being saved.
- **React tries a page out twice in development**, so a show connects and hangs up its line cleanly and a presenter view that really goes away tells the audience window after a moment (not immediately).
- **Playwright's browsers do not enforce the pop-up blocker** (SP-1), so the blocked path is tested by making `window.open` return nothing; full screen is stubbed in the one-window test (a real first Esc only leaves full screen).
- **A test raced TipTap's delayed focus** (the font picker's keyboard test): the editor takes focus back a frame later. Fixed in the test.
- Two end-to-end tests were made patient on a busy machine: the whole-deck presentation (12 slides, 4 transitions) and the second tab waiting for a closed tab's lock.
- One run of the coverage suite failed one component test that passes alone and on the next run; I could not find which.

### What stays manual (please check by hand)

1. **A real second display and a projector** (Chrome and Edge move the audience window to the other display after asking; elsewhere drag it and press F): the card, full screen in each browser, the first Esc only leaving full screen.
2. **Real pop-up blocking** in Chrome, Edge, Firefox and Safari (Safari is stricter about how soon after the click the window must open).
3. **How each transition feels**, and 60 fps on your laptop and a Mac, with a busy slide.
4. **A short talk of your own** from start to finish in two windows (Gate 3, criterion 5).
5. **The presenter view and the audience window against the boards**, at your screen size.

### Demo script (45 minutes)

Use https://cue-presentations.netlify.app/ after this sprint's pull request is merged (each pull request also has its own preview). Open the fixture deck and go to slide 3.

1. (6 min) **Preview transition.** Transition tab: choose Slide; the bar "Slide 2 → Slide 3"; Preview transition; click the canvas during it; try Fade, Push and Zoom; slide 1 has no bar.
2. (8 min) **Present.** Press Present (or Ctrl/⌘ Enter); the audience window opens; this tab is the presenter view. Drag the audience window to a second display if you have one, press F in it.
3. (10 min) **Walk the deck.** Right and Left in either window; the hero slide's three clicks; watch the transitions between slides in both windows; Back plays them reversed; B, W; type a number then Enter; click a thumbnail; the Jump to box; the timer.
4. (5 min) **End.** Esc in the audience window, then again: Present from this slide, End show in the presenter view; the editor is back on the same slide with the same selection and tab.
5. (6 min) **Blocked window.** Block pop-ups for the site, press Present: the card; Try again; Present in one window (Esc returns).
6. (5 min) **Notes.** Add notes to a slide; they show in the presenter view.
7. (5 min) **A short talk of your own.**

### Retrospective questions (most important first)

1. **Gate 3** ("Do animations, transitions and the two windows work well enough to try a real talk?"): does it pass? The criteria are in `docs/development-plan.md`.
2. **Esc mid-show:** it ends the show at once from either window (the Audience board says so). Should it ask first? (Asked in the plan; not answered.)
3. **Where a transition plays:** only between neighbours (to the next slide, or back to the one before); jumping with a number or the navigator shows the slide at once. Right?
4. **A blanked screen:** the first Right, Space or Enter only brings the slide back, it does not also go forward. Right?
5. **Present in the top bar:** the green Present button and a small chevron menu ("Present from the beginning", "Present from this slide"). Is that how you want it, or should Present from this slide be the main button?
6. **Going back** to the slide before shows it with all its clicks played (as you left it). Right?
7. **The audience window opens as a window of 1280 by 720** (the browser decides where); on a second display it is moved there and sized to it. Anything you would change?
8. **The timer** starts with the first move of the show and has pause and reset (PM-7's target time is sprint 8). OK to have it early?

### Review outcome (2026-10-17)

Peter answered the retrospective questions.

1. **Gate 3 ("Motion beta") passes**: "I'm very happy".
2. **Esc mid-show:** it does not ask; it ends the presentation at once, from either window (as built).
3. **Present in the top bar:** keep the green Present button with the menu beside it (Present from this slide stays in the menu), with a visual tweak: the chevron is now part of the same green button (joined, with a thin divider), so it reads as belonging to Present. Done the same day.
4. **A transition plays only between neighbouring slides:** correct. A jump by number or from the strip shows the slide at once.
5. **A blanked screen:** correct. The first forward or back only brings the slide back.
6. Questions 6 to 8 (going back shows the slide before with all its clicks played; the audience window's size and the second display; the timer starting early) were not answered, so they stand as built.

## Sprint 8: A complete presenting experience (with TN-2 and TN-3)

**Dates:** plan approved 2026-10-17 together with sprint 9's; built the same day. **No review follows it**: Peter reviews after sprint 9 (rule 9), so these notes are read with that sprint's. Its questions are at the end.

**Goal:** rehearse a talk of your own without touching the mouse: the two windows stay together within a tenth of a second, closing or reloading either one does the right thing, the notes are the size you want and stay that way, and a transition can be given a direction and a length or applied to every slide. **Met on the evidence below.**

### What finished

| Story | Status | How it is shown |
|---|---|---|
| PM-3 Keep both windows in sync | done, except real Safari and a real second display | the place is drawn in the other window **9 to 20 ms** after a key press (median about 10 ms, 90th percentile about 15 ms, Chromium and WebKit here; the test holds Chromium and Firefox to 100 ms and reports WebKit). Each window holds a Web Lock named after itself and watches the other's: closing the audience window shows "The audience window was closed. The show goes on here." with **Reconnect** (a new window, caught up); closing the presenter tab closes the audience window after a few seconds' grace; reloading either window comes back at the same place (the audience window stays through a presenter reload). Two-page end-to-end tests of each, unit tests with pretend locks of every case |
| PM-4 Read and resize notes | done | the divider of the board (drag it, or focus it and use the arrows, Home, End; Shift for bigger steps), A− and A+ with the size shown (14 to 40 px in steps of 2), long notes scroll inside their panel, and the layout is remembered on this browser. Component tests and a mouse-drag end-to-end test; axe finds nothing |
| PM-5 Preview what comes next | done | the next click's state with "Next · Click 2 of 3" and a badge, the next slide as it opens, "End of presentation" on the last |
| PM-6 Navigate the deck | done | one table of show keys (`model/showkeys.ts`) read by the key handler, by the editor's shortcut sheet (its "Presenting" group) and by the tests; table and property tests |
| TN-2 Set duration and direction | done | the Transition tab as on the board: four arrows for Slide and Push ("New slide comes in from the right."), Duration from 0.2 to 3 s with its two ends shown; Preview and the show play what is stored |
| TN-3 Apply to all slides | done | "Apply to all slides" gives every slide but the first the same effect, direction and duration in one undo step; "Reset to none"; the first slide has neither |

Tests now: 1,479 Vitest tests (1,389 at the end of sprint 7). End to end: 138 per engine (126 before), 272 passing on Chromium and WebKit here. Coverage `model` 98.1%, `render` 99.5%. First-load bundle 150.5 KB of 300 KB, CSS 7.9 of 30 KB; the show windows are a lazy chunk of 7.5 KB (budget 40 KB).

### Not done

- **PM-7's target time** (amber at 90%, red when over) stays in sprint 12; the timer already has pause and reset.
- **Real Safari, a real second display and real window closing** (below).
- **The "Standalone web page" half of TN-2's footnote** ("Transitions also play in the exported HTML deck") is left off the panel until the export exists (sprint 10).

### What building it showed

- **A lock that is free does not mean its holder is gone**: a window that has not started yet holds nothing, and a window that is reloading lets go for a moment. A watcher waits for the lock, then gives the other window a few seconds' grace and asks again; the audience window only starts watching after it has heard from the presenter view once, so an audience window opened by hand does not close itself.
- **An empty grid row hidden with `display: none` is not a row**: the Reconnect banner's (empty) row collapsed, the notes got the banner's row and the presenter view lost its layout. The component tests of the notes found it; the row now stays, with no height.
- **`sessionStorage` is copied into a window opened by `window.open`**, so a remembered place is only used when the page was reloaded, and each role has its own key; a show that ends clears it. The two small things kept in the browser (the place of a show for a tab, the layout for the browser) are the only uses of the key-value stores; the storage-rules test says so by name and checks they hold no deck.
- **A scrollable list must take keyboard focus** (axe): the shortcut sheet grew with the show keys and began to scroll.
- **Two more tests raced TipTap's delayed focus** (a Delete in a text box); they wait for the editor to hold focus.
- **A development build tries a page out twice**: the show connects and hangs up its lines and locks cleanly, and a presenter view that goes away for real tells the audience window.

### What stays manual (please check by hand)

1. **Closing and reloading each window in real Chrome, Edge, Firefox and Safari**, and Reconnect on a real second display (Playwright's WebKit does not release a closed page's locks, so that one case is skipped there).
2. **Dragging the divider with a trackpad**, and the notes at several sizes on your laptop.
3. **A twenty-minute talk** of your own in two windows.
4. **The Transition tab and the presenter view against the boards**, at your screen size.

### Questions for the review after sprint 9

1. Is a few seconds' grace (4) before an audience window closes after its presenter tab is gone the right length? Too short and a slow reload closes it; too long and a closed tab leaves the window up.
2. Should the notes' size and the divider be remembered per deck rather than for the whole browser? (Built per browser.)

## Sprint 9: Deck files, browsers and offline use

**Dates:** plan approved 2026-10-17 with sprint 8's; built the same day. **This is the review of sprints 8 and 9 together** (rule 9); there is no gate here (Gate 4 follows sprint 10). Sprint 8's notes are the entry above.

**Goal:** save a deck to a file and open it in another browser; install Cue and open it with the network off; be told kindly on a phone that Cue is for larger screens. **Met on the evidence below**, with the things that need a real machine listed under "What stays manual".

### What finished

| Story | Status | How it is shown |
|---|---|---|
| SV-3 Save and open a deck file | done | **Export** (the board's dialog, also from a card's menu and Ctrl/⌘ E) makes a `.slides` file: a zip with `deck.json`, each picture once by its hash (and the original of a scaled-down one), and the fonts the deck uses with their licences. **Open file** (the library's top bar and its empty state) checks the whole file before storing anything and adds the deck as a **new** deck, never replacing one. A file that is not a deck, is cut short, is damaged, is too big, or is from a newer Cue shows a clear card ("Your decks are untouched") and changes nothing. Property test: any deck saved and opened is the same deck; Autumn Launch round-trips exactly; every kind of bad file has a test. End to end: Autumn Launch with a picture exported, opened in a fresh browser profile, and found with its picture, steps, transition and notes. Carried over from sprint 1: the storage banners offer **Export deck** (it works even when saving is failing: the file is made from the deck in the tab), the delete confirmation says "Export a copy first if you might want it back", and a deck Cue cannot read is a card with Delete |
| UX-5 Works in modern browsers | done, except real Safari | the whole end-to-end suite runs on Chromium, Firefox and WebKit on every pull request (Edge nightly); a phone-sized screen (under 700 px) shows the card of the States board ("Cue is built for larger screens", Copy link) instead of the editor, and a show window of any size still runs; a browser without what Cue needs gets a plain page saying what it lacks; the presenter view tells you to drag the audience window to the second screen and press F, until the first move; the blocked-window card is the explanation of pop-ups |
| UX-7 Install and work offline | done, except the real install flow | after one visit the whole app (57 files, 1.4 MB, the fonts, the show windows and the deck file code included) is in a service worker's cache: with the network off, a test reloads, makes and edits a deck, types text (the editor that loads on first use comes from the cache), opens the audience window, and no request fails. A new version **waits**: the banner ("A new version of Cue is ready", Update now, Later) never reloads anything by itself, never touches the stored decks, and if the new version does not take over within 3 s (the WebKit finding of SP-6) the worker and caches are removed and the page reloads. "Install Cue" is in the library's top bar only where the browser offers it. The worker is registered in production builds only. Headers: `sw.js`, `index.html` and the manifest are never cached by the browser |

Tests now: 1,568 Vitest tests (1,479 at the end of sprint 8). End to end: 151 per engine (138 before), 301 passing on Chromium and WebKit here (one skipped: closing a page in Playwright's WebKit does not release locks). Coverage `model` 98.1%, `render` 99.5%. First-load bundle 154.9 KB of 300 KB (150.5 before), CSS 8.3 of 30 KB; lazy chunks: text editor 118.6 of 160 KB, the show windows 7.6 of 40 KB, the deck file code with its zip library 8.7 of 30 KB.

### Not done

- **The backup reminder** of the Home board ("Your decks live only in this browser. It has been 14 days since your last backup…", Back up all decks) is not in any story's criteria, so it is not built; the story assumptions mention a reminder to export. It would need "Back up all decks" (every deck in one file), which is a story of its own. A question below.
- **The standalone web page** option of the Export dialog is greyed out with "Coming soon" until sprint 10.
- **The real update flow with two builds** is checked by unit tests with a pretend register and by hand (SP-6 did it with two builds); it is on the manual list.
- **Final app icons**: the interim ones are drawn from the logo mark.

### What building it showed

- **A clock before 1980 or after 2099 stopped a save** (the zip format cannot date an entry outside that): the date is clamped; a test uses four wrong clocks.
- **Opening is all or nothing**: the file is unpacked and every picture's hash, every name and every size is checked first; only then is the deck stored (with its pictures, in one transaction), as a new deck. The zip code reads only the names the layout allows and refuses oversize entries before inflating them.
- **The zip library is a lazy chunk**, and the editor reaches it by a dynamic import, so the first load grew by 2.6 KB only (the buttons and the dialog).
- **Export while a save is failing** had to read the deck in the tab, not the store: the session now hands the dialog the deck as it is, typed text flushed, with the pictures that are not stored yet.
- **A service worker in every end-to-end test** (production build) changed nothing that the suite could see; the offline tests prove the cache.
- **The decisions log kept two storage-rules**: the tests that forbid `localStorage`/`sessionStorage` now name the two small habits (sprint 8) as the only exceptions and check they hold no deck.
- Two flaky component tests raced TipTap's delayed focus and ProseMirror's start-up; both wait for what they need now.

### What stays manual (please check by hand)

1. **Install in Chrome and Edge (and Add to Dock in Safari)**: its own window and icon; start a show from the installed app (does the audience window open, and where?).
2. **A real update**: with the live site, publish a change, reload, see the banner, Update now, and that a deck is untouched.
3. **A real phone**: the card, and Copy link.
4. **Open a file made in one browser in another** (Chrome to Firefox to Safari), and a damaged one.
5. **Real Safari for the two windows** (pop-ups, full screen), and a real second display and projector (sprint 7 and 8's lists).

### Demo script for the review of sprints 8 and 9 (about 60 minutes)

Use https://cue-presentations.netlify.app/ after this sprint's pull request is merged.

1. (10 min) **Rehearse a talk.** Present from the fixture deck: both windows, the hero slide's clicks, the Next preview ("Next · Click 2 of 3"), the notes (drag the divider, A− and A+, then end the show and start again: they stay), the timer.
2. (8 min) **Windows that go away.** Close the audience window: the notice and Reconnect. Reload the presenter tab and the audience window: the place is kept. Close the presenter tab: the audience window closes.
3. (6 min) **Transitions.** Slide with a direction, a duration, Apply to all slides (and one undo), Reset to none.
4. (10 min) **Deck files.** Export (the button, Ctrl/⌘ E); open the file with Open file in another browser; open the same file twice; open a text file renamed to `.slides`.
5. (5 min) **Trouble.** Fill storage (the banner says Export deck); delete a deck from its card, with the new wording.
6. (8 min) **Offline and install.** Switch the network off in the browser's tools and reload; install Cue; the update banner when a new version is out.
7. (5 min) **A phone** (or a narrow window): the card.
8. (8 min) **A short talk of your own.**

### Questions for the review (most important first)

1. **Is the backup reminder** (Back up all decks, after 14 days) wanted in v1, and where: Home, with a story for "all decks in one file" (about 2 days)?
2. **Interim icons**: when will the final art come (and its maskable version)? Install shows them.
3. **"Install Cue"** is a quiet button in the library's top bar. Right? And the wording of the update banner?
4. **A few seconds' grace** (4) before an audience window closes after its presenter tab is gone: right length? (From sprint 8.)
5. **The notes' size and the divider** are remembered for the browser, not per deck. Right? (From sprint 8.)
6. **A phone** is anything under 700 px wide. Right?

### Review outcome (2026-10-17)

Peter answered the six questions. There is no gate here. Every answer agrees with what was built, so the build choices of sprints 8 and 9 stand.

1. **The backup reminder is wanted in v1:** "Yes please". It becomes a new story, **SV-8 "Back up all decks"** (Should, about 2 days): every deck in one file, and the Home board's reminder ("It has been 14 days since your last backup…", Back up all decks). It is proposed for sprint 10, after SV-4 and SV-5, and is the first thing cut if sprint 10 runs over; Peter decides with the sprint 10 plan.
2. **Final icons:** "soon ish". The interim icons (drawn from the logo mark) stay until Peter gives the art and its maskable version; they are needed before v1.0 (sprint 13).
3. **"Install Cue" in the library's top bar, and the update banner's wording:** fine, as built.
4. **The 4-second grace:** fine, as built.
5. **The notes' size and divider, remembered per browser:** right, as built.
6. **A phone is anything under 700 px wide:** right, as built.

Still manual, and carried to the rehearsal before Gate 4: the real install and update, a real phone, real Safari, a second display and a projector.

After the review, pull request 33's WebKit job failed on two tests that passed here: on Linux, WebKit turns the space in a downloaded file's name into an underscore (the test now accepts either), and the colour picker test read the colour before WebKit had drawn the last pointer move (it now waits two frames). Neither was a fault in the app; Firefox passed every test.
