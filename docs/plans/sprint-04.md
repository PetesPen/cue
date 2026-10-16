# Sprint 4 plan: Images, undo and slide management

Status: **waiting for Peter's approval** (written 2026-10-16, together with `sprint-03.md`). Stories: EL-4, EL-8, SL-3, SL-4 (all Must). Nominal load 16 days. **The review after this sprint is Gate 2, "Editor alpha": can you build and save a real deck of text, shapes and images, with undo?**

## Outcome at the review (Gate 2)

Drop in photos and pictures, undo and redo anything (slide changes too), reorder, duplicate and delete slides, and have it all survive a reload. For the gate itself, I rebuild a real second deck of yours in Cue (see the question below) so we can judge it on something real, not on the sample deck.

## Approach: five slices

1. **One history stack** (`model`, `editor`; decision 18). A list of command results (patches and inverse patches) with undo and redo, a label for each ("Move", "Delete slide 4"), the current slide and selection to come back to, and merging of bursts of the same kind of edit within a second (typing, arrow-key nudges). A drag, resize, rotation or slider drag is already one command. TipTap's own history is switched off, so there is exactly one stack. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (and Ctrl+Y), buttons in the top bar as in the board. History survives switching slides and resets when the deck is closed. Property tests: any command followed by undo returns the deck; undo then redo returns the result; merging never loses an edit.
2. **Images** (`storage`, `render`, `editor`). Add by upload, drag and drop, or paste. PNG, JPEG, GIF, SVG and WebP are accepted. Each photo is stored once, by content hash, as raw bytes plus a type, in the same transaction as the deck (as built and tested in sprint 1); loaded one at a time as slides need them. A large image is scaled down on import (long edge capped) to protect storage, with the original kept for export where space allows; the toast from the States board says what happened ("Image scaled to fit", with Undo). An unreadable file or a full store gets a friendly message. New element type `image` (box, rotation, opacity, alt text, which photo); opacity respects PNG and SVG transparency (the TR-1 criterion left open in sprint 2). Orphan photos are swept at startup.
3. **Slide management** (`editor`). Drag a thumbnail to a new place with a drop indicator; numbers update at once; the move can be undone. Right-click and keyboard shortcuts for Duplicate (copies every element, note, and later animations) and Delete (undoable, with the "Slide 4 deleted" toast and Undo from the States board; deleting the only slide leaves a blank one).
4. **Storage and failure states** with real images: the "nearly full" and "can't be saved" banners from sprint 1, now reachable with photos; the storage-full path is tested with a mock.
5. **Gate 2 rehearsal**: rebuild your second deck, note what is missing or awkward, and write it up for the review.

## Acceptance criteria as examples, and how each is tested

### EL-8 Undo and redo
- Given any edit, When Ctrl+Z is pressed, Then the deck is as it was; Ctrl+Shift+Z puts it back; the same for slide changes. (U property tests over every command; E)
- Given a drag, a resize, a rotation or a burst of typing, When Ctrl+Z is pressed once, Then the whole gesture or burst is undone. (C, E)
- Given edits on slide 3 then a visit to slide 5, When Ctrl+Z is pressed, Then slide 3's edit is undone and slide 3 is shown. (E)
- Given a deck closed and reopened, Then the history is empty. (C)

### EL-4 Add images
- Given a PNG, JPEG, GIF, SVG and WebP file, When each is dropped, pasted or chosen, Then it appears on the slide, centred, keeping its proportions and scaled to fit. (E with real files)
- Given an image of 6000 x 4000, When it is added, Then it is scaled down on import, the toast says so, and Undo reverses it. (C, E)
- Given a file that is not an image, or a store that is full, When it is added, Then a clear message appears and nothing is half-saved. (C with a mock store, I)
- Given a deck with photos, When it is saved and reopened, Then every photo is there (the sprint 1 criterion left open: SV-1 "including images"). (E)
- Given a PNG with transparent parts, When the image is faded, Then the transparency is kept. (V)

### SL-3 Reorder slides
- Given the rail, When a thumbnail is dragged, Then a line shows where it will land, numbers update when dropped, and undo puts it back. (E, C)
- Given the keyboard, When a slide is moved with its shortcut, Then the same happens. (C)

### SL-4 Duplicate and delete slides
- Given a slide with elements and notes, When it is duplicated, Then the copy has every element and the notes, sits right after, and is selected. (E)
- Given a slide, When it is deleted, Then it goes, the toast offers Undo, and Undo brings it back in the same place. (E)
- Given the only slide, When it is deleted, Then a blank slide remains. (U, E)

## Decisions needed from Peter

1. **Approve this plan.**
2. **Which real deck should I rebuild for Gate 2?** Something you have given or will give, of about 10 to 12 slides with text, shapes and photos. Send it (as slides, a PDF or screenshots) when you can; it need not be this week. If there is none, I will use the Autumn Launch deck from the design, as planned. (This is open decision 4.)

## Assumptions to check

- Large images are scaled so the longer side is at most 2560 px; the original is kept as well when it is under 8 MB. (Numbers are mine; say if you want others.)
- Undo history is kept in memory only; closing the deck clears it.
- Slide shortcuts: Ctrl+D duplicates, Delete deletes, Ctrl+Shift+Up and Down move a slide, when the rail has focus.

## Risks

- **Undo across everything** is the plan's named risk. One stack, commands that already carry their inverse, and property tests over every command are the answer.
- **Browser image decoding** differs (WebP, SVG with scripts). SVG is drawn only through an image element (never inlined), so a script in a file cannot run.
- **Storage with real photos** is where quotas show; the nearly-full and failed-save paths get end-to-end tests with a stubbed quota.

## Manual checks for the review

Drag and drop from your file manager and from a browser; pasting an image from the clipboard; very large photos; undo feel with a trackpad; your own Firefox.
