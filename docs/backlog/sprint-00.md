# Sprint 0: Foundations and risk spikes

- Capacity: 16 engineering days (2 engineers, about 80% focus, 2 weeks)
- Ends with Gate 1: Stack confirmed (end of sprint 0)
- Next: [sprint-01.md](sprint-01.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Foundations and risk spikes.

## Demo at the review

Empty app deployed with previews; spike findings and a go or no-go on the stack.

## Key automated tests

CI green end to end on an empty app; throwaway Playwright checks for each spike.

## Scope

No user stories this sprint. Deliver: Spikes SP-1 to SP-6, app shell, CI pipeline, design tokens.

### Foundations checklist

- [x] Repo, TypeScript strict, ESLint (accessibility and import-layering rules), a formatter, Vitest, Playwright, fast-check, axe-core, fake-indexeddb (F1, F2)
- [x] Module folders `model`, `render`, `editor`, `present`, `storage` with the import-lint rule enforcing one-way dependencies (F1; `tests/layering.test.ts` proves the rule)
- [ ] CI pipeline as in `docs/development-plan.md` (checks on every PR, preview deployment link posted on the PR, nightly job stubs). Hosting is Netlify: `netlify.toml` and deploy previews. Files written in F5 (see `docs/hosting.md`). GitHub side proven: CI run #1 on `main` was green on all four jobs on 2026-10-14, including Firefox. NOT proven: Netlify (previews, live site and the served headers), because Peter has not linked it yet; the nightly workflow has not run.
- [x] Design tokens from `design/tokens.css` wired in; token contrast unit test (4.5:1) (F3; `tests/tokens.test.ts` also keeps `tokens.css` and `tokens.json` in step)
- [x] App shell matching the Studio layout (top bar 52px, left rail 208px, inspector 296px, notes strip 124px) with empty panels (F4; sizes measured in `e2e/layout.spec.ts`, axe clean, inspector tabs work with the keyboard)
- [x] Bundle size budget recorded (F5: 300 KB JS and 30 KB CSS gzipped on first load, enforced by `npm run build`; baseline 67 KB and 1.9 KB). Fonts part done in F3: 11 open-licence WOFF2 files (374 KB, Latin subset) in `src/fonts`, all seven families confirmed SIL OFL 1.1, checked by `tests/fonts.test.ts`
- [ ] Fixture deck "Autumn Launch" planned (12 slides, see `design/screenshots/Main.png` and `Presenter.png`) and the visual-regression container pinned
- [ ] `CLAUDE.md` "Commands" section filled in with the real scripts
- [ ] `docs/decisions.md` updated: stack confirmed or changed after the spikes (Gate 1)

## Risk spikes (1 to 2 days each)

Each spike ends with a short written finding in `docs/spikes/SP-N.md`: what we tried, numbers measured, and a go / no-go. Spike code is throwaway and lives in `spikes/`.

### SP-1 Two-window show

- Question: Can one click open audience and presenter windows reliably in Chrome, Edge, Firefox and Safari, and keep them in sync within 100 ms?
- Stories at stake: PM-1, PM-3, UX-5
- Fallback if it fails: The presenter view opens as a second tab that the user places; a storage-event channel replaces BroadcastChannel if needed
- **Finding (2026-10-14, `docs/spikes/SP-1.md`):** sync is a go (about 17 ms at the 95th percentile against 100 ms, in every engine run; the storage-event fallback is not needed). One click opening both windows is a no-go as PM-1 is written: Chrome, Edge and Firefox block the second window until pop-ups are allowed. Needs Peter's decision 10. Safari, Peter's own Firefox, a second display and a covered audience window remain manual checks.

### SP-2 Rich text fidelity

- Question: Does TipTap text with mixed fonts, sizes and colour alpha wrap identically in the editor and in the static renderer?
- Stories at stake: EL-1, EL-2, SV-5
- Fallback if it fails: Render presentation and export text through the same TipTap schema, and strip unsupported formatting on paste

### SP-3 Single-file export

- Question: How large is a 30-slide, image-heavy deck as one HTML file, and how long does the export take?
- Stories at stake: SV-4
- Fallback if it fails: Re-encode images to WebP on export and warn above a size threshold

### SP-4 Motion at 60 fps

- Question: Do 50 animated elements and a full-slide transition hold 60 fps, and can the same engine step backward?
- Stories at stake: AN-3, AN-7, TN-5
- Fallback if it fails: Limit transitions to opacity and transform, and use a snapshot of the outgoing slide

### SP-5 Storage limits

- Question: How much can IndexedDB hold in each browser, and what happens when it is full or cleared?
- Stories at stake: SV-1, EL-4
- Fallback if it fails: Lower the image downscale target, request persistent storage, and make backup reminders firmer

### SP-6 Installable offline app

- Question: Can a web app manifest and a service worker make the app open fully offline and install in Chrome, Edge and Safari, with updates that wait for the user and no stale files served during development? How does the installed app behave when it opens the two show windows?
- Stories at stake: UX-7, PM-1, PM-3
- Fallback if it fails: Cache the app files with a small hand-written service worker, or ship offline use without an install prompt in browsers that cannot install
- Added 2026-10-14 when Peter put the PWA in v1 (UX-7). The sprint is now about 16.5 days of work. If it runs behind, pinning the visual-regression container moves to the start of sprint 1.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
