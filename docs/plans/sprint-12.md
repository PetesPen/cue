# Sprint 12 plan: Polish: layout, timer, access (and Morph, if Peter wants it here)

Status: **written on 2026-10-18 and waiting for Peter's approval, together with the plan for sprint 11** (plans are approved in pairs, rule 9). Stories: SL-5 (the image half), PM-7, UX-4 and UX-6 (all Should), and **TN-6 Morph** (Should, added on 2026-10-18 at Peter's request, about 6 days). Nominal load: SL-5 image about 3 days, PM-7 about 2, UX-4 about 3, UX-6 about 2 (a lighter pass, see below) and TN-6 about 6: **16 days against a capacity of 14 to 16**, which is why UX-6's full audit also has a place in sprint 13. **This sprint is followed by the review that decides Gate 5's readiness** (Gate 5, v1.0, ends sprint 13).

## Outcome at the review

Give a slide a picture background with its own opacity, and apply it to every slide. Zoom the canvas in for detailed work and fit it again. Run a talk against a **target time** and watch the timer turn amber and then red. Use the editor with the keyboard alone. And a **Morph**: two slides with the same things in different places, and the things glide from one to the other.

## Approach: five thin slices, in this order

1. **Picture backgrounds** (SL-5, `model`, `render`, `editor`). A slide's background may be a picture with an opacity (the colour stays underneath and shows through it), drawn to fill the slide. The picture goes through the same pipeline as every picture (scaled down on import, stored once by its hash), so it travels in a deck file and in an exported page, and a deck's list of pictures includes it (so it is never swept as unused). The Design tab's Background section (sprint 5) gets a colour or picture choice and an opacity; **Apply to all slides** copies the whole background. A deck with a picture background is a new thing a slide may hold, so, like sprint 11's names and locks, it is part of schema version 2 (if sprint 11 is built first) and an older Cue refuses it kindly.
2. **Zoom and fit** (UX-4, `editor`). The canvas stays **Fit** (the default, and it follows the window), with a quiet chip at its bottom right as the Main board shows ("Fit · 54%"), which opens a small menu: zoom in, zoom out, 100%, Fit. Keys with the canvas focused: Ctrl or Cmd with + and − (the browser's own zoom is kept for everything else), Ctrl or Cmd 0 for Fit; a trackpad pinch (Ctrl with the wheel) zooms about the pointer. A zoomed slide is scrolled by the wheel and by Space-drag, never by dragging an element. Zoom is view state: it is not in the deck and does not go in undo; the canvas already converts every pointer position to slide pixels whatever the zoom, so drawing, dragging, snapping and the selection handles stay exact (a test at three zooms).
3. **The timer's target** (PM-7, `present`, `storage`). Pause and reset were built in sprint 7; this adds a **target time**: a small field beside the timer in the presenter view ("Target 20:00", empty for none). At 90% of it the timer turns amber, past it red, and says so in words ("Over by 2:10"), not only in colour. **A show never changes the deck**, so the target is not kept in the deck: it is remembered for the deck in a small table of the database (as sprint 10's "last filed" is), and by the audience window never. The timer starts with the first move, in either window, as built.
4. **A keyboard and accessibility pass** (UX-6, all screens, lighter in this sprint). Done here: every control of the editor, the library, the dialogs and the presenter view reachable by Tab with a visible ring, proved by one end-to-end test that builds, animates, presents and exports a deck with the keyboard alone; axe with no violations on every main screen in one list; a picture's alt text carried into the exported page (it is: the renderer sets it; the test says so); and the **reduced-motion** wish honoured in the show and the exported page (a transition becomes a plain fade or a cut, a click's animation a cut), which the story's "readable by everyone" asks of a talk too. The full audit (screen reader walk-throughs, zoom to 200%, high contrast mode) is sprint 13's.
5. **Morph** (TN-6, `model`, `render`, `editor`; feasibility note in `docs/backlog/sprint-12.md`). A new transition kind. Elements are twins when they are copies of one another (duplicating a slide, or copy and paste, keeps a small optional **lineage** mark on the element, written when the copy is made; part of schema version 2) or when they are a picture with the same image or a text with the same words. The stage moves the matched elements instead of whole layers: the incoming element starts where its twin was (position, size, turn, opacity) and glides to its own place while the outgoing twin glides to the incoming place and fades, so a colour change reads as a dissolve on the move; unmatched elements fade out and in; the background changes smoothly. Only `transform` and `opacity` change, so TN-5's budget applies unchanged (a heavy-slide case is added to the performance suite). The transition panel shows "N elements will morph" so the match is never a surprise. The exported page gets it for free (it uses the same stage), and the three-renderer test gets a pair of slides that morph.

## Acceptance criteria as examples, and how each is tested

### SL-5 Set a slide background (the picture half)
- Given a picture chosen as a slide's background with 40% opacity, Then it fills the slide behind the elements, the colour shows through it, in the editor, the show, a thumbnail and the exported page. (C, E, the fidelity test)
- Given Apply to all slides, Then every slide has the same background, and one undo takes it back. (C)
- Given a deck file or an exported page of a deck with a picture background, Then the picture is in it once and shows after opening. (I, E)
- Given a deck whose only use of a picture is a background, Then it is not swept as unused. (I)

### UX-4 Zoom and fit
- Given the editor, Then the slide is fitted and re-fits when the window changes; the chip says the percentage. (C, E)
- Given Ctrl +, Ctrl −, a pinch and the menu, Then the canvas zooms in steps from 25% to 400%, Ctrl 0 and the menu's Fit return to fit. (C, E)
- Given a zoom of 25%, 100% and 300%, When an element is drawn, moved, resized and snapped, Then it lands in the same slide pixels. (E)

### PM-7 Time my talk
- Given the first move in either window, Then the timer starts; pause and reset work. (E, from sprint 7)
- Given a target of 10:00, Then the timer is amber from 9:00 and red from 10:00, with "Over by m:ss" in words, and the target is remembered for the deck and does not change it. (U for the states with a pretend clock, C, E)

### UX-6 Accessible by default
- Given the whole path (new deck, add text and a shape, animate, present, export) done with the keyboard alone, Then it can be done and the focus is always visible. (E)
- Given every main screen, Then axe finds nothing (one list, one test). (E)
- Given a picture with alt text, Then the exported page has it. (E)
- Given a system set to reduce motion, Then a transition is a fade or a cut and a click's animation a cut, in the show and the exported page. (C, E)

### TN-6 Morph transition
- Given two slides with copies of the same elements in different places, sizes, colours and opacities, Then Morph moves, resizes, turns, recolours and fades each element from its first state to its second, ending exactly on the second slide. (C for the stage, E)
- Given an element on only one of the slides, Then it fades out or in during the same time. (C)
- Given a duplicated slide, a pasted element, a picture with the same image and a text with the same words, Then each is matched; given two unrelated elements, Then they are not. (U for the matching, a property test: matching is symmetric, one to one and never crosses kinds)
- Given Morph and a step back, Then it plays in reverse, and a quick run of presses lands exactly. (C, E)
- Given a slide of 50 elements, Then Morph stays inside TN-5's late-frame budget (Chromium and Firefox). (perf)
- Given the exported page, Then it morphs the same way. (E)

## Decisions needed from Peter

1. **Approve this plan** (with the plan for sprint 11).
2. **Is Morph in this sprint?** With it the sprint is 16 days (capacity 14 to 16, no slack). Options: **(a) Morph here, UX-6 as the lighter pass above** (my recommendation; the full audit is in sprint 13); (b) Morph in sprint 11 instead of ZO-3 (lock, hide and rename), which moves ZO-3 here; (c) Morph after v1.0.
3. **Zoom keys.** Ctrl or Cmd with + and − are the browser's own zoom everywhere else. I would take them only while the canvas has focus. Right?
4. **The target time** has no board. A small "Target" field beside the timer in the presenter view, remembered for the deck. Right, and should it also be settable in the editor?
5. **Reduced motion.** Should a show honour the system setting (transitions become fades or cuts)? A talk is also where motion can make someone unwell. (I recommend yes.)
6. **How twins are found for Morph:** copies (duplicate slide, paste) and identical pictures or words. Is that the rule you meant by "the same content"?

## Decisions I am making (technical; Peter can overrule)

52. **Zoom is view state**, not in the deck or in undo.
53. **The talk's target time is kept for the deck in the database, not in the deck**, so a show never changes the deck (sprint 7's rule).
54. **Morph moves matched elements with `transform` and `opacity` only** (a copy of each twin crossfades along the move), so the budget of TN-5 holds; the in-between frames may stretch an element that changes shape, the end is exact.
55. **A picture background is a picture of the deck like any other** (stored once by its hash, in the deck file and the page).

## Risks

- **Morph is the largest story here** and the stage is the most delicate code in the app (sprint 7). It is built last, on its own branch, with the heavy-slide measurement first; if it threatens the sprint it moves to sprint 13's slack or after v1.0, not into the other stories.
- **Zoom and the selection overlay**: everything is already placed in percentages of the slide, which is what makes zoom cheap; the test at three zooms guards it.
- **The target in the presenter view** must never write to the deck; the test checks the stored deck is byte for byte the same after a show with a target.
- **Schema version 2** is shared with sprint 11: whichever is built first adds the version and its migration, the other adds fields.
