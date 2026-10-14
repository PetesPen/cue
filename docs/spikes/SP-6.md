# SP-6: installable and offline

Run on 2026-10-14. Stories at stake: UX-7 (also PM-1, PM-3 for how an installed app opens the audience window).

## Question

Can a web app manifest and a service worker make Cue open fully offline and install in Chrome, Edge and Safari, with updates that wait for the user and no stale files during development? How does the installed app behave when it opens the audience window?

## Verdict

**Go for offline use, installability in Chrome and Edge, and user-controlled updates, with a fallback for WebKit.** `vite-plugin-pwa` 2 with Workbox 7 does all of it with about 20 lines of settings. The real app was built with it and tested:

- **Offline:** after one visit the whole app (20 files, 0.6 MB, **all 11 bundled fonts included**) is cached. With the network switched off the app reloads, tabs work, and the Instrument Sans font draws. A path the app does not have (a deep link) also falls back to the app.
- **Installable:** Chrome and Edge report **no installability errors**, and the manifest has no errors (name Cue, standalone, 192 px, 512 px and a maskable 512 px icon).
- **Updates wait for the user:** in every engine a new version was installed in the background and then **waited**. The running app stayed on the old version, and even a reload stayed on the old version, until the user chose to update; then the next load was the new version (Chrome, Edge, Chromium, Firefox, and WebKit on Windows in 5 of 6 runs). The stored deck in IndexedDB was untouched. **Exception:** in WebKit on Linux the new version did not take over after the user chose to update; the app needs a fallback for that (below).
- **Development is clean:** a development server with the plugin installed registers **no** service worker, no manifest link and no cache. Stale files cannot happen in development.
- **No console errors** with the real security headers (`worker-src 'self'`, `manifest-src 'self'` are enough).

**Not verified, and needing a person:** installing in Safari (Add to Dock on a Mac), whether Firefox on desktop can install it at all (not tested), and how an *installed* app opens the audience window. The audience-window behaviour is the one PM-1 question left open by SP-6 (below).

## What we measured

The spike builds the real app twice (versions a and b, differing by one marker in `index.html`), serves it with the app's real security headers from a small switchable server, and drives it with Playwright in persistent browser profiles. Throwaway code in `spikes/sp-6`.

| Check | Chrome 155 | Edge 155 | Chromium (Linux) | Firefox (Linux) | WebKit (Windows) | WebKit (Linux) |
|---|---|---|---|---|---|---|
| Worker registered, cache complete (20 files, 11 fonts) | yes | yes | yes | yes | yes | yes |
| Reloads offline, fonts load, tabs work | yes | yes | yes | yes | yes | yes |
| Unknown path offline shows the app | yes | yes | yes | yes | no | yes |
| Installability errors | none | none | none | n/a | n/a | n/a |
| New version is installed and waiting after | 1.8 s | 1.8 s | 0.02 s | 1.0 s | 0.04 s | 0.02 s |
| Old version kept while waiting, and after a reload | yes | yes | yes | yes | yes | yes |
| **New version after the user chooses "update"** | new | new | new | new | new (5 of 6 runs) | **did not take over in 8 s; still old** |
| Stored deck after the update | intact | intact | intact | intact | intact | intact |
| Development server registers no worker | yes | yes | yes | yes | yes | yes |

Two engine differences worth knowing:

- **WebKit sometimes does not take over after "update".** The new worker was installed and waiting in every WebKit run, and "update now" worked in 5 of 6 runs on Windows. One Windows run hung, and the Linux run saw neither the hand-over event nor the new version within 8 seconds, and the app stayed on the old version. The old version kept working and the deck was safe, so the failure is "nothing happens when I press Update", not data loss. We do not know whether real Safari behaves the same. **The update step in the app must not depend on that hand-over:** try the normal way, wait about 3 seconds, and if the new version is not in control, fall back to removing the worker, clearing the app's caches and reloading (needs the network, and decks live in IndexedDB so none is lost). Check in real Safari.
- In WebKit on Windows an unknown path opened offline did not show the app (it did in WebKit on Linux). Cue has no deep links yet, so this does not matter now. It would matter if the audience window used a path of its own: my suggestion for sprint 7 is to give it the app's own address with a query string (for example `/?audience`), not a separate path.
## What to build (sprint 9, UX-7)

1. `vite-plugin-pwa` with `registerType: 'prompt'`, `devOptions.enabled: false`, `navigateFallback: 'index.html'`, `cleanupOutdatedCaches: true`, and the manifest from `spikes/sp-6/pwa-options.mjs`. Cache everything including all fonts (0.6 MB). Do not cache anything from another host: there is none.
2. An **"A new version is ready" banner** in the existing banner style (`States.png`) with "Update now" and "Later". It is shown only when the new worker is waiting; "Update now" sends `SKIP_WAITING`, waits about 3 seconds for the hand-over, then reloads; **if the new version is still not in control, it removes the worker, clears the app's caches and reloads** (the WebKit finding above). Never reload on its own while the user may be editing. If there are unsaved edits, they are saved first (autosave already runs within 2 s).
3. **Serve `sw.js`, `registerSW.js`, `index.html` and the manifest with `Cache-Control: no-cache`**, and everything under `/assets/` as immutable (already in `netlify.toml`; `sw.js` must be added, or updates will not be seen).
4. **Real icons from the design.** The spike's icons are drawn from the logo mark for testing. The final icon art, including a maskable version, is a design item for Peter.
5. The install prompt: Chrome and Edge offer install in the address bar. A custom "Install Cue" button is optional and can wait; the story only requires that where the browser supports installing, there is a clear action.
6. **Installed-app storage:** Chrome tends to grant persistent storage to installed apps, which would help SP-5's risk. Unverified; check by hand after installing.

## Open: the audience window from an installed app

SP-1 settled that one click opens only the audience window and the editor tab becomes the presenter view. An installed app has no tabs: it is its own window. Two things to check by hand, because automated tests cannot install an app:

1. Does `window.open` from an installed app open the audience window (a pop-up or a separate app window), and where?
2. After "End show", does the installed window return to the editor?

If either surprises us, UX-7's fourth criterion ("starting a show from the installed app opens the audience window and keeps it in sync, or explains any browser-specific limit") is where it is handled. This is the only manual check SP-6 leaves for Peter beyond Safari.

## How to check it yourself

`npm run spike:sp-6`, then open http://127.0.0.1:4200 in Chrome or Edge. The install icon appears in the address bar. Install it, then stop the server (Ctrl-C) and open the installed Cue from the Start menu: it should open with no network. In Safari on a Mac, use File, Add to Dock.

## Not covered

- Installing in any browser (only the installability check, which is Chromium's own report).
- Safari, and Firefox on desktop.
- A second version arriving while the user is mid-edit with unsaved changes (the design above avoids it by never reloading unprompted).
- The size of the cache growing with many decks: decks are in IndexedDB (SP-5), not in the worker's cache.
- How Netlify serves the worker (needs Netlify linked): headers and caching are tested against our own server only.

## Reproduce

`SPIKE=sp-6 npx playwright test -c spikes/playwright.config.ts --project=chrome` (also `edge`, `webkit`; the Firefox and Linux numbers came from the Spikes workflow, removed at Gate 1; see `docs/spikes/README.md`). The build step makes `spikes/sp-6/dist-a` and `dist-b`.
