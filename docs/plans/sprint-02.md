# Sprint 2 plan: Elements you can move

Status: **built; waiting for Peter's review** (approved by Peter on 2026-10-16), including: text inside a shape moves to sprint 3, the shape style panel is Claude's design, the load of 18 days is fine ("whatever works"), and decision 18. The GitHub setting for screenshot baselines is done. Written 2026-10-15. Stories: EL-5, EL-3, ZO-1, TR-1 and the new SV-7 (all Must). Planned load 18 engineering days against a capacity of 16 (SV-7 came from decision 16); velocity is unmeasured and is re-estimated after this sprint.

## Outcome at the review

Open the site, draw rectangles, ellipses, triangles, lines and arrows on a slide, then move, resize, rotate, layer and fade them, with the numbers shown next to what you drag and in the format panel. Reload and everything is as left. Open the same deck in two tabs and the second one tells you.

## Approach: seven thin slices, in this order

Each slice goes from the model to the screen and has its tests. Each story gets a short branch, a pull request, a Netlify preview, and a run of the end-to-end suite against that preview before it merges.

1. **Elements in the model** (`model`). A slide's `elements` stop being a placeholder. One element type for now, a shape, with: id, kind, x, y, width, height, rotation (degrees), opacity (0 to 1), fill, border (colour, width, dash), corner radius, and which shape it is (rectangle, rounded rectangle, ellipse, triangle, line, arrow). Later sprints add text and image elements to the same list. Stored decks stay at schema version 1: no stored deck has an element yet, and `parseDeck` now checks them. New commands, still plain data run through Immer: add an element, change properties of several elements at once (move, resize, rotate, opacity, style), and reorder (front, forward, backward, back). New elements go on top. A **line is a shape of height 0 turned by its rotation**, so its handles, 15-degree snapping and group transforms need no special case. Pure geometry functions (group bounds, resize about an anchor, rotate about a centre, snap) live in `model` with property tests: reorder keeps the selection's relative order (ZO-1); command then inverse returns the original deck; a group resized then resized back returns the original boxes.
2. **Drawing shapes** (`render`). The renderer draws every shape as a small SVG in a positioned box (so fills, dashes, rounded corners and arrowheads need no special cases), with rotation and opacity on the box. Opacity is on the whole box: fill, border and later text fade together (TR-1). Thumbnails, the canvas and the library cards use the same renderer. It gains an update path that changes only the elements that changed, which dragging needs.
3. **Selecting and moving** (`editor`). Click selects, Shift-click adds, a drag on empty canvas draws a selection box, Escape clears. The selection outline, handles and size chip follow the Main board. Drag moves; arrow keys nudge 1 px, Shift+arrow 10 px. While dragging, the canvas shows a draft and **one command is committed on release**, so a drag is one history step and one autosave. This is also the answer to the plan's "one history stack" risk, written down as decision 18 below.
4. **Resizing and rotating**. Corner and edge handles resize (Shift keeps proportions), the round handle rotates, with live readouts of size, position and angle while dragging. Lines show two end handles. A multi-selection moves, resizes and rotates as one box.
5. **Adding shapes** (EL-3). The toolbar's Shape button opens a menu of the six shapes; click and drag on the slide to draw one; a simple click puts a default-size one in the middle. Shift keeps proportions and snaps a line to 15-degree steps. The new shape is on top and selected.
6. **The format panel** (EL-3, ZO-1, TR-1). With something selected the Design tab shows what applies: Position and size (X, Y, W, H, plus rotation), Opacity (slider and number, live on the canvas), Arrange (Front, Forward, Backward, Back, disabled when they would do nothing), and a Shape section for fill, border colour, width and dash style, and corner radius. A right-click menu on the canvas has the Arrange commands, and so do the keyboard shortcuts. With a multi-selection, values that differ show as "Mixed".
7. **One tab per deck** (SV-7). The editor takes a Web Lock named for the deck before it loads it. A second tab for the same deck shows "This deck is open in another tab" with a link to the library, and waits on the lock, so it opens by itself when the first tab closes. And the first set of **screenshot tests** (opacity, selection chrome) with their baselines, made in the pinned container by a manual workflow that opens a pull request for you to review (decision 13).

## Acceptance criteria as examples, and how each is tested

U = unit (Vitest), I = integration (fake-indexeddb), C = component (real Chromium), E = end to end (three engines), V = screenshot (pinned container), A = axe, M = manual.

### EL-5 Move, resize and rotate
- Given a rectangle at (200, 100), When it is dragged by 300 px right and 50 px down, Then it is at (500, 150) and the drag was one history step. (U geometry and command; E drag with the mouse)
- Given a selected shape, When the corner handle is dragged, Then it resizes about the opposite corner; with Shift it keeps its proportions; an edge handle changes one side only. (U property tests on resize; E)
- Given a selected shape, When the rotation handle is dragged, Then it turns about its centre and the readout shows the angle. (U; E)
- Given a selected shape, When the arrow keys are pressed, Then it moves 1 px per press, or 10 px with Shift. (C, E)
- Given three shapes, When Shift-click or a selection box picks two of them, Then both are selected, and moving, resizing or rotating moves them as one box with their relative layout kept. (U group geometry with properties; C; E)
- Given something is being dragged, When the pointer moves, Then size and position readouts show. (C)
- Not tested by machine: how the drag feels, and handles on a trackpad (M).

### EL-3 Add shapes
- Given the Shape menu, When it opens, Then it lists rectangle, rounded rectangle, ellipse, triangle, line and arrow, each reachable with the keyboard. (C, A)
- Given a chosen shape, When the slide is dragged across, Then that shape is drawn between the two points, is on top and is selected; a click draws a default-size one. (E)
- Given a shape is selected, When fill colour, border colour, width, dash style or corner radius change, Then the canvas updates at once and the choice survives a reload. (C, E, I round trip)
- Given Shift is held while drawing, Then proportions are kept; a line snaps to 15-degree steps. (U snapping; E)
- **A shape can hold text, centred by default: moved to sprint 3 (see "Decisions needed").** Gradient fill is Could and is not built.

### ZO-1 Reorder with commands
- Given any elements and any selection, When Bring to Front, Forward, Backward or Send to Back runs, Then the selected elements keep their relative order. (U property test, the plan's ZO-1 example)
- Given the toolbar, the right-click menu and the keyboard, When each is used, Then each runs the same command. (C, E)
- Given the top element is selected, When the menu opens, Then Front and Forward are disabled; likewise Back and Backward at the bottom. (C)
- Given a new element, When it is added, Then it is on top. (U)
- Shortcuts follow the usual ones (Ctrl+] and Ctrl+[ for forward and backward, with Shift for front and back); UX-2 later lists them all in the cheat sheet.

### TR-1 Fade any element
- Given a selected shape, When the slider or the number field changes, Then the canvas fades live and the value is 0 to 100%. (C, E)
- Given a shape with a fill, a border and (later) text, When opacity is 50%, Then the whole element is 50%, not each part separately. (V screenshot: the first baseline; U that opacity is stored once per element)
- Given a multi-selection, When opacity changes, Then every selected element changes. (C)
- Image transparency already in a PNG or SVG file is respected: **arrives with images in sprint 4 (EL-4)**; the opacity control for text arrives with text in sprint 3.

### SV-7 One tab per deck
- Given a deck open in tab A, When tab B opens it, Then B says "This deck is open in another tab" and cannot edit. (E with two pages in one browser context)
- Given tab B is waiting, When tab A closes, Then B opens the deck by itself, with A's last saved edits. (E)
- Given two different decks, or the library in several tabs, Then nothing is blocked. (E)
- Given a browser with no Web Locks, Then the editor opens as before. (C with the API removed)

## Decisions needed from Peter

1. **Approve this plan.**
2. **Text inside a shape (EL-3's third criterion) moves to sprint 3.** It needs the rich-text editor (EL-1, TipTap), which is sprint 3. Building a throwaway plain-text version first would be thrown away. Everything else in EL-3 is in this sprint. Recommendation: move it, as the first thing sprint 3 does once text exists.
3. **The format panel for shapes is my own design.** The boards show Position and size, Opacity and Arrange, but nothing for fill, border, dash or corner radius. I will build them with the Style Guide's fields and buttons and the design colours as a swatch row (plus a hex field for any other colour), and show you the result at the review; say if you would rather have it drawn first.
4. **One setting for screenshot baselines (decision 13).** Please switch on, in the GitHub repository: Settings, Actions, General, Workflow permissions, "Allow GitHub Actions to create and approve pull requests". It lets the "update screenshots" workflow open a pull request for you to review. Nothing else is needed from you (you offered Docker too: it works as a second route but is not required).
5. **The load is 18 days against 16.** All five stories are Must. If it runs behind, the first thing to give is the first screenshot tests (they would move to sprint 3), not a story. Tell me if you would rather decide differently.

## Decision I am making (technical; Peter can overrule)

18. **One history stack, built on the commands.** Undo and redo (EL-8, sprint 4) will be a list of command results (patches and inverse patches). A drag, a resize, a rotation or a slider drag is previewed on a draft copy and committed as **one** command when it ends, so it is one undo step; typing in a field is one step per field edit; bursts of the same kind of edit within a second (arrow-key nudges, typing) are merged into one step. Nothing in sprint 2 needs the history itself, but the commands are built this way now so EL-8 only adds the list.

## Assumptions to check

- Positions and sizes are in slide pixels (1920 by 1080), may be fractional, and are shown rounded to whole numbers in the panel.
- Rotation is in degrees; a line is a shape of height 0 that is rotated.
- The canvas's handles stay the same size on screen at any zoom (the board's 7 px squares).

## Risks

- **Pointer interaction is the hard part.** Rotating and resizing rotated elements, and group transforms, are easy to get subtly wrong. The maths is kept pure in `model` with property tests, and the end-to-end tests drive a real mouse on all three engines.
- **Drag speed.** The plan has a budget of 60 fps drags with 50 elements (UX-3, sprint 5). The draft-then-commit design and a renderer that updates only changed elements are chosen to meet it, but there is no measurement until sprint 5.
- **Screenshot tests need the pinned container.** The first baselines are made by the workflow and need your review; a mistake there would be accepted as truth, so each baseline pull request lists what each image is meant to show.
- **The Windows-only gap.** Mac-only behaviour (Safari, Cmd shortcuts) stays checked only through Playwright's WebKit (decision 15).

## Manual checks for the review

How dragging, resizing and rotating feel with a mouse and with your trackpad; handles at a very small or very large element; your own Firefox; opening one deck in two tabs; the first screenshot baselines, to confirm they show what is meant.
