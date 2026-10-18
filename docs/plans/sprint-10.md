# Sprint 10 plan: Standalone HTML

Status: **written on 2026-10-17, approved by Peter on 2026-10-18, and built the same day** (what finished, what stays manual and the questions for the Gate 4 review are in `docs/sprint-log.md`). Peter's approval was "everything sounds good, please proceed": his answers below are as proposed, including SV-8 in this sprint and the Gate 4 criteria. Stories: SV-4 (Must), SV-5 (Should), and, if Peter agrees, the new **SV-8 Back up all decks** (Should, added on 2026-10-17 at his request). Nominal load: SV-4 and SV-5 are 12 days; SV-8 adds about 2, so the sprint is 14 of 16 days and keeps its slack. **This sprint ends in Gate 4 ("First full show")**; its criteria are written below and were approved with the plan.

## Outcome at the review

Export Autumn Launch as one web page. Open it from the file, in any of the browsers, with the network off, and present it: every slide, every click and every transition as in the editor, with the notes on N. Put it next to the editor and the audience window and see no difference. Then back up every deck in one file, clear the browser, and get them all back. At the end Peter says whether he could give a real talk with Cue, from start to finish (Gate 4).

## Approach: five thin slices, in this order

1. **The page's program** (`src/storage/htmlExport/`, built apart). The exported page is plain files: some data and a program. The program is written once, as a small plain-TypeScript entry that imports only `model` and `render`, so it draws slides with the very code the editor and the show windows use (SP-2's four rules, the motion engine, the stage and its transitions). It does what the story lists: scales the 16:9 slide to the window; keys from the show's one key table (`SHOW_KEYS`: next, previous, first, last, a number then Enter, B, W, F), plus two page-only keys, **N** (notes) and **?** (the key list); click-by-click animations; transitions between neighbours (movement from `model/show`); and tap and swipe on a touch screen, so a phone can play a page (decision 40 sends phone use to exports). The notes panel is in the same window (no second window: a file opened from disk cannot count on two windows talking). **Nothing in it may touch storage, React, TipTap or the network**, and an ESLint rule and a test of the built file say so. A second, nested Vite build turns the entry into one script (and its CSS) that the exporter takes as text; it is part of the same `npm run build` and works in the dev server and in the tests.
2. **The exporter** (`storage`, a lazy chunk, `makeHtmlExport`). From the deck in the tab (as the deck file does, so it works while a save is failing; sprint 9's rule), it writes one file made of pieces the browser joins (SP-3): a **content security policy** first (`default-src 'none'`; the one script allowed by its hash; pictures and fonts from `blob:` and `data:` only; so the browser itself refuses any request), the deck as a JSON block (written so that no text in a deck can end the block or run: `<`, `</script>` and line separators are escaped, and a test tries them), every picture the deck shows **once, as base64 in its own `text/plain` block** read only when a slide needs it, the fonts the deck uses as `@font-face` rules with their data inside, **their licences** (`OFL.txt`) in the file (CLAUDE.md), and the program. Notes are left out of the file entirely when "Include speaker notes" is off, not merely hidden. A picture that cannot be read stops the export and names the slide; there is never a page with a hole. The deck is never changed.
3. **The Export dialog** (`editor`, the board's). "Standalone web page" becomes the choice, as the board shows it first, with "Include speaker notes" and the sizes of both files ("about 4.2 MB"), made as the dialog opens and when an option changes, so the button saves at once. Above 20 MB a quiet note says some e-mail services refuse that (SP-3). The "Coming soon" label of sprint 9 goes.
4. **Fidelity** (SV-5). One test, three renderers, one engine at a time: the same slides drawn in the editor, in the audience window's stage, and in the exported page, all at 1920 × 1080. It compares **where every element and every line of text sits** (within 1 pixel), **the layering**, and the **pixels** (all but a few anti-aliasing edges equal). It covers Autumn Launch and one deck made to be awkward: all seven fonts, mixed bold and italic, lists, long text that wraps, rotated and transparent shapes, pictures with fades, steps at every click. The second criterion, round trip, is a test that opens a saved file and exports it again and gets the same deck (and the same pictures by hash).
5. **Back up all decks** (SV-8, if approved) and the **Gate 4 evidence**. Back up: one zip holding a `.slides` file for each deck (so anyone can take one out, and each opens alone), made by the sprint 9 code with the same checks; **Open file** also accepts it and adds every deck as a new deck. The reminder of the Home board appears when a deck has changed since it was last put in a file and that file is 14 days old or more; its close button hides it for 14 days. When a deck was last saved to a file is kept in a small table of its own in the database (not in the deck, so it is not a change, and not in `localStorage`). The Gate 4 evidence is listed below.

## Budgets (they are failing tests)

- **A 30-slide deck with pictures exports in under 10 seconds** (SV-4): a generated image-heavy deck, timed from the button to the file; Chromium and Firefox are held to it, WebKit is measured and printed. SP-3 measured about half a second.
- **The page's program** has a size budget (provisionally 80 KB minified; the first build sets the real figure and I report it), and **the exporter's lazy chunk** a budget (provisionally 60 KB gzipped) in `config/budgets.json`. The first load must not grow beyond the Export dialog's few lines.
- **No request leaves the page**: the exported file is opened with every request but the file's own refused, and none is made, nothing is logged, and the browser reports no policy violation.

## Acceptance criteria as examples, and how each is tested

U = unit, I = integration (fake IndexedDB), C = component (real Chromium), E = end to end (all three engines, the page opened from a real file), M = manual.

### SV-4 Export to HTML
- Given a deck with pictures and fonts, When it is exported and the file is opened with every outside request refused, Then every slide shows, no request is made, no console error appears and no policy violation is reported. (E, three engines)
- Given the page, Then it fills any window with the slide at 16:9 and re-fits when the window changes; given a phone-sized window, Then it still does. (E at three sizes)
- Given Autumn Launch in the page, When the keys of the show are pressed (every key of `SHOW_KEYS`), Then it moves as the show does: clicks before slides, a number then Enter, Home and End, B and W, F for full screen. (U for the table, E)
- Given the hero slide, Then its three clicks animate as in the editor, a transition plays between neighbours, going back shows the slide before with all its clicks played, and a quick run of keys lands exactly where it should. (E, with the same place checks as sprint 7)
- Given a transparent shape, a faded picture and a transparent text, Then they draw as the editor draws them. (E, in the fidelity test)
- Given "Include speaker notes", Then N shows the slide's notes beside the slide, with the position and the next click or slide, and N again hides them; given it is off, Then the file holds no note text at all. (E, and a test that searches the file)
- Given a touch screen, Then a tap on the right moves on, a tap on the left goes back and a swipe does both. (E with touch emulation)
- Given a title or text with `</script>`, `<!--`, quotes and line separators, Then the file is still one valid page and nothing runs. (U, E)
- Given a picture the store cannot give, Then the export stops, names the slide and the deck and the file are untouched. (I, C)
- Given 30 slides with pictures, Then the export takes under 10 seconds. (perf)
- Given the file, Then it holds the licence of every embedded family and only the families the deck uses. (U)
- Given the Export dialog, Then it opens on the web page, shows both sizes, warns above 20 MB, and has no accessibility violations; given the exported page, then axe finds none on the slide, the notes panel and the key list. (C, E)

### SV-5 Import and export fidelity
- Given Autumn Launch and the awkward deck, When each slide and click is drawn in the editor, the audience window and the exported page at 1920 × 1080, Then every element and every line of text is where the editor has it, to within one pixel, in the same order of layers, and the pixels match all but a few edge pixels. (E, per engine)
- Given a deck file, When it is opened and exported again, Then the deck is the same (apart from its id and times) and the pictures are the same by hash. (U with the property test, E)

### SV-8 Back up all decks (if approved)
- Given several decks, When Back up all decks is chosen, Then one file is saved holding every deck, and the message says how many and how large; given saving is failing, Then it still works; the decks are unchanged. (I, C, E)
- Given the backup, When it is opened in a fresh browser profile, Then every deck is added as a new deck, none is replaced; given one deck in it is damaged, Then that one is named and the others are added. (I, E)
- Given a deck changed since it was last in a file and that file 14 days old (a deck never in a file counts from the day it was made), Then the Home board shows the reminder with the real number of days; a backup or a single-deck export clears it; its close button hides it for 14 days; a deck with no change since says nothing. (U for the rule with a pretend clock, C)

## Gate 4 criteria (proposed; Peter can change them)

The question is "can you deliver a real talk from start to finish, with all 39 Must stories working?"

1. **Every acceptance criterion of sprints 8 to 10 is shown working** on the preview deployment (PM-3 to PM-6, TN-2, TN-3, SV-3, UX-5, UX-7, SV-4, SV-5, and SV-8 if approved), with its tests green on Chromium, Firefox and WebKit.
2. **All 39 Must stories have an end-to-end test.** A test reads `docs/user-stories.md` and fails when a Must story's ID is in no end-to-end or performance test name (today AN-6, TN-5 and PM-5 have tests that do not carry their ID, and SV-4 is this sprint's), and the sprint log lists each Must story with its tests.
3. **A real deck goes the whole way.** By end-to-end tests, Autumn Launch is built in the editor, presented from first slide to last in two windows, exported as a file and as a web page, the page presented from first slide to last with the network off, and the deck file opened in a fresh profile and found whole.
4. **Nothing is lost.** An export never changes the deck; a failed export (a picture that cannot be read, a full disk) says so and leaves everything; a show never changes the deck (Gate 3's test, kept).
5. **Accessibility and budgets hold.** axe finds nothing on the Export dialog, the exported page, the presenter view and the audience window; the first load stays inside 300 KB; the new budgets above hold; the exported page makes no request.
6. **Peter gives a short talk of his own** from the live app (two windows) and from an exported page in another browser, on his own machine, and says whether he would try a real one (manual).

What stays manual, and goes on the rehearsal list: the page opened from disk in real Safari, on a phone (a file sent by AirDrop or mail), and on a real projector; a second display; fonts on Windows, macOS and Linux; the real install and update (sprint 9's list); the whole talk.

## Decisions needed from Peter

1. **Approve this plan, and the Gate 4 criteria** (or change them).
2. **SV-8 Back up all decks in this sprint** (about 2 days, after SV-4 and SV-5; the first thing cut if the sprint runs over, with SV-5's second criterion). The backup is a plain `.zip` holding one `.slides` file for each deck, named "Cue backup" and the date. Opening it in Cue adds the decks that are fine and names any that are not (a backup with one bad deck is still worth restoring). Is that right, and is Should the right priority?
3. **The board's "Embed fonts and images (needed for offline use)" box.** SV-4 says the file "includes all images and fonts", and a page without them could not work offline, so I would not offer a way to turn it off: the row says "Pictures and fonts are included, so it works offline" instead. This changes the board, so it is yours to say (rule 6). Or should unticking it make a small text-only page?
4. **Notes in the page.** N shows them beside the slide in the same window; the file never holds them when "Include speaker notes" is off. The board says "press N in the page to show them". Is a panel in the same window right (a file cannot reliably open a synced second window), or do you want more?
5. **How the page looks.** There is no board for it. I would make it a black window with the slide centred at 16:9, no chrome, and a thin control bar (previous, "3 / 12", next, notes, full screen) that appears when the mouse moves or the screen is touched and fades after a few seconds; the notes panel on the right (below on a narrow screen); the key list on **?**. I will build to the style guide and show it at the review. Is that the right direction?

## Decisions I am making (technical; Peter can overrule)

41. **The page's program is built from the shared renderer by a nested Vite build, as part of `npm run build`, and inlined by the exporter as text** (a lazy chunk with its own budget, cached by the service worker with the app). It imports only `model` and `render`, which an ESLint rule and a test of the built file enforce.
42. **The file's content security policy allows exactly one script, by its hash**, and nothing else outside `data:` and `blob:`; the deck is data in a JSON block and pictures are base64 in `text/plain` blocks, none of which the browser runs.
43. **An export is made from the deck in the tab as the dialog opens**, never from the store, so it works while a save is failing and never writes anything.
44. **A picture that cannot be read stops the export** and names the slide, instead of a page with a hole.
45. **The page's keys are the show's own table plus a short page-only table** (N, ?): the page and the show cannot disagree, and the key list is drawn from the table.
46. **Fidelity is compared within one engine** (the editor, the audience window and the page, at 1920 × 1080): element and text-line positions to within one pixel, and the pixels with a small tolerance for anti-aliasing. Different engines are never compared (their text differs).
47. **The time a deck was last saved to a file is kept in its own small table** in the database (not in the deck, so it is not a change, and not in `localStorage`; the storage rules test stays as it is).

## Risks

- **The page's text wraps differently from the editor's.** The renderer, the fonts and the four rules of SP-2 are shared, so it should not; the three-way test is there to catch it, in every engine.
- **A browser treats a page opened from disk differently** (blob addresses or the policy in WebKit's `file:` pages). The end-to-end tests open real files in all three engines; real Safari is on the manual list.
- **A big deck makes a big file** (about 1.35 times its pictures, SP-3): the file is built from pieces and never as one string; the dialog says the size and warns above 20 MB.
- **The nested build is awkward in the dev server and the tests.** Fallback: a script that builds the page's program first (`predev`, `pretest`), which costs a step but nothing else.
- **The page's program grows.** The budget is a failing test; the first build sets it.
- **Gate 4 is the biggest checkpoint so far.** The criteria are written so that an automated test and a rehearsal each carry part; if sprint 10 runs over, SV-8 and SV-5's round trip go first, never SV-4.
