# Slides Web App: User Stories

> Exported from the Claude document of 2026-10-14. This file is the working copy now: edit it here as the plan changes.

2026-10-14 · Peter Alexander

## Overview

A sleek, local-first web app where one presenter builds 16:9 decks, animates them click by click, and presents from two synced windows. There are no accounts and no server: decks live in the browser and leave it as a deck file or a standalone HTML page.

**Persona.** The presenter: one person who creates, edits, exports and delivers a deck.

**Story format.** Each story reads "As a presenter, I want…, so that…", followed by acceptance criteria. IDs group stories by area, and each carries a priority: **Must** (core to the brief), **Should** (expected, ships in v1) or **Could** (nice to have, cut first).

**Confirmed decisions**

- Storage is local only: browser storage, no accounts, no sharing links.
- Export is a proprietary deck file (re-importable) plus a standalone HTML presentation.
- Transparency applies to every element: images, shapes and text.
- Text is rich: mixed formatting within a box, and a choice of fonts.
- Slides are 16:9 only. Themes and templates are included only if they are easy.
- Animations run click by click: one step per click, in a set order.
- No technology preference, so the build choice is a suggestion (see the last section).

## Slides

The deck is a vertical thumbnail sidebar next to a single large editing canvas.

**SL-1 Add a slide (Must).** As a presenter, I want to add a new slide after the current one, so that I can build my deck in order.

- A visible "+" button and the shortcut Ctrl/Cmd+M add a blank 16:9 slide directly after the selected slide.
- The new slide is selected and ready to edit immediately.
- A new deck starts with one blank slide.

**SL-2 Navigate between slides (Must).** As a presenter, I want to click a thumbnail to open a slide, so that I can jump around quickly.

- The sidebar shows a live thumbnail of every slide with its number.
- The current slide is clearly highlighted.
- Up and Down arrows move the selection when the sidebar has focus.

**SL-3 Reorder slides (Must).** As a presenter, I want to drag thumbnails into a new order, so that I can restructure the story.

- A drop indicator shows where the slide will land.
- Slide numbers update immediately.
- Reordering can be undone.

**SL-4 Duplicate and delete slides (Must).** As a presenter, I want to duplicate or delete a slide, so that I can reuse and tidy up.

- Right-click and keyboard shortcuts offer Duplicate and Delete.
- A duplicate copies every element, animation, transition and note, and appears right after the original.
- Deleting the only remaining slide leaves a blank slide rather than an empty deck.
- Delete can be undone.

**SL-5 Set a slide background (Should).** As a presenter, I want to set a background colour or image, so that slides can have their own look.

- Choose a solid colour or an image, with an optional opacity.
- "Apply to all slides" is available.

**SL-6 Add speaker notes (Must).** As a presenter, I want a notes field under each slide, so that I can prepare what to say.

- Notes are plain or lightly formatted text, saved with the slide.
- Notes appear in the presenter view (see Presentation mode).

## Text, shapes and images

Every item on a slide is an element with a position, size, rotation, opacity and layer order.

**EL-1 Add rich text (Must).** As a presenter, I want to add a text box and format parts of it independently, so that my text has emphasis and structure.

- A toolbar button and the shortcut T add a text box; double-click to edit in place.
- Within one box I can mix bold, italic, underline, strikethrough, colour, size and font on selected text.
- Paragraph options: alignment, bullet and numbered lists, indent level and line spacing.
- Text boxes can have a fill, border and padding.
- Pasting from other apps keeps basic formatting but drops unsupported styles.

**EL-2 Choose fonts (Must).** As a presenter, I want to pick from a good set of fonts, so that decks look distinctive.

- A font picker previews each font in its own typeface and shows recently used fonts first.
- A curated set of web fonts is bundled with the app so decks look the same on every machine.
- Fonts are embedded in HTML exports so the presentation renders correctly offline.
- The italic button is hidden for fonts that have no italic design (Bricolage Grotesque, Space Grotesk and Caveat), so the editor never shows a browser-made slant that could differ in the export. Only Latin text is bundled; other characters fall back to the computer's own font (decided by Peter, 2026-10-14).

**EL-3 Add shapes (Must).** As a presenter, I want to insert and style shapes, so that I can build diagrams and visual structure.

- Available shapes: rectangle, rounded rectangle, ellipse, triangle, line and arrow.
- Style controls: fill colour, gradient (Could), border colour, width and dash style, and corner radius.
- A shape can hold text, centred by default.
- Holding Shift while dragging keeps proportions; lines snap to 15° steps.

**EL-4 Add images (Must).** As a presenter, I want to bring in images by upload, drag and drop or paste, so that adding pictures is effortless.

- PNG, JPEG, GIF, SVG and WebP are accepted.
- Images keep their aspect ratio by default and are scaled to fit the slide on insert.
- Large images are downscaled on import to protect local storage, with the original resolution kept for export where space allows.
- A friendly message appears if an image cannot be read or storage is full.

**EL-5 Move, resize and rotate (Must).** As a presenter, I want direct-manipulation handles, so that layout feels natural.

- Drag to move; corner and edge handles resize; a rotation handle turns the element.
- Arrow keys nudge by 1 px, and Shift+arrow by 10 px.
- Multi-select with Shift-click or a drag-selection box; the group moves, resizes and rotates together.
- Dragging shows size and position readouts.

**EL-6 Align and snap (Should).** As a presenter, I want smart guides and alignment tools, so that slides look tidy without effort.

- Elements snap to slide edges, slide centre and other elements, with visible guide lines.
- Align left, centre, right, top, middle and bottom for a selection.
- Distribute horizontally and vertically for three or more elements.

**EL-7 Copy, paste and delete (Must).** As a presenter, I want standard clipboard actions, so that I can reuse elements.

- Cut, copy, paste, duplicate and delete work on selections, including across slides.
- Pasted elements keep their formatting and appear slightly offset.

**EL-8 Undo and redo (Must).** As a presenter, I want unlimited undo and redo, so that I can experiment safely.

- Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo any edit, including slide-level changes.
- Dragging, resizing and typing bursts each count as a single step.
- History survives switching slides but resets when the deck is closed.

**EL-9 Group elements (Could).** As a presenter, I want to group elements, so that I can move and animate them as one.

- Group and ungroup via shortcut and menu.
- A group behaves as a single element for z-order, opacity and animation.

## Z-order

Elements stack within a slide, with the last in the list drawn on top.

**ZO-1 Reorder with commands (Must).** As a presenter, I want to move an element up or down the stack, so that I can control what covers what.

- Bring to Front, Bring Forward, Send Backward and Send to Back are in the toolbar, the right-click menu and keyboard shortcuts.
- The command works on a multi-selection and preserves the relative order of the selected elements.
- Commands that would have no effect (already at the front, say) are disabled.
- New elements are added on top.

**ZO-2 See and rearrange layers (Should).** As a presenter, I want a layers panel, so that I can select and reorder elements that are hidden behind others.

- The panel lists every element on the slide, top layer first, with a small preview and a name.
- Drag a row to change its stacking position; the canvas updates live.
- Clicking a row selects the element on the canvas, and selecting on the canvas highlights the row.

**ZO-3 Lock, hide and rename layers (Should).** As a presenter, I want to lock, hide and name elements, so that a busy slide stays manageable.

- A locked element cannot be moved or edited by accident, but can still be selected from the panel.
- A hidden element is invisible in both the editor and presentation mode, and can be shown again from the panel.
- Double-click a layer name to rename it; names also label animation steps.

## Transparency

Opacity is a property of every element, from 0% (invisible) to 100% (solid).

**TR-1 Fade any element (Must).** As a presenter, I want an opacity control for images, shapes and text, so that I can layer content and create subtle effects.

- A slider with a numeric field (0–100%) appears in the format panel for every element type.
- The canvas updates live while the slider is dragged.
- Opacity applies to the whole element, including its fill, border and text, and to a whole group.
- Image transparency also respects PNG and SVG transparency already in the file.

**TR-2 Control fill and text transparency separately (Should).** As a presenter, I want separate opacity for a shape's fill, border and text, so that I can have a see-through panel with fully solid text.

- Fill, border and text colour pickers each include an alpha slider.
- Element opacity and colour alpha multiply together, and the format panel shows the result.

**TR-3 Transparency in animation and export (Must).** As a presenter, I want opacity to behave the same everywhere, so that what I design is what the audience sees.

- Presentation mode and HTML export render opacity identically to the editor.
- Appear and Disappear animations respect an element's set opacity as their "fully visible" level.

## Animations

Animations are an ordered list of steps per slide. Each click in presentation mode plays the next step, then moves to the next slide when none remain.

**AN-1 Make an element appear (Must).** As a presenter, I want an element to fade or pop into view on a click, so that I can reveal content one point at a time.

- Select an element and choose Appear in the animation panel; it is hidden until its step plays.
- Appear options: instant, fade, or fade with a slight rise.
- Elements with an Appear step are shown faded in the editor, with a step badge on the canvas.

**AN-2 Make an element disappear (Must).** As a presenter, I want an element to leave on a click, so that I can clear the stage for what comes next.

- Disappear options: instant or fade out.
- An element can have both an Appear and a later Disappear step.

**AN-3 Move an element (Must).** As a presenter, I want to animate an element from one position to another, so that I can show change, flow and emphasis.

- Move shows a ghost of the end position that I drag into place on the canvas, with a dotted path from start to end.
- Move animates position only; optional resize and rotation changes are Could.
- The element ends at the new position, and stays there for later steps.

**AN-4 Control timing and feel (Should).** As a presenter, I want duration, delay and easing, so that motion feels deliberate.

- Duration from 0.1 to 5 seconds and delay from 0 to 5 seconds.
- Easing presets: linear, ease-in, ease-out and ease-in-out.
- Sensible defaults (0.5 s, ease-out) mean most steps need no tuning.

**AN-5 Sequence steps click by click (Must).** As a presenter, I want to order animations and group some to play together, so that I control the pace of a reveal.

- The animation panel lists steps in play order, each showing its element and effect.
- Drag steps to reorder them.
- Each step is set to "On click" or "With previous", so several elements can animate on a single click.
- Removing an element removes its steps.

**AN-6 Preview animations (Must).** As a presenter, I want to preview a slide's animations without leaving the editor, so that I can fine-tune them quickly.

- A Preview button plays the slide's steps in the editor, and clicking advances step by step.
- After a preview, every element returns to its editing position.

**AN-7 Go back a step (Should).** As a presenter, I want to step backward during a show, so that I can recover from a misclick or revisit a point.

- The Left arrow or Backspace reverses the last animation step, then returns to the previous slide's final state.

## Transitions

A transition plays when the show moves from one slide to the next, and belongs to the incoming slide.

**TN-1 Choose a transition (Must).** As a presenter, I want to pick how a slide arrives, so that moving between slides feels polished.

- Options: None, Fade, Slide (from the right), Push, and Zoom.
- The choice is made in a transition panel for the selected slide, and shown as a small badge on its thumbnail.
- The default is None.

**TN-2 Set duration and direction (Should).** As a presenter, I want to adjust how long a transition takes and which way it moves, so that it suits the moment.

- Duration from 0.2 to 3 seconds, defaulting to 0.6 seconds.
- Slide and Push can come from the left, right, top or bottom.

**TN-3 Apply to all slides (Should).** As a presenter, I want to apply one transition to the whole deck, so that I do not have to set it slide by slide.

- An "Apply to all slides" button copies the transition settings to every slide.
- It can be undone in one step.

**TN-4 Preview a transition (Must).** As a presenter, I want to preview a transition in the editor, so that I can judge it before presenting.

- A Preview button plays the transition from the previous slide into the selected one.
- The first slide has no incoming transition, and its panel says so.

**TN-5 Transitions play smoothly (Must).** As a presenter, I want transitions without stutter, so that the show looks professional.

- Transitions run at 60 fps on a typical laptop with a fully populated slide.
- Animations that belong to the new slide only begin once the transition finishes.
- Moving backward plays the same transition in reverse, or a plain fade if reversing does not make sense.

## Presentation mode

Starting a show opens two browser windows: an audience window for the projector and a presenter window for the speaker. They stay in sync, and either one can drive.

**PM-1 Start a presentation (Must).** As a presenter, I want to start a show from any slide, so that I can rehearse a section or deliver the whole deck.

- "Present" starts from slide 1, and "Present from current slide" starts where I am.
- One click opens both windows; if the browser blocks the second window, a clear prompt explains how to allow it.
- The audience window goes fullscreen, and slides scale to fit with letterboxing so they are never cropped.
- Where the browser allows it, the audience window opens on the second display and the presenter view stays on the laptop.

**PM-2 Present from the presenter view (Must).** As a presenter, I want a private control view, so that I can see everything I need while the audience sees only the slide.

- The presenter view shows the current slide, a next-slide preview, speaker notes, a slide navigator, an elapsed timer and the current time.
- The audience window shows only the current slide, with no controls or cursor.

**PM-3 Keep both windows in sync (Must).** As a presenter, I want both windows to show the same moment, so that the audience never sees a mismatch.

- Slide changes and animation steps made in either window appear in the other within 100 ms.
- If one window is closed, the other keeps working, and a "reconnect" action reopens the second window.
- Ending the show from either window closes both.

**PM-4 Read and resize notes (Must).** As a presenter, I want to read my notes in a panel I can resize, so that I can fit the text to my eyes and screen.

- A draggable divider resizes the notes panel against the slide previews, and the presenter view reflows smoothly.
- A text size control (A− and A+) scales the notes independently of the panel size.
- Long notes scroll within the panel.
- The panel size and text size are remembered between shows.

**PM-5 Preview what comes next (Must).** As a presenter, I want to see the next slide, so that I can prepare my next line before I click.

- The next-slide preview shows the following slide in its starting state.
- When animation steps remain on the current slide, the preview shows the next step instead and says so ("Next: step 2 of 3").
- On the last slide, the preview reads "End of presentation".

**PM-6 Navigate the deck (Must).** As a presenter, I want to move around the show quickly, so that I can respond to questions.

- Right arrow, Space, Enter and click advance by one animation step, then to the next slide.
- Left arrow and Backspace go back one step.
- A scrolling slide navigator in the presenter view lets me click any slide to jump to it.
- Typing a slide number then Enter jumps to that slide.
- B blanks the audience window to black, and W to white, until pressed again.
- Esc ends the show.

**PM-7 Time my talk (Should).** As a presenter, I want a timer, so that I stay on schedule.

- The timer starts with the first advance, and can be paused and reset.
- An optional target duration turns the timer amber at 90% and red when exceeded.

**PM-8 Show a pointer (Could).** As a presenter, I want a laser-pointer mode, so that I can draw attention to a detail.

- Pressing L toggles a pointer dot, and my cursor movement in the presenter view's slide area appears on the audience window.

## Saving and export

Decks are stored in the browser. Files are how a deck is backed up, moved to another computer or shared.

**SV-1 Autosave locally (Must).** As a presenter, I want my work saved continuously, so that I never lose a deck to a closed tab.

- Changes save within 2 seconds of the last edit, with a quiet "Saved" indicator.
- Reopening the app restores the deck exactly as left, including images.
- Storage uses the browser's database storage, not the small key-value store, so image-heavy decks fit.
- If storage is nearly full, a warning explains the problem and offers to export the deck.

**SV-2 Manage multiple decks (Must).** As a presenter, I want a home screen of my decks, so that I can work on more than one presentation.

- The home screen lists decks with a thumbnail, title and last-edited date, newest first.
- I can create, rename, duplicate and delete a deck; delete asks for confirmation.
- Titles can be edited inline in the editor header.

**SV-3 Save and open a deck file (Must).** As a presenter, I want to save a deck to a file and open it again, so that I can back it up and move it between computers.

- "Save as file" downloads a single self-contained file in the app's own format, with images and fonts included.
- Opening the file recreates the deck exactly, including animations, transitions and notes.
- Files from a newer version of the app open with a clear message if some features are unsupported.
- A corrupt or foreign file is rejected with a clear message and nothing is overwritten.

**SV-4 Export to HTML (Must).** As a presenter, I want to export a deck as one HTML file, so that I can present from any browser without the editor.

- The exported file works offline with no external requests, and includes all images and fonts.
- It supports 16:9 scaling, keyboard navigation, animations, transitions and transparency exactly as in the editor.
- It includes a simple presenter mode with notes, and the same keyboard shortcuts as the app.
- A deck of 30 slides with images exports in under 10 seconds.

**SV-5 Import and export fidelity (Should).** As a presenter, I want exported decks to look identical to my slides, so that surprises never happen on show day.

- Text wrapping, fonts, positions and layering match the editor to within one pixel at 1920 × 1080.
- Export and import round-trip: opening a saved deck file and exporting it again yields the same deck.

**SV-6 Export as PDF or images (Could).** As a presenter, I want a printable copy, so that I can hand out slides.

- Use the browser's print dialog with a one-slide-per-page layout, or export PNG images.

## Themes and templates (stretch)

These are included only if they stay simple. A theme is a small set of colours and fonts; a template is a starter deck.

**TH-1 Pick a theme (Could).** As a presenter, I want to apply a ready-made theme, so that my deck looks consistent without design effort.

- Four to six themes, each a palette of colours plus a heading font and a body font.
- Choosing a theme restyles new text and shapes, and offers to restyle existing ones.
- Colour pickers show the theme palette first.

**TH-2 Start from a template (Could).** As a presenter, I want to begin from a starter deck, so that I am not facing a blank slide.

- The new-deck screen offers Blank plus a few starters, such as Title and content, Section divider and Image feature.
- A starter is a normal deck with placeholder text that can be freely edited.

**TH-3 Reuse my own slide layouts (Could).** As a presenter, I want to save a slide as a reusable layout, so that repeated designs are quick.

- "Save as layout" stores the slide's structure, and the add-slide menu lists my layouts.

## Look, feel and quality

The app should feel calm and fast: the slide is the hero and the interface stays out of the way.

**UX-1 A sleek, uncluttered editor (Must).** As a presenter, I want a clean interface, so that I can focus on my content.

- Layout: thumbnail sidebar on the left, canvas in the centre, and a context-sensitive format panel on the right that shows only what applies to the selection.
- A slim top toolbar holds the core actions; everything else lives in menus or the right-click menu.
- A restrained palette, generous spacing, one typeface for the interface, and subtle motion.
- Light and dark interface modes follow the system setting; the slide itself is never affected.

**UX-2 Fast, keyboard-first work (Must).** As a presenter, I want shortcuts for common actions, so that I can work efficiently.

- Shortcuts exist for add slide, text, shapes, z-order, duplicate, undo, redo, present and save.
- A "?" key opens a shortcut cheat sheet.
- Every toolbar tooltip shows its shortcut.

**UX-3 Responsive performance (Must).** As a presenter, I want the editor to stay smooth, so that it never gets in my way.

- Dragging and resizing elements holds 60 fps on slides with up to 50 elements.
- A deck of 50 slides opens in under 2 seconds.
- Thumbnails update without blocking typing.

**UX-4 Zoom and fit (Should).** As a presenter, I want to zoom the canvas, so that I can do detailed work.

- "Fit to window" is the default and re-fits when the window resizes.
- Zoom in and out with the shortcuts, the pinch gesture or a zoom control, with a reset to fit.

**UX-5 Works in modern browsers (Must).** As a presenter, I want it to run in my browser, so that I can use it anywhere without installing anything.

- Supported: current versions of Chrome, Edge, Firefox and Safari on desktop.
- Presentation mode's two-window behaviour is tested in all four, with any browser-specific limits explained in the app.
- Phone-sized screens show a friendly "use a larger screen to edit" message, though HTML exports play on any device.

**UX-6 Accessible by default (Should).** As a presenter, I want the app to be usable with a keyboard and readable by everyone, so that nobody is excluded.

- All controls are reachable by keyboard with visible focus.
- Interface text meets WCAG AA contrast.
- Images can have alt text, which is carried into the HTML export.

**UX-7 Install and work offline (Must).** As a presenter, I want to install Cue and open it with no internet connection, so that I can build and present anywhere, including a venue with no Wi-Fi.

- After one visit, the app opens and my decks load with the network switched off.
- Where the browser supports installing, a clear "Install" action adds Cue as an app with its own window and icon. Where it does not, no install prompt shows and the app works in a tab.
- A new version waits until I choose to update, never replaces the app while I am editing, and never touches my stored decks.
- Starting a show from the installed app opens both windows and keeps them in sync, or explains any browser-specific limit.
- The app makes requests only to its own files.

Added 2026-10-14 at Peter's request. Priority Must is proposed: Peter can change it.

## Scope, assumptions and build order

Build the editor first, then motion, then presenting and export, so there is something usable at each step.

| Phase | Goal | Stories |
|---|---|---|
| 1. Editor core | Build and save a deck of text, shapes and images | SL-1 to SL-4, SL-6, EL-1 to EL-5, EL-7, EL-8, ZO-1, TR-1, SV-1, SV-2, UX-1 to UX-3 |
| 2. Motion | Animate elements and move between slides | AN-1 to AN-3, AN-5, AN-6, TN-1, TN-4, TN-5, TR-3 |
| 3. Present and export | Deliver the show in two windows and take the deck with me | PM-1 to PM-6, SV-3, SV-4, UX-5, UX-7 |
| 4. Polish | Everything marked Should | SL-5, EL-6, ZO-2, ZO-3, TR-2, AN-4, AN-7, TN-2, TN-3, PM-7, SV-5, UX-4, UX-6 |
| 5. Stretch | Everything marked Could, cut first | EL-9, PM-8, SV-6, TH-1 to TH-3 |

**Assumptions**

- One person uses the app in one browser. Clearing the browser's site data deletes decks, so the app reminds me to export a backup.
- Both presentation windows run on the same computer and browser. Presenting from two separate machines is not supported.
- Fonts come from a bundled set, not from fonts installed on my computer, so decks look the same everywhere.
- Animations are straight-line moves and simple fades. Looping, paths and per-letter effects are not included.

**Out of scope for v1**

- Accounts, cloud storage, sharing links and live collaboration.
- PowerPoint (.pptx) import and export.
- Audio, video, charts, tables and comments.
- Aspect ratios other than 16:9, and editing on a phone.

**Suggested build.** A single-page web app (TypeScript with React) that draws each slide as DOM elements, so the editor, the presentation and the HTML export share one renderer. Decks are stored in IndexedDB, window sync uses the BroadcastChannel API, and rich text uses an established editor library such as TipTap rather than a custom one. The deck file is one self-describing archive holding the deck data, images and fonts.

**Open questions**

- Is a presenter-only view on a second device (a phone as a remote) worth planning for later?
- Do charts or tables belong in a later version?
