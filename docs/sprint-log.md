# Sprint log

One entry per sprint, newest at the bottom. Written by Claude at the end of a sprint (`/finish-sprint N`). Peter accepts or rejects each story at the review; nothing here is marked accepted.

## Sprint 0: Foundations and risk spikes

**Dates:** started and finished 2026-10-14 (one long working session). **Gate 1 (stack confirmed):** evidence is ready; Peter decides at the review.

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
