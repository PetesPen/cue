# Sprint 9 plan: Deck files, browsers and offline use

Status: **approved by Peter on 2026-10-17, together with the plan for sprint 8, and built the same day** (what finished and what stays manual is in `docs/sprint-log.md`). His answers: keep `.slides`; opening a file adds a new deck; the Export dialog greys out the web page with "Coming soon" until sprint 10; the Install link and the interim icons as proposed. Stories: SV-3, UX-5, UX-7 (all Must), and the SV-1 carry-overs listed under SV-3. Nominal load 16 days. There is no gate at the end of this sprint; the review after it is the next one (Gate 4 follows sprint 10, whose plan writes its criteria).

## Outcome at the review

Save a deck to a file, open it in another browser (or after clearing this one) and get the same deck back, animations and notes included; give Cue a corrupt file and be told so without losing anything; install Cue, switch the network off, and open it and a deck; on a phone, be told kindly that Cue is for larger screens.

## Approach: five thin slices, in this order

1. **The deck file** (`storage`, a lazy chunk). A `.slides` file is a zip with `deck.json` (a marker saying what it is, the schema version, and the deck exactly as stored), `images/<hash>` for every picture the deck shows (and the original of a picture that was scaled down, where one is kept, EL-4), and, from SP-3's rule, the fonts the deck uses with their licences (`OFL.txt`). Packing and unpacking are pure functions over bytes (`packDeck`, `unpackDeck`), tested without a browser. Unpacking says exactly why it failed: not a zip, not a Cue deck, **made by a newer Cue** (with the version), damaged (a missing picture, a wrong hash, a deck that does not parse). Older versions are migrated by the same code that opens stored decks.
2. **Opening a file** (`editor`, `Home`). "Open file" (the Home board, and the empty state) reads the file, unpacks it fully **before anything is stored**, and then saves the deck and its pictures in one transaction as **a new deck**: it never replaces a deck that is there. A failure shows the card of the States board ("This file couldn't be opened", Choose another file) and changes nothing. A property test saves any deck to a file and opens it and gets the same deck (apart from its id and times); a test opens damaged files of many kinds and checks that the store is untouched.
3. **Saving a file** (`editor`). The Export dialog of the board, with "Editable deck file" working (name and size shown, "Made on your device. Nothing is uploaded."). Until sprint 10 the "Standalone web page" option is there but cannot be chosen ("Coming soon", in the style of the board's "Coming later"). The carry-overs of SV-1: the two storage banners offer **Export deck**, the delete confirmation says "Export a copy first if you might want it back", and a deck Cue cannot read is a card that says so with a **Delete** action (decision 17).
4. **Browsers** (UX-5). The end-to-end suite already runs on Chromium, Firefox and WebKit on every pull request and on Edge nightly; this sprint adds what the story asks for on top: the two-window behaviour of a show in each, with the limits explained in the app where there are any (the blocked-window card; the full-screen note); a check at start for what Cue needs (IndexedDB, Web Animations, and the like) with a friendly "this browser is too old" message; and the **phone-sized screen** message of the States board ("Cue is built for larger screens", Copy link) shown instead of the editor on a narrow screen. Safari, which Playwright cannot be, stays a manual check on a Mac.
5. **Offline and install** (UX-7). `vite-plugin-pwa` with Workbox, as SP-6 built and measured: every file of the app (fonts included) is cached; `registerType: 'prompt'`; the service worker registers in production builds only; `sw.js`, `index.html` and the manifest are never cached by the browser, the assets always are. A **"A new version is ready" banner** (the banner style of States) with Update now and Later: it appears only when a new version waits, never reloads on its own, never while a text is being edited without asking first, and never touches the stored decks; if the new version does not take over (the WebKit finding of SP-6) Update now removes the worker and caches and reloads. The **install action** appears only where the browser offers installing. Icons: interim ones drawn from the logo mark (SP-6) until you give final art.

## Acceptance criteria as examples, and how each is tested

U = unit, I = integration (fake IndexedDB), C = component (real Chromium), E = end to end, M = manual.

### SV-3 Save and open a deck file
- Given a deck with text, shapes, pictures, notes, animations and transitions, When it is saved to a file and opened, Then the deck is the same (property test over generated decks; Autumn Launch exactly, apart from id and times). (U, I, E)
- Given a file with a picture, Then the picture is in the file once, by its hash, and shows after opening in a fresh browser profile. (I, E)
- Given a file from a newer Cue, Then it says so and offers nothing destructive; given a file that is damaged, not a zip, or not Cue's (a `.zip` of something else, a renamed image), Then it says so, and the library and storage are exactly as they were. (U for each kind, E)
- Given an older file, Then it is migrated and opens (from a fixture of version 1 once there is a version 2). (U)
- Given a nearly full store, Then the banner offers Export deck and the file saves without touching the store. (C, E)
- Given a deck that cannot be read, Then the library shows it as a card with Delete, and the other decks are listed. (C, I)

### UX-5 Works in modern browsers
- Given Chromium, Firefox and WebKit (and Edge nightly), Then the whole end-to-end suite passes, including the two-window tests. (E)
- Given a browser without what Cue needs, Then a clear message replaces a broken screen. (C)
- Given a phone-sized screen, Then the "built for larger screens" card is shown with Copy link, and a deck is never opened or changed behind it. (C, E at 390 px)
- Given Safari, then real Safari behaviour of the two windows (M).

### UX-7 Install and work offline
- Given one visit, When the network is switched off and the page is reloaded, Then the app opens, the library lists the decks, a deck opens, and fonts draw. (E with `context.setOffline`)
- Given a browser that offers installing, Then an Install action is shown; given one that does not, Then nothing is. (C with a stubbed install event)
- Given a new version waiting, Then the banner offers Update now and Later; nothing reloads until Update now; stored decks are untouched after it. (C, E with two builds as in SP-6)
- Given a show started from the installed app, Then the audience window opens and stays in sync, or the limit is explained. (M in Chrome and Edge)
- Given a normal session, Then every request is to the app's own files (the existing request-recording test, kept). (E)
- Given a real install (Chrome, Edge, Safari "Add to Dock"), then the app has its own window and icon (M).

## Decisions needed from Peter

1. **Approve this plan.**
2. **The file name ending.** The board and the stories say `.slides`; the product is now Cue. Keep `.slides` (my recommendation: a deck made today is still opened by every later version, and the board shows it), or change to `.cue`? It is cheap now and awkward later.
3. **Opening a deck that is already in the library.** I would always add it as a new deck and never replace one (nothing can be overwritten). Is a second copy right, or should Cue ask whether to replace?
4. **The Export dialog before the web page exists.** I would show "Standalone web page" greyed out with "Coming soon" until sprint 10, and select the deck file. Is that right?
5. **Where the Install action lives** (no board). I would put a quiet "Install Cue" link in the library's top bar, shown only where the browser offers it. Is that right?
6. **The icons.** The final app icon (and its maskable version) is a design item; I will use the logo mark until you give art.

## Decisions I am making (technical; Peter can overrule)

36. **The deck file is a zip written and read with `fflate`** (small, no dependencies, MIT), in a lazy chunk, so the first load does not grow.
37. **Opening a file never stores anything until the whole file has been checked**, and always creates a new deck (new id), so a bad file or a double open cannot overwrite or lose anything.
38. **The fonts of a deck travel in its file** (only those it uses, with their licences), as the stack says; opening uses Cue's own bundled copies, and the file's copies are there for the licence and for a future version that no longer bundles them.
39. **The service worker is Workbox through `vite-plugin-pwa`** with `registerType: 'prompt'`, as SP-6 measured.
40. **A narrow screen shows the "built for larger screens" card** (under about 700 px wide), because editing on a phone is out of v1 (CLAUDE.md); exported pages are the way to show a deck on a phone.

## Risks

- **A file that is too big or hostile** (a zip bomb, thousands of entries): the unpacker limits entries, sizes and names before it inflates anything.
- **WebKit and the service worker update** (SP-6): the fallback above, tested where WebKit allows, and a manual check on a Mac.
- **Fonts in the file double its size** for a deck that uses all of them; only used families are embedded.
- **Installing and the audience window** from an installed app cannot be automated; it is on the manual list and UX-7's fourth criterion allows explaining a limit.

## Manual checks for the review

Save a deck and open it in another browser; open a damaged file; install in Chrome and Edge (and Safari: Add to Dock) and start a show from the installed app; switch the network off and reload; the update banner with a second build; a phone.
