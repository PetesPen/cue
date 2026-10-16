# Sprint 5 plan: Keyboard, speed and first animations

Status: **approved by Peter on 2026-10-16** ("I approve them"), with the slide background (SL-5, the solid colour) and the timing controls (AN-4) added to this sprint (written together with `sprint-06.md`; the review after sprint 6 is the next one). Stories: UX-2, UX-3, AN-1, AN-2, TR-3 (all Must), SL-5 and AN-4 (Should, pulled in). Nominal load 19 days against 14: 15 for the plan below (the first Preview bar, which the sprint demo needs, is about a day taken from AN-6 in sprint 6), 2 for SL-5 and 2 for AN-4.

## Outcome at the next review (after sprint 6)

Set a slide's background and choose how long, how late and how eased each step is. Work the editor from the keyboard (every shortcut on the Shortcuts board that exists today, a `?` cheat sheet, shortcuts in every tooltip), on slides of 50 elements and decks of 50 slides, without a stutter. Make an element appear or disappear on a click, see which elements are animated and in which click, and play the clicks in the editor with Preview. Opacity is the same number everywhere it is drawn.

## Approach: seven thin slices, in this order

0. **Slide background (SL-5, the solid colour)** (`model`, `render`, `editor`). The slide already stores a background colour (the fixture deck sets it in data); this adds the control. With no element selected, the Design tab shows a "Slide" section with the background colour (the picker of EL-10, so also the colours the deck uses) and an "Apply to all slides" button. A command sets one slide's background or all of them, one undo step each; every renderer already draws it (thumbnails, Preview, later the show and the export). The image background and its opacity are carried to sprint 12. Tests: the command and its inverse (U, property), the control and "Apply to all" (C), set, reload and read back (E); the rebuilt hero slide of the Gate 2 test now starts with the dark background instead of a rectangle.
1. **Steps in the model** (`model`). Each slide gets an ordered list of animation steps (optional, absent means none, so every deck saved so far still opens; the schema version stays 1 until the file format ships in sprint 9). A step is `{ id, element, effect, trigger, duration, delay, easing }`: effect is Appear (instant, fade, or fade and rise) or Disappear (instant or fade out); trigger is On click or With previous; duration (0.5 s), delay (0 s) and easing (ease out) have defaults and, with AN-4 pulled into this sprint, their controls (slice 4). Clicks are derived: a new click starts at each On click step (the first step is always On click). Commands, all through history: add a step, change its effect, trigger or style, remove it; removing elements removes their steps; duplicating a slide copies its steps to the new element ids (the SL-4 criterion carried from sprint 4). Parsing drops a step whose element is gone.
2. **The resolver** (`model`, pure). `resolve(slide, click)` gives the state of every element after that many clicks (shown or hidden, and later the position); `playsFor(slide, click)` gives the steps that play on that click. An element whose first step is Appear starts hidden; one whose first step is Disappear starts shown; a later step overrides an earlier one. No DOM, so it carries the table and property tests, and stepping back (AN-7, sprint 11) is "resolve the click before and play the difference the other way".
3. **Drawing and playing** (`render`). The renderer takes an optional "state at click N" and draws hidden elements as not there; opacity is always the element's own number times the state's (TR-3). A small motion player plays the change between two clicks with the Web Animations API, using only `transform` and `opacity` (SP-4), from the resolver's plays; when it finishes the DOM is left in exactly the resolver's end state, so an interrupted or repeated play never drifts. Instant effects set the state at once.
4. **The Animate tab** (`editor`). As on the Editor-Animate board: "This slide" with its step and click counts and the Preview button; the steps grouped by click (grip, swatch, name, effect, "with previous"); the section for the selected step with the Appear and Disappear buttons, On click and With previous, and Remove step. With an element selected and no step yet, the panel offers Appear and Disappear and adds the step at the end. The element names in the list are derived (a text box shows its first words, a shape its kind, a picture its description), because elements have no names until the layers panel (ZO-2). On the canvas, an element that starts hidden is drawn faded (45% of its own opacity) and each step carries a numbered badge for its click, the selected step's in green (overlay only, never in thumbnails, Preview or the show). In the slide rail, a slide with steps carries the small yellow dot. Preview (a first version): a bar at the foot of the canvas as on the board, with "Play click N", back and forward and "Click N of M"; Escape or the Preview button ends it and every element returns to its editing look. Sprint 6 finishes Preview (AN-6) once Move exists. **Timing (AN-4):** the step settings gain the board's Duration (0.1 to 5 s) and Delay (0 to 5 s) sliders and the easing buttons (Linear, Ease in, Ease out, In-out), with the defaults of 0.5 s, no delay and ease out; the player uses them, a With previous step starts at the beginning of its click plus its own delay, and the click ends when its last step ends.
5. **Speed** (UX-3, `editor` and tests). A generated slide of 50 mixed elements (shapes, text, pictures, transparency) and a generated deck of 50 slides from the Autumn Launch slides feed a new performance suite (`npm run perf`, nightly, Chromium and Firefox; WebKit is measured and only watched for regressions, as SP-4 found). It measures drags and resizes (frames on time, from a Chromium trace as in SP-4, not only the page's frame gaps), the time from opening a 50-slide deck to the first slide drawn with its fonts and the first screenful of thumbnails, and the longest delay of a key press while typing in that deck. Likely fixes, done only where a measurement asks for them: draw only the elements that changed during a drag; draw rail thumbnails only near the visible part of the rail and refresh a changed slide's thumbnail when the browser is idle; load pictures and fonts for visible slides first. Because a nightly run is slow to say "you broke it", fast checks run on every pull request: a component test counts re-draws (a drag draws only the moved element and its frame; typing re-draws one thumbnail, not fifty).
6. **Keyboard** (UX-2, `editor`). One table of shortcuts (name, keys, group, whether it exists yet) feeds the key handler, the tooltips and the cheat sheet, so they cannot disagree, and a test fails if a toolbar button with a shortcut does not show it. New keys: S (the last shape used, Rectangle at first), I (opens the image picker), Ctrl/⌘ Shift D (duplicate slide from anywhere; Ctrl+D in the rail keeps doing it), Ctrl/⌘ S ("Save now": saves at once and shows Saved, and keeps the browser's save-page window away), the up and down arrows to the previous and next slide when the slide rail is focused or nothing is selected on the canvas, and `?`. The cheat sheet is the Shortcuts board: a search field, two columns, the Ctrl and ⌘ note, Done. Tooltips are a small component of ours (name and keys in the key-cap style of the board; on hover after a moment and on keyboard focus; `role="tooltip"`), because the browser's own `title` is slow and cannot show key caps. Keys show as ⌘ on a Mac and Ctrl elsewhere.

## Acceptance criteria as examples, and how each is tested

U = unit, C = component (real Chromium), E = end to end, P = performance (nightly), V = screenshot, A = axe, M = manual.

### SL-5 Set a slide background (the solid colour; the image is sprint 12)
- Given a slide with nothing selected, When a colour is picked in the Slide section of the Design tab, Then the slide, its thumbnail and Preview show it, and it is one undo step. (C, U)
- Given a colour chosen, When "Apply to all slides" is pressed, Then every slide has it, in one undo step. (C, U)
- Given a deck with backgrounds, When it is reloaded, Then they are as they were. (E)

### UX-2 Fast, keyboard-first work
- Given the editor, When each shortcut of the table is pressed (new slide, text, shape, image, bring forward and back, to front and back, duplicate, duplicate slide, delete, undo, redo, save now), Then it does what its name says. (C table test, E for the main ones)
- Given the cheat sheet is closed, When `?` is pressed outside a field, Then it opens with focus inside it; typing in the search field narrows the list; Escape or Done closes it and puts focus back. (C, E, A)
- Given a toolbar button that has a shortcut, When it is hovered or focused, Then its tooltip names the shortcut. (C, over every button in the table)
- Given a Mac user agent, When the sheet and the tooltips are drawn, Then they show ⌘ for Ctrl. (C)
- Given the shortcuts for presenting (start, from this slide, blank, end), When the show exists (sprint 7), Then the section appears on the sheet; until then it is not listed, because a list of keys that do nothing would be wrong. (carried to sprint 7: the "present" part of the first criterion)

### UX-3 Responsive performance
- Given a slide of 50 elements, When one is dragged or resized, Then at least 95% of frames are on time on the nightly runner (Chromium and Firefox) and a drag draws only the moved element and its frame. (P, C re-draw count)
- Given a deck of 50 slides, When it is opened, Then the first slide is drawn with its fonts and the first thumbnails are there within 2 seconds. (P)
- Given a deck of 50 slides, When text is typed, Then no key press waits more than the budget (set from the first measured run, with headroom, in `config/budgets.json`) and only the thumbnail of the edited slide is redrawn. (P, C re-draw count)
- The 60 fps target on a real laptop and a Mac stays a manual check (SP-4). (M)

### AN-1 Make an element appear
- Given a selected element, When Appear is chosen in the Animate tab, Then a step is added, the element is drawn faded with a badge for its click, and Preview shows it hidden until that click plays. (C, E)
- Given an Appear step, When Instant, Fade, or Fade and rise is chosen, Then Preview plays that effect (opacity from 0 to the element's own; rise by a small distance with `transform`). (C, U on the plays)
- Given a deck with steps, When it is reloaded, Then the steps, their order and their settings are as they were. (I, E)
- Given a resolver table (no steps; Appear first; Disappear first; Appear then Disappear; Disappear then Appear; several in one click), When each click is resolved, Then every element is in the stated state. (U, property: the state after the last click depends only on the last step of each element)

### AN-2 Make an element disappear
- Given a selected element, When Disappear is chosen and Instant or Fade out, Then Preview shows it leaving on that click in that way. (C, E)
- Given an element with an Appear step, When a Disappear step is added, Then both are listed in order, with two badges, and it is shown after the first click and gone after the later one. (C, U)

### AN-4 Control timing and feel
- Given a step, When Duration or Delay is set (slider or typed value), Then it is kept between 0.1 and 5 s, or 0 and 5 s, in tenths, and Preview uses it. (C, U on the plays)
- Given the four easing buttons, When one is chosen, Then the step plays with that easing (`linear`, `ease-in`, `ease-out`, `ease-in-out`). (U on the plays, C)
- Given a new step, Then it has 0.5 s, no delay and ease out, so most steps need no tuning. (U)
- Given two steps in one click, one With previous with a 0.3 s delay, When the click plays, Then it starts 0.3 s after the click and the click ends when the later of the two ends. (U on the plays)

### TR-3 Transparency in animation and export
- Given an element at 60%, When it appears, Then it ends at 60%, not 100%, and it fades out from 60%. (U on the plays, C on the drawn element)
- Given an element at 60%, When it is drawn in the editor, the rail thumbnail and Preview, Then the computed opacity is the same number in all three. (C)
- Given the same element in the presentation window (sprint 7) and the HTML export (sprint 10), Then the same again. (carried: the first criterion is finished when those exist)

## Decisions taken by Peter (2026-10-16)

1. **The plan is approved**, with sprint 6's.
2. **Slide background (SL-5) is in this sprint**, as the first slice: the solid colour and "Apply to all slides" only; the image background stays in sprint 12.
3. **The timing controls (AN-4) are in this sprint**, not sprint 11.

## Decisions I am making (technical; Peter approved the plan that holds them)

21. **Animation steps live in the slide, in one ordered list**, with clicks derived from it, so the panel, the resolver, preview, the show and the export read one thing; the step list is part of the deck, so undo, saving and window sync already work.
22. **The Appear styles (Instant, Fade, Fade and rise) are a small three-way control** in the step settings; it is not on the board (which shows the effect, the trigger, the timing and the easing), so it is built from the Style Guide's segmented control, for you to look at.
23. **Pasting or duplicating elements does not copy their steps**; duplicating a slide does. Copying a deck's worth of animation is a different wish from copying a shape.
24. **"Save now" is Ctrl/⌘ S**, added to the table though the board does not show it: the first criterion of UX-2 names it. It is cheap and stops the browser's Save Page window.

## Assumptions to check

- "Faded in the editor" is 45% of the element's own opacity; the badges are small yellow circles at the element's top right, the selected step's in green, as the board shows.
- Up and down arrows move between slides only when the rail is focused or nothing is selected on the canvas; with a selection they nudge it, as now.
- Presenting shortcuts and the Export shortcut (Ctrl/⌘ E) are listed on the sheet when their features exist, not before.

## Risks

- **Performance depends on the machine.** The nightly runner draws in software; SP-4 wrote the budgets that follow from it (Chromium and Firefox hold 60 fps on normal slides; heavy slides get a limit against their own baseline). A fast PR check on re-draw counts, which does not depend on the machine, catches most regressions earlier.
- **Thumbnails are the likely cost of a 50-slide deck.** Each is a full draw of its slide; drawing only the visible ones is the first fix.
- **Browser shortcuts.** Ctrl+Shift+D, Ctrl+S and Ctrl+E mean something in browsers; they can be overridden on a page, but this is checked by hand in each browser.
- **Rise and instant effects in Preview** must leave the DOM in the resolver's state even when the user clicks fast; a test plays clicks in quick succession and compares with the resolver.

## Manual checks for the review

How motion feels in Preview; 60 fps drags on your laptop; `?` and the tooltips on your keyboard layout (it is `Shift+/` on a US one, other layouts differ); Ctrl+Shift+D, Ctrl+S and Ctrl+E in Chrome, Edge and Firefox; a 50-slide deck on your machine.
