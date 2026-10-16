# Sprint 6 plan: Motion and sequencing

Status: **waits for Peter's approval** (written together with `sprint-05.md`; the review after sprint 6 is the next one). Stories: AN-3, AN-5, AN-6, TN-1 (all Must). Nominal load 15 days against 16 (the backlog says 16; about a day of AN-6 is already built in sprint 5 as the first Preview bar).

## Outcome at the next review (after sprint 6)

Move an element along a path you drag into place, put the steps of a slide in the order you want, group some to play together, play them all in the editor with Preview and find every element back where you left it, and choose how each slide arrives. Transitions are chosen and shown on the thumbnail in this sprint; they first play in sprint 7 (TN-4, TN-5).

## Approach: five thin slices, in this order

1. **Move in the model and the resolver** (`model`, `render`). A third effect, Move, carries an end position: the top left of the element where it ends, in slide coordinates, so it does not change when the element's start is moved (the path simply redraws). The resolver's state gains a position: the element's own place until its first Move plays, the Move's end after, and the next Move starts from there ("stays there for later steps"). The renderer places a moved element with `transform` only, composed with its rotation so a turned element ends with its centre where the ghost's is. The motion player slides it from the start to the end; Move animates position only (size and rotation changes stay Could and are not built). New commands: set a Move's end position (one step per drag). A new Move step starts with its end a little to the right and down, kept inside the slide.
2. **The ghost and the path** (`editor`). With a Move step selected, the canvas shows a dashed copy of the element at its end (the board's dashed circle with "Ends here · drag"), a dotted arrow from start to end, and numbered badges. The ghost is dragged like an element: a draft while the mouse is down, one command and one undo step when it is released (decision 18). For the keyboard and screen readers the ghost is focusable and moves with the arrow keys (Shift for 10 times as far), and the step's settings gain two number fields, End X and End Y (not on the board; built from the panel's own number fields). Nothing of this appears in thumbnails, Preview or the show.
3. **Sequencing** (`model`, `editor`). The step list gets its drag handle: steps are dragged to a new place with a drop line, as in the slide rail, or moved with Alt+Up and Alt+Down on the focused row. Each step's On click or With previous is set in its settings; the first step is always On click, and a command that puts a With previous step first turns it into On click, so the list always reads sensibly. The "Click n" headings, the step count and the click count ("4 steps, 3 clicks") are derived. Removing an element removes its steps (built in sprint 5, shown here with the end-to-end test). All commands are in the property tests that every command undoes exactly.
4. **Preview, finished** (`editor`, `render`). Preview plays Appear, Disappear and Move. Clicking the slide, Space or the right arrow plays the next click; the left arrow steps back (the resolver makes this free); Escape or the Preview button ends it. Preview never touches the deck: its state lives outside the document, so it makes no history, no save and no draft. Ending it, changing slide or tab, or starting to edit stops any running animation and puts every element back in its editing position; a test compares every element's box before and after. A slide with no steps shows Preview disabled, with the panel's line "No animations on this slide."
5. **Transitions as a choice** (TN-1, `model`, `editor`). Each slide gets a transition (optional, absent means None): a kind (None, Fade, Slide, Push, Zoom) and, from the start with their defaults, a direction (Slide and Push come from the right) and a duration (0.6 s), so TN-2 (sprint 11) only adds controls. The Transition tab is the board's: the title "Slide N transition" and "Plays when this slide appears", the five effects as small pictures (inline SVG from the tokens), the chosen one outlined, and the note about the thumbnail badge. The first slide's panel says it has no incoming transition and offers no choice (a TN-4 criterion that costs nothing to do now). The thumbnail gets the small arrow badge when a transition is not None. Duplicating a slide copies its transition (the SL-4 criterion carried from sprint 4). The direction row, the duration slider, "Apply to all slides" and "Reset to none" are drawn on the board but belong to TN-2 and TN-3 (sprint 11) and the preview bar to TN-4 (sprint 7); none is built here.

## Acceptance criteria as examples, and how each is tested

U = unit, C = component (real Chromium), E = end to end, V = screenshot, A = axe, M = manual.

### AN-3 Move an element
- Given a selected element, When Move is chosen, Then a step is added and the canvas shows a dashed ghost at the end position and a dotted path from the start to it. (C, E)
- Given the ghost, When it is dragged and released, Then the end position changes in one undo step, and the path follows while dragging. (C, E, U on the command)
- Given a Move step, When Preview plays the click, Then the element ends exactly at the ghost's place (also for a turned element) and stays there for the later clicks; before the click it is at its own place. (U on the resolver, C on the drawn boxes)
- Given two Move steps for one element, When the second plays, Then it starts where the first ended. (U)
- Given a Move step, When the element is moved or resized in the editor, Then the end position does not change. (U)
- Given the ghost focused, When the arrow keys are pressed or End X and End Y typed, Then it moves, and a screen reader hears the position. (C, A)

### AN-5 Sequence steps click by click
- Given steps on a slide, When the Animate tab is opened, Then they are listed in play order under "Click n" headings, each showing its element and effect, with the counts. (C)
- Given a table of reorders (move first to last, last to first, a With previous step to the front, the only step, a move to its own place), When each is made, Then the order and the triggers are as written in the table. (U table test)
- Given the step list, When a step is dragged to a new place or Alt+Up or Alt+Down is pressed on it, Then it moves, one undo step. (C, E)
- Given a step, When With previous is chosen, Then it joins the click before it and plays with it; the first step cannot be With previous. (C, U)
- Given an element with steps, When it is deleted, Then its steps go with it, and Undo brings both back. (U, E)

### AN-6 Preview animations
- Given a slide with steps, When Preview is pressed and the slide clicked (or Space, or the right arrow), Then the clicks play one at a time, and the left arrow steps back. (C, E)
- Given a Preview that is played, stopped halfway, or finished, When it ends (the button, Escape, another slide, another tab, an edit), Then every element is back in its editing position, and the deck, the history and the saved copy are unchanged. (C, U: strict equality of the deck object)
- Given a slide without steps, Then Preview is disabled. (C)

### TN-1 Choose a transition
- Given the Transition tab, When it is opened, Then None, Fade, Slide, Push and Zoom are offered and the slide's own is outlined; a new slide has None. (C)
- Given a choice, When it is made, Then it is saved with the slide (reload), is one undo step, and the thumbnail shows the small arrow badge unless it is None. (C, E)
- Given the first slide, When the tab is opened, Then it says there is no incoming transition and offers no choice. (C)
- Given a slide with a transition and steps, When it is duplicated, Then the copy has the same transition and its steps point at the new elements. (U)
- Given the Animate and Transition tabs with steps, a Move ghost and a chosen transition, Then axe finds no violations. (A)

## Decisions needed from Peter

1. **Approve this plan** (and sprint 5's, in `sprint-05.md`).

Nothing else is needed from you before building; the questions below are mine to settle unless you object.

## Decisions I am making (technical; Peter can overrule)

25. **A Move's end is an absolute place on the slide**, not a distance from the start. Moving the element later redraws the path and does not drag the ghost along; this is what the ghost on the board shows (you place the end).
26. **The first step of a slide is always On click**; a reorder that would put a With previous step first changes it to On click. The alternative (storing it and showing it as On click) would bring the old trigger back unexpectedly when another step is moved ahead of it.
27. **Preview state lives outside the deck.** It cannot make history, a save or a draft, and nothing it does survives it, which is what "returns to the editing positions" needs.
28. **A transition stores its direction and duration from the start**, with the defaults the stories give (from the right, 0.6 s), so the later controls (TN-2) need no change to the file.

## Assumptions to check

- The ghost and path show only for the selected Move step, to keep the canvas clean; badges show for all steps.
- A slide may have a Move step for any element, including text and pictures. A text box that grows by typing keeps its end position.
- Preview plays the effects as set, also when the computer asks for reduced motion (the presenter chose the motion for the audience); this is revisited with keyboard-only and zoom work in UX-4 (sprint 12).
- Resize and rotation changes in Move are Could in the story and are not built.

## Risks

- **A moved, turned, faded element has several transforms.** The renderer composes them in one place and a test checks the end box for rotated elements; the motion player never animates anything but `transform` and `opacity`.
- **Dragging steps and dragging the ghost use the pointer on a busy canvas.** The ghost is a separate overlay, the list uses the rail's tested drag, and both have keyboard equivalents.
- **Preview left in a half state** (an animation running while the user changes slide or edits) is the likely bug; the end-of-preview reset cancels every animation and re-draws from the resolver, tested for each way out.

## Manual checks for the review

How Move, Appear and Disappear feel in Preview (speed, easing, the rise); dragging the ghost and dragging steps with a mouse and a trackpad; ordering and grouping a real reveal on "Our approach" (three pillars, one click each, then the circle moving); the thumbnail badge.
