# Sprint 11 plan: Polish: layers, motion, transparency

Status: **written on 2026-10-18 and waiting for Peter's approval, together with the plan for sprint 12** (plans are approved in pairs, rule 9). Stories: ZO-2, ZO-3, TR-2 and AN-7 (all Should). Nominal load 14 days (ZO-2 about 4, ZO-3 about 4, TR-2 about 4, AN-7 about 1, because most of it was built in sprints 7 and 8) against a capacity of 16. There is no gate at the end of this sprint; the review after it is the one after sprint 12 (Gate 5 follows sprint 13).

## Outcome at the review

Open a busy slide and work with the **Layers** list on the Design tab: see everything stacked on it, drag a row to change what covers what, hide an element, lock one so it cannot be moved by accident, give it a name that also labels its animation steps. Make a **see-through panel with solid text** by giving the fill its own transparency. In a show, go back a click and back a slide and find everything exactly as it was.

## Approach: four thin slices, in this order

1. **Names, hiding and locking in the deck** (`model`). Every element may have a `name`, be `locked` and be `hidden`; all three are optional, so a deck that has none looks as it always did. They change what a person sees (a hidden element must stay hidden), so the deck's schema version goes from 1 to 2 and an older Cue says "made by a newer version" instead of silently drawing a hidden element (the existing rule for newer files, SV-3); version 1 decks open unchanged. They are set through the same `updateElements` command as every other property, so undo, autosave, the deck file and the window sync cover them with no new mechanism. The renderer draws nothing for a hidden element, so the editor, the audience window, the presenter view, the thumbnails and the exported page all agree (ZO-3, TR-3); steps on a hidden element have nothing to show.
2. **The Layers list** (`editor`, the Design tab, as the Main board shows it). One row per element, top layer first: a grip, a small swatch or glyph of the element (the fill colour of a shape, a "T" for text, a picture mark), its name, and an eye. Added to the board: a lock beside the eye (the board has the eye only). A click selects the element on the canvas (Shift extends); selecting on the canvas highlights its row and scrolls it into view. **Dragging a row** moves the element in the stack with the canvas updating live, as one undoable step (the same draft-then-commit way a drag on the canvas works, decision 18); Alt and the up and down arrows do the same from the keyboard, as the animation steps do (sprint 6). **Double-click or Enter** renames; an empty name goes back to the default ("Rectangle", "Text: the first words", "Picture"). The step list of the Animate tab shows the element's name.
3. **What locked and hidden do on the canvas** (`editor`). A **locked** element cannot be moved, resized, turned, deleted, nudged or edited from the canvas or the format panel (its fields are disabled, with a word saying why), and a click on the canvas goes through it to what is behind; it can still be selected from the Layers list, copied, and unlocked there. A **hidden** element is not drawn in the editor either, cannot be hit on the canvas, and shows again from the list. Select all takes only what can be edited, so it leaves hidden and locked elements alone (decision 4 below).
4. **Transparency of fill, border and text** (TR-2, `model`, `render`, `editor`). A colour may carry an alpha, written as eight hex digits (`#14281B80`); six digits still mean solid, so nothing stored changes. The renderer turns it into what each place needs (a CSS colour for boxes and text, `fill-opacity` and `stroke-opacity` for shapes, so older Safari draws it too), so the editor, the show and the exported page draw it alike. The colour picker (EL-10) gets an **Alpha slider** and a number, with a checkerboard under the swatch; the format panel shows **what the audience sees**: the element's opacity times the colour's alpha, as a percentage. AN-1's rule stays: an element's set opacity is the level an Appear fades up to.
5. **Going back a step** (AN-7). Sprints 7 and 8 built it: Left or Backspace goes back a click, then to the slide before with every click played, and a transition played backwards is the same transition reversed (a Zoom reversed is a plain Fade). This sprint closes the story with the tests that name it: a property test that any run of forward and back presses lands exactly on the place a model walk says, an end-to-end test of the hero slide forwards and back, and the stage's exactness (the state after going back equals the state of going there).

## Acceptance criteria as examples, and how each is tested

U = unit, I = integration, C = component (real Chromium), E = end to end, M = manual.

### ZO-2 See and rearrange layers
- Given a slide of five elements, Then the list shows five rows, the topmost element first, each with a swatch and a name. (C)
- Given a row dragged above another, Then the canvas shows the new stacking while the row is in the air, and the drop is one undo step; Escape puts it back. (C, E)
- Given a row clicked, Then the element is selected on the canvas; given an element clicked on the canvas, Then its row is highlighted and in view; Shift extends in both. (C, E)
- Given Alt and the arrow keys on a focused row, Then the element moves up or down the stack, and the list says so aloud. (C)
- Given any run of moves, Then the relative order of the rest never changes (property test over z-order, ZO-1's). (U)

### ZO-3 Lock, hide and rename layers
- Given a locked element, Then it cannot be dragged, resized, turned, deleted or typed into from the canvas, its format fields are disabled, a click on it selects what is behind, and it can be selected, copied and unlocked from the list. (C, E)
- Given a hidden element, Then it is not drawn in the editor, the audience window, the presenter view, a thumbnail or an exported page, and the eye shows it again; given an Appear step on it, Then nothing is drawn at any click. (U, C, E)
- Given a name typed in a row, Then the row, the step list and the selection label show it; given it emptied, Then the default returns. (C)
- Given a version 1 deck, Then it opens unchanged; given a deck with a name, a lock or a hidden element, Then it saves and opens as it was, and an older Cue refuses it with a clear message. (U, I)

### TR-2 Control fill and text transparency separately
- Given a shape with a fill alpha of 40% and solid text, Then the fill is see-through and the text is solid, in the editor, the audience window and the exported page. (E, in the fidelity test)
- Given an element opacity of 50% and a fill alpha of 50%, Then the format panel says 25% and the canvas agrees (the product of the two). (U for the arithmetic, C)
- Given the fill, border and text pickers, Then each has an alpha slider and a number, a checkerboard shows through the swatch, and a value dragged is live and saved once on release (decision 18). (C)
- Given a colour with six digits, Then it is solid and is written back as six digits (nothing stored changes). (U, property test)

### AN-7 Go back a step
- Given any run of Right and Left presses in a show, Then the place is where the model's walk says. (U, property test)
- Given the hero slide, When Right is pressed three times and Left four, Then the show is on the slide before, with every click played; and Backspace does the same as Left. (E)

## Decisions needed from Peter

1. **Approve this plan** (with the plan for sprint 12).
2. **The lock.** The board has an eye on each layer row and no lock. I would add a lock beside the eye, quiet until the element is locked. Right?
3. **What lock means on the canvas.** A locked element is not hit by the canvas at all (a click goes through it), as in other tools, and is edited only after it is unlocked from the list. The alternative is that a click selects it but nothing can change it. Which do you want? (I recommend the first: a locked background picture is the usual use, and it must not get in the way of what is on top.)
4. **Select all.** Should it skip locked and hidden elements? (I recommend yes.)
5. **Default layer names.** "Rectangle", "Ellipse", "Text: Our approach" (the first words), "Picture: logo.png". Right?
6. **Older Cue and new decks.** Names, locks and hiding make the deck's schema version 2, so a deck saved after this sprint is refused, with a clear message, by an older Cue. Fine before v1.0?
7. **Where TN-6 (Morph) goes.** It is about 6 days. This sprint has about 2 free; sprint 12 has the room. See the plan for sprint 12.

## Decisions I am making (technical; Peter can overrule)

48. **Names, locks and hiding are properties of the element, set through `updateElements`** (not a new kind of command), so undo, save, files and sync need no change.
49. **A colour's alpha is two more hex digits**, so a stored deck, a deck file and the colour picker's history keep working, and six digits still mean solid.
50. **A layer drag is a draft that commits once**, as every drag is (decision 18).
51. **The renderer skips hidden elements**; it is the one place that decides, so the editor, the show, the thumbnails and the export cannot disagree.

## Risks

- **A new schema version** touches opening, the deck file and the migration table. The tests of every earlier sprint are the safety net, and a version 1 fixture (Autumn Launch) must open and export byte for byte as before.
- **Alpha in SVG colours.** Eight-digit colours are not understood by every browser in an SVG attribute; the renderer converts instead of passing them through, and the three-renderer test covers it.
- **The list on a slide of fifty elements** must not slow the canvas: the rows are cheap and the performance suite gets a layers case.
- **Hit-testing through locked elements** changes how a click chooses what it selects; the canvas tests of sprints 2 and 6 (snap, align, multi-select) must stay green.
