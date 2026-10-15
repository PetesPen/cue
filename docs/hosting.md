# Hosting and CI: what is in place and what is left

Decided on 2026-10-14: Netlify hosts the live site and a deploy preview for every pull request. GitHub Actions runs the checks.

## In place (written and checked locally, F5)

- `netlify.toml`: build command, publish folder, security headers (including a strict content security policy) and long caching for built files. `.nvmrc` sets the Node version.
- `.github/workflows/ci.yml`: on every pull request and on `main`: typecheck, lint, format check, unit, integration and component tests, build with the bundle-size check, and the end-to-end tests (with axe) on Chromium, Firefox and WebKit in parallel.
- `.github/workflows/nightly.yml`: dependency audit, the full browser matrix including Edge, and a performance job that says it has nothing to run yet.
- `.github/pull_request_template.md`: the review checklist that stands in for a second reviewer.
- `config/budgets.json` and `scripts/check-bundle-size.mjs`: the first-load budget (300 KB of JavaScript and 30 KB of CSS, gzipped). `npm run build` fails when it is broken.
- Tests that keep these honest: `tests/ci.test.ts` (read-only permissions, every action pinned to a commit, job timeouts), `tests/netlify.test.ts` (the headers in `netlify.toml` match `config/headers.ts`) and `tests/bundle-size.test.ts`. The end-to-end tests run under the same content security policy, and one proves the browser blocks a request to another host.

## Verified on GitHub (2026-10-14)

CI run #1 on `main` (https://github.com/PetesPen/cue/actions/runs/38513587547) passed all four jobs: checks (52 s), end to end on Chromium (33 s), Firefox (45 s) and WebKit (72 s). That includes Firefox on Linux. The first scheduled nightly run (2026-10-14) also passed: dependency audit and the full browser matrix including Edge. Peter linked Netlify to the repository on 2026-10-15 (site: https://cue-presentations.netlify.app/). Claude checked it the same day: the page serves the current build (same bundle names as a local build), with every header in `netlify.toml` plus Netlify's own HSTS, and built files are cached as immutable. `npm run e2e:deployed` runs the end-to-end suite against a deployed address: 14 of 16 pass on the live site in Chromium and WebKit. The 2 failures are Netlify's injected `/.netlify/scripts/hud` script (the Netlify Drawer), blocked by our policy and logged as a console error; it should be switched off in the Netlify site settings.

## Verified on a pull request (2026-10-15)

Pull request 2 got a Netlify deploy preview at `https://deploy-preview-2--cue-presentations.netlify.app` (the pattern is `deploy-preview-<number>--cue-presentations.netlify.app`; the link also shows as a check on the pull request). It serves the same bundle as a local build and the headers in `netlify.toml`. After Peter switched the Netlify Drawer off, `E2E_BASE_URL=<preview address> npm run e2e:deployed` passed in full on Chromium and WebKit (34 tests), including "no console errors". From sprint 1 on, every story is checked this way before it is called done.

## Found after the first merge to `main` (2026-10-15)

The live site (production) serves a page with one extra script that the deploy previews do not have: `/.netlify/scripts/hud?variant=public`. It is Netlify's **Powered by Netlify badge**, which Netlify turns on by default for public projects on its free plans. The badge needs an inline script, our content policy forbids inline scripts, so the browser blocks it and logs one console error on every page load. Visitors see nothing and nothing else breaks. It is not the Netlify Drawer (Peter switched that off, and the previews are clean). Four end-to-end tests ("no console errors") fail when run against production for this reason: `E2E_BASE_URL=https://cue-presentations.netlify.app npm run e2e:deployed` gave 30 of 34 passing on Chromium and WebKit after sprint 1, and 78 of 84 after sprint 2: every failure is a "no console errors" check, and the preview of every pull request passes them all.

To switch it off (no redeploy needed, per Netlify's documentation): Netlify, Project configuration, General, "Powered by Netlify badge", turn off, save. We do not weaken the content policy for it.

## Left: needs Peter (accounts and permissions, so Claude cannot do these)

1. Create a GitHub repository for Cue (an empty one, with no README or licence). Done: https://github.com/PetesPen/cue. When it was checked on 2026-10-14 it was **public**, but the plan was a private one. Peter decides which; to make it private: repository Settings, General, Danger Zone, Change visibility.
2. Claude has added it as `origin` locally. Claude pushes `main` only after Peter says to (`CLAUDE.md`: no pushing unless asked), and for a public repository only after Peter confirms that public is intended. The first push may open a GitHub sign-in window on Peter's PC (Git Credential Manager); Claude cannot complete that sign-in.
3. In Netlify: Add new project, import from Git, choose the repository. **Done by Peter on 2026-10-15** (the preview links and the live site depend on it; CI does not). Signing in to Netlify with the GitHub account is the simplest route. Netlify reads `netlify.toml`, so no build settings need typing in. Deploy previews for pull requests are on by default.
4. Optional but recommended: in the GitHub repository settings, protect `main` and require the checks "Checks (typecheck, lint, format, tests, build)" and "End to end (chromium)", "(firefox)" and "(webkit)" before merging.

## What Claude then verifies

- The first CI run is green on all four jobs, including Firefox on Linux (Firefox cannot start on Peter's Windows PC; see `docs/decisions.md`).
- Netlify posts a preview link on a test pull request, and the preview serves the headers in `netlify.toml` (checked with a request to the preview address).
- The preview loads with no console errors.

Until then, the CI and Netlify files are untested against the real services. That is the only part of Sprint 0 foundations not yet proven.
