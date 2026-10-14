# Hosting and CI: what is in place and what is left

Decided on 2026-10-14: Netlify hosts the live site and a deploy preview for every pull request. GitHub Actions runs the checks.

## In place (written and checked locally, F5)

- `netlify.toml`: build command, publish folder, security headers (including a strict content security policy) and long caching for built files. `.nvmrc` sets the Node version.
- `.github/workflows/ci.yml`: on every pull request and on `main`: typecheck, lint, format check, unit, integration and component tests, build with the bundle-size check, and the end-to-end tests (with axe) on Chromium, Firefox and WebKit in parallel.
- `.github/workflows/nightly.yml`: dependency audit, the full browser matrix including Edge, and a performance job that says it has nothing to run yet.
- `.github/pull_request_template.md`: the review checklist that stands in for a second reviewer.
- `config/budgets.json` and `scripts/check-bundle-size.mjs`: the first-load budget (300 KB of JavaScript and 30 KB of CSS, gzipped). `npm run build` fails when it is broken.
- Tests that keep these honest: `tests/ci.test.ts` (read-only permissions, every action pinned to a commit, job timeouts), `tests/netlify.test.ts` (the headers in `netlify.toml` match `config/headers.ts`) and `tests/bundle-size.test.ts`. The end-to-end tests run under the same content security policy, and one proves the browser blocks a request to another host.

## Left: needs Peter (accounts and permissions, so Claude cannot do these)

1. Create a private GitHub repository for Cue (an empty one, with no README or licence).
2. Tell Claude the repository address. Claude will add it as `origin` and push `main` once Peter asks for that (`CLAUDE.md`: no pushing unless asked).
3. In Netlify: Add new project, import from Git, choose the repository. Netlify reads `netlify.toml`, so no build settings need typing in. Deploy previews for pull requests are on by default.
4. Optional but recommended: in the GitHub repository settings, protect `main` and require the checks "Checks (typecheck, lint, format, tests, build)" and "End to end (chromium)", "(firefox)" and "(webkit)" before merging.

## What Claude then verifies

- The first CI run is green on all four jobs, including Firefox on Linux (Firefox cannot start on Peter's Windows PC; see `docs/decisions.md`).
- Netlify posts a preview link on a test pull request, and the preview serves the headers in `netlify.toml` (checked with a request to the preview address).
- The preview loads with no console errors.

Until then, the CI and Netlify files are untested against the real services. That is the only part of Sprint 0 foundations not yet proven.
