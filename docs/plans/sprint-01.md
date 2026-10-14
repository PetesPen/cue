# Sprint 1 plan: Decks, shell and saving

Status: **approved by Peter on 2026-10-15**, with dark mode dropped (decision 14), `gh` to be installed, and the Netlify Drawer switched off by Peter. Written 2026-10-15. Stories: UX-1, SL-1, SL-2, SV-1, SV-2 (all Must). Capacity: 16 engineering days, with no slack to add anything.

## Outcome at the review

Open https://cue-presentations.netlify.app/ (or a pull request preview), create decks, add slides, rename, duplicate and delete decks, close the tab, and find everything exactly as left. The home screen and the editor match the design boards.

## Approach: five thin slices, in this order

Each slice works from model through to screen and has its tests, as `CLAUDE.md` requires. Each story gets a short branch (`ux-1-shell`, `sl-1-add-slide`, and so on), a pull request, a Netlify preview and green CI before it merges.

1. **Deck model and commands** (`model`). A deck has an id, title, dates, a schema version (1) and slides; a slide has an id and room for the elements, notes and background that later sprints add. Every edit is a command run through Immer, which returns the new deck plus the patches and their inverse (so undo in sprint 4 is already possible). Commands now: add a slide after a given slide, rename a deck, duplicate a deck. Property tests for the invariants (a new slide goes directly after the chosen one, order is kept, a duplicate has fresh ids).
2. **Storage and autosave** (`storage`). Dexie database; a deck and its photos are saved in one transaction; list, load, duplicate and delete. Autosave: after the last edit, within 2 seconds, with a Saved, Saving or Not saved indicator. A "nearly full" check (90% or more of the browser's quota) and a "cannot save" state. Integration tests with fake-indexeddb, including a failed save that must leave nothing behind.
3. **Slide drawing and the editor screen** (`render`, `editor`). A DOM slide renderer in the 1920 x 1080 space, used for the canvas and the thumbnails. The editor: the numbered thumbnail rail with the current slide highlighted, Up and Down arrows, a "+" button and Ctrl or Cmd + M to add a slide after the current one (the new one is selected), the title edited in place in the header, and the save indicator.
4. **Home screen** (`editor`). The deck library from `Home.png`: cards with a thumbnail, title and last-edited date, newest first; New deck; a card menu with Open, Rename, Duplicate and Delete (delete asks first); and the empty state from `States.png`. Routing is by the address hash (`#/` and `#/deck/<id>`), so refresh and deep links work with no Netlify setting.
5. **Banners, accessibility and end to end.** The nearly-full and cannot-save banners from `States.png`. axe on both screens with zero violations, keyboard-only use, end-to-end journeys on Chromium, Firefox and WebKit, and a check of each preview with `npm run e2e:deployed`.

## Acceptance criteria as examples, and how each is tested

U = unit (Vitest), I = integration (fake-indexeddb), C = component (real Chromium), E = end to end (three engines), A = axe, M = manual.

### UX-1 A sleek, uncluttered editor
- Given the editor, When it opens, Then the thumbnail rail is on the left, the canvas in the centre and the inspector on the right. (E; sizes already measured in F4)
- Given nothing is selected, When the inspector shows, Then it shows only what applies. (C)
- Given the top bar, When it is read, Then it holds only the actions that exist so far (add slide), with the rest arriving with their stories. (E)
- Given the styles, When they are read, Then they use design tokens only, one interface typeface, and motion no longer than 200 ms that stops under "reduce motion". (U on the CSS, M for feel)
- Dark mode is out of v1 (decision 14, Peter 2026-10-15): the criterion is removed and the interface is light only.

### SL-1 Add a slide
- Given a deck of three slides with the second selected, When the "+" button or Ctrl/Cmd+M is used, Then a blank 16:9 slide is added directly after the second, and it is selected. (U for the command, E for button and shortcut)
- Given a new deck, When it opens, Then it has exactly one blank slide. (U, E)
- Given the new slide, When it appears, Then it is ready to edit at once (focus is in the canvas). (C, E)

### SL-2 Navigate between slides
- Given any number of slides, When the rail shows, Then each slide has a live thumbnail and its number. (C)
- Given the current slide, Then it is clearly highlighted (the selected style in the guide, not colour alone). (C, A)
- Given the rail has focus, When Up or Down is pressed, Then the selection moves and the canvas follows, stopping at the ends. (C, E)

### SV-1 Autosave locally
- Given an edit, When 2 seconds pass, Then the deck is saved and "Saved" shows; during the wait it shows "Saving". (I with a fake clock, E)
- Given a deck, When the tab is closed and reopened, Then the deck is exactly as left. (E, I round trip)
- Given the storage layer, When a deck with photos is saved, Then the photos are stored as raw bytes in the same transaction. (I; no photo can be added in the editor until sprint 4, so end to end with real photos waits for EL-4)
- Given storage at 90% of the quota, When the editor opens, Then a warning with the real numbers shows. (C with a stubbed estimate)
- Given a save that fails because the store is full, Then a stronger banner says changes cannot be saved, the failed save leaves nothing half written, and the edit stays in memory. (I, C)
- **The "Export deck" button on those banners needs SV-3 (sprint 9).** Until then the banners offer "Manage storage" (back to the library to delete decks) and say so.

### SV-2 Manage multiple decks
- Given several decks, When the home screen opens, Then it lists them newest first, each with a thumbnail of its first slide, title and last-edited date. (I for the order, C, E)
- Given the home screen, When New deck is chosen, Then a new deck with one slide opens in the editor. (E)
- Given a deck, When it is renamed, duplicated or deleted from its menu, Then the list changes accordingly; delete shows a confirmation first and Cancel keeps the deck. (C, I, E)
- Given the editor, When the title in the header is edited in place, Then the new title is saved and shown in the library. (C, E)

## Not in this sprint (from the Home design, they belong to other stories)

Search, starter layouts (TH-2, after v1.0), Open file and Export (SV-3, sprint 9), the backup reminder banner (sprint 9), the Recent or Name sort toggle (not in SV-2's criteria). The storage meter ("Stored on this device") is a small extra that supports SV-1; it is the first thing to cut if the sprint runs behind. Next to cut, in order: the card thumbnails' live refresh (they would refresh on open instead), then rename from the card menu (inline title in the editor stays).

## Decisions needed from Peter

1. **Approve this plan.**
2. **Dark mode (UX-1's fourth criterion).** The story says light and dark interface modes; the design says light theme only for v1 (`design/README.md`, `tokens.css`). Recommendation: **drop dark mode from v1**, as the design says, and remove the criterion. Dark mode would double the visual testing and every colour pair.
3. **Pull requests.** CLAUDE.md asks for a pull request with a preview for every change now that Netlify is linked. I cannot open pull requests without the GitHub command-line tool, which is not installed. Recommendation: install it once (`winget install GitHub.cli`, then `gh auth login` and choose the browser sign-in). I would run those in your Terminal tab and you would only approve the browser sign-in. If you prefer not to, I keep pushing straight to `main` and Netlify's live site is the only preview.
4. **Netlify Drawer.** Netlify adds a review overlay script to every page it serves. Our strict policy blocks it and logs a console error, which fails two end-to-end tests. Turn the Drawer off in the Netlify site settings (or tell me to relax the policy for previews). It will also appear on every pull request preview.

## Assumptions to check

- The wordmark on the home screen reads "Cue" (the design says "Slides"); you chose Cue as the name, and the shell already uses it.
- A deck is saved as one record (title, dates, slides) with photos in a separate table keyed by content hash, so a 50-slide deck opens in about a millisecond (SP-5).
- Thumbnails are drawn by the same renderer as the canvas, scaled with a CSS transform (SP-2 and SP-4: wraps and motion are scale-safe).

## Risks

- **SV-1 is the biggest story**, because it touches storage, the clock and failure states. Built second, so the rest rests on it.
- **Three browser engines for every journey.** Firefox does not start on your PC, so Firefox results come from CI.
- **Safari is untested** for storage and keyboard behaviour; it goes on the review's manual list.
- **The model is the foundation of every later sprint.** Its shape is kept small and versioned (schema version 1, a migrations function with its own test) so changes later are cheap.

## Manual checks for the review

Real Safari, a second display (not needed yet), your own Firefox, reading the home screen and the editor against the boards, and closing the browser with a deck open to confirm nothing is lost.
