# SP-3: single-file HTML export

Run on 2026-10-14. Stories at stake: SV-4 (also SV-3, EL-4, SV-1 for what it shows about storage).

## Question

How large is a 30-slide, image-heavy deck as one HTML file, and how long does the export take? SV-4 requires under 10 seconds and no external requests.

## Verdict

**Go.** Export is nowhere near the limit: under 0.4 s in Chrome and Edge, under 1.2 s in the slowest engine, for decks of up to 52 MB. The file is about **1.35 times the size of the photos plus 0.16 MB**. Opened offline with every web request refused, it made none, logged no errors, and every slide displayed.

The plan's fallback (re-encode photos to WebP on export) works but must **not** run at export time: it took 6 to 7 s in Chrome and Edge and 11.7 s in WebKit for a modest deck, which would break the 10-second limit by itself.

One storage note: WebKit would not store photos as Blobs in IndexedDB in Playwright's throwaway test sessions, though SP-5 found it works in a normal profile (see "Found along the way").

## What we measured

The spike is throwaway code in `spikes/sp-3`. It builds 30-slide decks (a title, a line of text in one of three fonts, and one 2000 × 1500 photo per slide). The photos are synthetic, JPEG at quality 0.8 with added fine detail, so they are not photographs but behave like them for size. They are stored in IndexedDB, exported through a real browser download, and the saved file is then opened from disk with all web requests refused and clicked through slide by slide.

| Deck | Photos (total) | File | Export time | Open to first slide | Slide change, 95th percentile |
|---|---|---|---|---|---|
| Text only | none | 0.15 MB | 14 ms | 37 ms | 31 ms |
| Typical: 30 photos, about 130 KB each | 3.8 MB | 5.3 MB | 44 to 49 ms | 63 to 85 ms | 28 to 30 ms |
| Heavy: about 700 KB each | 21.4 MB | 28.7 MB | 188 to 198 ms | 141 ms | 32 to 34 ms |
| Extreme: about 1.3 MB each | 39.0 MB | 52.1 MB | 327 to 362 ms | 258 to 281 ms | 41 to 45 ms |

(Chrome 155 and Edge 155 on Windows.) Other engines, same decks:

| Engine | Export (typical to extreme) | Open to first slide (heavy) | Notes |
|---|---|---|---|
| Firefox (Linux, CI) | 45 to 165 ms | 164 ms | no problems |
| Chromium (Linux, CI) | 68 to 528 ms | 238 ms | no problems |
| WebKit (Windows, Playwright) | 1.05 to 1.18 s | 2.2 s (3.1 s for the 52 MB deck) | slower to open; slide change p95 76 to 115 ms |
| WebKit (Linux, CI) | 72 to 353 ms | 733 ms | photos stored as raw bytes (see below) |

- **File size** is the photos times 1.34 to 1.37 (base64 adds a third) plus about 0.16 MB. That 0.16 MB is the small runtime, the deck data and the fonts actually used: 3 of the 11 bundled font files (95 KB), each with its licence text. A deck that uses one font embeds one.
- **For the Export dialog's "about 4.2 MB"** (`Export-Dialog.png`): web page size is about 1.35 × the stored photo bytes + 0.16 MB. The `.slides` file will be about the photo bytes plus a little, so about three quarters of the web page.
- **No external requests.** Every http and https request was refused and counted: zero in every engine. A content security policy written into the file (`default-src 'none'`, images and fonts from `data:` only) means the browser itself blocks anything that tries; there were no console errors, so nothing tried.
- **Time breakdown for the heavy deck (Chrome):** reading from IndexedDB 8 ms, base64 83 ms, assembling the file 102 ms, fonts 12 ms. The file is built as a list of pieces for the browser to join, never one giant string.
- **JavaScript memory** in the opened page stayed around 10 MB in Chromium. That figure leaves out decoded images and the page's own text, so treat it as incomplete.

### The WebP fallback

| | Typical deck (30 photos) |
|---|---|
| As is | 5.3 MB, 44 ms |
| Re-encoded to WebP | 2.0 MB (62% smaller), **6.1 s** (Chrome), 6.8 s (Edge), **11.7 s** (WebKit on Windows) |

Smaller files, but the re-encoding is the slow step and scales with the number of photos. Recommendation: never at export. If we want smaller decks, do it once when a photo is imported (EL-4 already scales big photos down), and keep export a plain copy. Safari cannot reliably encode WebP in the browser, so this is optional anyway.

## Found along the way

- **WebKit could not store photos as Blobs in IndexedDB** in Playwright's default throwaway sessions (`Error preparing Blob/File data to be stored in object store`), in both the Windows and Linux builds. Storing the same photo as an `ArrayBuffer` plus its type worked there, and export then ran as above. **SP-5 later found that WebKit stores Blobs normally in a persistent profile**, so this is about sessions with no disk storage (what a private window is), not WebKit in general. Whether real Safari's private windows behave the same is untested. Raw bytes plus a type work everywhere, at the cost that reading a deck loads all its photo bytes into memory instead of file-backed Blobs; see `docs/spikes/SP-5.md` for the recommendation.
- **Opening a very large file is slower in WebKit** (about 3 s to the first slide for 52 MB). Real Safari is untested.
- **Port 4190** is refused by Firefox and Safari (see SP-1); the spikes use 4200.

## Recommendation

1. Export as the spike does: photos as base64 in separate `text/plain` script blocks (read only when a slide is shown), the deck as JSON, the runtime inline, only the fonts the deck uses with their licences, and a content security policy in the file.
2. Show the estimated size in the dialog, and add a warning above about 20 MB, because many mail services refuse larger attachments. That is a suggestion for the dialog, not part of SV-4 as written.
3. Keep export a plain copy. Do any WebP work at import time or not at all.
4. How to store photos is decided in SP-5 (`docs/spikes/SP-5.md`).

## Not covered

- Real photographs, and decks with fewer, much larger photos (EL-4 limits them to 2000 × 1500 on import).
- The real renderer and animation runtime: the spike's runtime only draws a title, a line and a photo. Its size (about 3 KB) is a floor, not an estimate.
- Real Safari, and opening the file on a phone (HTML exports must play on any device, UX-5).
- Speaker notes, transitions and the presenter mode inside the export (SV-4 asks for them; they add code, not data).

## Reproduce

`SPIKE=sp-3 npx playwright test -c spikes/playwright.config.ts --project=chrome` (also `edge`, `webkit`; the Firefox and Linux numbers came from the Spikes workflow, removed at Gate 1; see `docs/spikes/README.md`). Print the numbers with `node spikes/sp-3/report.mjs chrome`.
