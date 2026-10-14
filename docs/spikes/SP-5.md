# SP-5: storage limits

Run on 2026-10-14. Stories at stake: SV-1, EL-4 (also SV-2, SV-3, UX-3, UX-7).

## Question

How much can IndexedDB hold in each browser, and what happens when it is full or cleared?

## Verdict

**Go.** IndexedDB through Dexie is fast, roomy and behaves safely when a save does not fit, as long as a deck and its photos are saved in **one transaction**. Several details matter, listed under "What to build".

Two gaps are not closed: **Firefox and WebKit on a full store** (we could not set a small quota there), and **real Safari** for everything. Those stay as manual checks.

## What we measured

The spike is throwaway code in `spikes/sp-5`, using Dexie 4 against persistent browser profiles (Playwright's throwaway sessions have unrepresentative quotas). Browsers: Chrome 155 and Edge 155 (Windows), Chromium, Firefox and WebKit (Linux CI), and WebKit on Windows.

### How much fits

| Browser | Quota in a fresh profile | Persistent storage |
|---|---|---|
| Chrome 155, Edge 155 | 10,240 MB (about 10 GB; depends on the free disk) | not granted (`persist()` returned false) |
| Firefox (Linux) | 10,240 MB | **the request shows the user a prompt and the promise stays pending**; no answer after 2 s |
| WebKit (Playwright) | 1,000 MB | not granted |

So a 100-slide deck with 100 photos (about 70 MB) is far inside the limit everywhere. WebKit's 1 GB is the one to watch; real Safari's limit is different and untested. The design's example "470 of about 500 MB used" (`States.png`) does not match any real number: see decision 12.

### Speed (a 176 KB deck of 50 slides; 20 such decks; one deck with 50 photos of 700 KB, 34 MB)

| Step | Chrome and Edge | Firefox | WebKit |
|---|---|---|---|
| List 20 decks | 10 ms | 27 ms | 11 to 17 ms |
| Open a 50-slide deck (its data) | 1 ms | 1 to 2 ms | 1 to 11 ms |
| Load one photo | 2 ms | 2 to 3 ms | 1 to 15 ms |
| Load all 50 photos | 38 to 57 ms | 89 to 101 ms | 35 to 770 ms |
| Autosave of the deck, 95th percentile | 1.4 to 2.4 ms | 4 ms | 4 to 17 ms |

SV-1 allows 2 seconds to save and UX-3 allows 2 seconds to open a 50-slide deck. Both have huge headroom, provided photos are loaded as slides need them (the 770 ms WebKit-on-Windows worst case is for all 50 at once).

### Blobs against raw bytes

In a normal persistent profile all four engines store photos either way and return identical bytes (checked by SHA-256). Raw bytes cost about the same as Blobs to write. Only in a **throwaway session with no disk storage** (which is what a private window is) did WebKit refuse Blobs (`Error preparing Blob/File data to be stored in object store`, found in SP-3) while raw bytes plus a type still worked.

### A full store (Chrome and Edge, quota set to 60 MB)

| Case | Result |
|---|---|
| 5 MB deck, one transaction | saved |
| 90 MB deck, one transaction (does not fit) | failed in 107 to 157 ms with Dexie's `AbortError`, whose `inner` error is `QuotaExceededError`; **nothing left behind**: the deck and all its photos were rolled back |
| A 10 MB deck right after | saved normally; the store is not stuck |
| 90 MB deck, one transaction **per photo** (the wrong way) | failed after 8 photos; **8 orphan photos (40 MB) stayed**, even after closing and reopening the database |

Firefox: its preference for a small quota did not take effect (the 90 MB deck simply saved, 195 MB in use), so its behaviour on a full store is **unverified**. WebKit has no way to set a small quota. By the IndexedDB specification the behaviour should match, but we have not seen it.

### Cleared site data (Chrome)

After "clear site data" the deck was gone, and so was the "last backup" reminder stored next to it. The app cannot tell that anything was lost.

## What to build

1. **One transaction per deck save**, covering the deck and any new photos. Never one transaction per photo. Add an **orphan sweep at startup** that deletes photos no deck refers to, as insurance.
2. **Recognise a full store** with `error.name === 'QuotaExceededError' || error.inner?.name === 'QuotaExceededError'` (Dexie wraps it), and show the "Changes can't be saved" banner from the design (`States.png`) with the Export deck action. Keep the unsaved edit in memory so Export still works.
3. **Store photos as raw bytes plus a type**, in an `images` table keyed by content hash, loaded one at a time as slides need them. It works in every engine, including a private window; Blobs would save a little memory but are not worth losing that.
4. **Never wait on `navigator.storage.persist()`.** In Firefox it asks the user and may never answer. Call it once, without awaiting, after the first deck is saved; Chrome grants it more readily to an installed app (UX-7), which is unverified.
5. **A backup reminder cannot rescue a wiped store**, because its timestamp is wiped too. Keep export one click, keep the reminder, and say so on the home screen. Safari is reported to delete a site's storage after about 7 days without a visit (installed web apps excepted); that is unverified here and makes backups matter more.
6. **For "nearly full"** use `navigator.storage.estimate()` and warn at about 90% of the quota it reports.

## Not covered

- **Real Safari**: quota, the 7-day rule, private windows, and a full store.
- **Firefox and WebKit on a full store.**
- **Thousands of photos**, many tabs open on the same deck, and upgrading the database version (needed for deck-file migrations, SV-3).
- **Storage used by the service worker's cache** (SP-6) counts against the same quota.

## Reproduce

`SPIKE=sp-5 npx playwright test -c spikes/playwright.config.ts --project=chrome` (also `edge`, `webkit`; the Firefox and Linux numbers came from the Spikes workflow, removed at Gate 1; see `docs/spikes/README.md`). Print the numbers with `node spikes/sp-5/report.mjs chrome`. For a real browser by hand: `npm run spike:sp-5`, open http://127.0.0.1:4200 and press the three buttons.
