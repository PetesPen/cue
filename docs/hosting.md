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

CI run #1 on `main` (https://github.com/PetesPen/cue/actions/runs/38513587547) passed all four jobs: checks (52 s), end to end on Chromium (33 s), Firefox (45 s) and WebKit (72 s). That includes Firefox on Linux. The first scheduled nightly run (2026-10-14) also passed: dependency audit and the full browser matrix including Edge. Peter linked Netlify to the repository on 2026-10-15; Claude still needs the site address to check that the preview builds and serves the headers in `netlify.toml`.

## Left: needs Peter (accounts and permissions, so Claude cannot do these)

1. Create a GitHub repository for Cue (an empty one, with no README or licence). Done: https://github.com/PetesPen/cue. When it was checked on 2026-10-14 it was **public**, but the plan was a private one. Peter decides which; to make it private: repository Settings, General, Danger Zone, Change visibility.
2. Claude has added it as `origin` locally. Claude pushes `main` only after Peter says to (`CLAUDE.md`: no pushing unless asked), and for a public repository only after Peter confirms that public is intended. The first push may open a GitHub sign-in window on Peter's PC (Git Credential Manager); Claude cannot complete that sign-in.
3. In Netlify (not set up yet; this does not block CI, which runs on GitHub alone, but the preview links and the live site need it): Add new project, import from Git, choose the repository. Signing in to Netlify with the GitHub account is the simplest route. Netlify reads `netlify.toml`, so no build settings need typing in. Deploy previews for pull requests are on by default.
4. Optional but recommended: in the GitHub repository settings, protect `main` and require the checks "Checks (typecheck, lint, format, tests, build)" and "End to end (chromium)", "(firefox)" and "(webkit)" before merging.

## What Claude then verifies

- The first CI run is green on all four jobs, including Firefox on Linux (Firefox cannot start on Peter's Windows PC; see `docs/decisions.md`).
- Netlify posts a preview link on a test pull request, and the preview serves the headers in `netlify.toml` (checked with a request to the preview address).
- The preview loads with no console errors.

Until then, the CI and Netlify files are untested against the real services. That is the only part of Sprint 0 foundations not yet proven.
