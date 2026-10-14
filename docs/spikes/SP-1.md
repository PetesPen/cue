# SP-1: two-window show

Run on 2026-10-14. Stories at stake: PM-1, PM-3, UX-5.

## Question

Can one click open the audience and presenter windows reliably in Chrome, Edge, Firefox and Safari, and keep them in sync within 100 ms?

## Verdict

**Sync: go.** BroadcastChannel keeps the windows within about 17 ms in every engine we could run, six times inside the limit. The storage-event fallback is just as fast, so it is not needed.

**One click opens both windows: no-go as PM-1 is written.** With the browser's pop-up blocker on, which is the default, one click opens the first window and the browser blocks the second. This happened in real Chrome 155, real Edge 155 and Firefox 157. It stops happening once the user allows pop-ups for the site. This needs a product decision (decision 10 in `docs/decisions.md`). My recommendation is below.

Safari is untested and needs a Mac (see "Still unknown").

## What we measured

The spike is throwaway code in `spikes/sp-1`: an opener page standing in for the editor, a presenter page and an audience page, either of which can drive. Tests are in `spikes/sp-1/sp-1.spec.ts`.

### 1. One click, two windows (pop-up blocker on)

| Browser | One click asks for two windows | One window per click | Two separate clicks | Site allowed by the user |
|---|---|---|---|---|
| Chrome 155 (real, Windows) | first opens, **second blocked** | works | both open | **both open** |
| Edge 155 (real, Windows) | first opens, **second blocked** | works | both open | **both open** |
| Firefox 157 (Playwright build, Linux) | first opens, **second blocked** | works | both open | not tested |
| Safari / WebKit | not testable here | not testable | not testable | not testable |

Playwright's own Chromium does not enforce the blocker at all (both windows open), so it hides this problem. Only the real Chrome and Edge builds show it. A script with no click is also blocked by browsers, as expected.

### 2. Sync latency (200 steps, 10 ms apart; ms, 95th percentile)

"Round trip" is measured on one clock: send, the other window updates and paints, acknowledgement returns. "Painted" is one way, from send to the other window drawing the change. Limit: 100 ms.

| Browser | Round trip (BroadcastChannel) | Round trip (storage event) | Handled one way | Painted one way |
|---|---|---|---|---|
| Chromium (Windows) | 17.8 | 17.4 | 0.7 | 17.4 |
| Chrome 155 | 16.8 | 17.2 | 0.7 | 16.6 |
| Edge 155 | 16.7 | 16.8 | 0.7 | 16.4 |
| Chromium (Linux CI) | 16.1 | 16.1 | 0.2 | 16.0 |
| Firefox (Linux CI) | 17 | 16 | 1 | 16 |
| WebKit (Linux CI) | 16 | 16 | 1 | 15 |
| WebKit (Windows, Playwright) | 46 | 47 | 15 | 31 |

Every message arrived, in order, in all engines, including a burst of 200 with no gap. The painted time is mostly waiting for the next screen refresh (about 16 ms at 60 Hz); the message itself arrives in under a millisecond to a few milliseconds. The slower WebKit-on-Windows figures are still under half the limit. That build is not real Safari.

### 3. A window closes

| Browser | Goodbye message on close | Web Lock released by the dead window | `window.closed` seen by the opener |
|---|---|---|---|
| Chrome / Edge / Chromium | 14 to 28 ms | 6 to 24 ms | yes |
| Firefox (Linux) | 39 to 63 ms | 14 to 25 ms | yes |
| WebKit (Linux, window closes itself) | 30 ms | 9 ms | yes |

The other window kept working in every case. Reconnecting (opening a new audience window) showed the current click straight away, with no key press, in every engine.

Playwright's `page.close()` on WebKit did not really destroy the page (no goodbye, no lock release). That is a test-tool limit, not a finding about Safari; closing from inside the page worked.

**Design consequence:** do not rely on the goodbye message alone. Use the Web Locks API as the main "is that window gone?" signal: each window holds a lock named after itself until it dies, and others ask for it. It needs no timers, so a throttled or hidden window cannot hold it up.

### 4. Ending the show

Ending from either window closes both, in every engine. This works because both windows were opened by script, which is the only kind of window a script may close.

### 5. Fullscreen and second display

- A new window cannot go fullscreen on its own: Chrome and Edge refuse ("Permissions check failed"), Firefox refuses. It works after a click or key press in that window, and also when asked from the first window's click.
- Choosing the second display needs the Window Management API, which only Chromium browsers have, and it asks the user for permission. Without it (Firefox, Safari) the user drags the audience window and presses a key. This matches PM-1 ("where the browser allows it").
- This PC has one display, so placement on a second display and real fullscreen on a projector were not tested.

## Recommendation

1. **Sync:** keep BroadcastChannel as planned, with a hello message so a new window catches up, and Web Locks for "window gone". Apply state in the message handler, never inside a screen-refresh callback, so a hidden window is right when it reappears. The storage-event fallback in the plan is not needed.
2. **Opening the windows (decided by Peter on 2026-10-14: Option B):**
   - **Option A, as PM-1 is written:** one click tries to open both. In Chrome, Edge and Firefox the first-time experience is the "blocked" card already in the design (`States.png`: Try again, or Present in one window) until the user allows pop-ups once.
   - **Option B, my recommendation:** one click opens only the **audience** window, and the editor tab itself turns into the **presenter** view, going back to the editor when the show ends. Opening one window per click was never blocked in any browser, so the normal case needs no pop-up prompt. The blocked card stays for the rare case where even the audience window is blocked. It also puts the presenter view on the laptop, where the speaker is.
3. **Fullscreen:** show the audience window's "click or press F" hint, and also ask for fullscreen from the Present click where the browser allows it.

## Still unknown (manual, needs Peter or a Mac)

1. **Safari.** Pop-up blocking, latency, closing and fullscreen are untested because Safari needs a Mac and Playwright's WebKit is not Safari.
2. **Peter's own Firefox 157 on Windows.** The Firefox figures above are Playwright's build on Linux.
3. **A second display and a projector:** window placement, the permission prompt, fullscreen.
4. **A covered audience window.** Browsers can treat a fully covered window as hidden and stop painting. Playwright cannot show this (it keeps pages "visible"), so the audience page has a readout for it.

How to run the manual checks: run `npm run spike:sp-1`, open http://127.0.0.1:4200 in the browser under test, press "Open audience and presenter (one click)", and note what happens. Then press "Open both, presenter covering the audience", leave it for a minute, move the presenter window away and read the line at the top left of the audience window ("hidden for" should stay near 0 s). "Copy results" on the first page copies the findings.

## Reproduce

- Automated: `npx playwright test -c spikes/playwright.config.ts --project=chrome` (also `edge`, `chromium`, `webkit`, `chrome-blocker`, `edge-blocker`). Print the numbers with `node spikes/sp-1/report.mjs chrome`.
- Linux and Firefox: the Spikes workflow on GitHub runs the same tests when files under `spikes/` change and writes each browser's results as an annotation on the run.
- Port 4200 is deliberate: Firefox and Safari refuse to connect to port 4190 (a reserved mail-protocol port), so the first WebKit runs failed to load the page. Avoid the browsers' restricted ports for any local server.
