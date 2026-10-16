# Sprint 7 plan: Transitions and the two windows

Status: **waits for Peter's approval** (sprint 7 is approved alone; its review is Gate 3, "Motion beta"). Stories: TN-4, TN-5, PM-1, PM-2 (all Must). Nominal load 14 days. Built on sprints 5 and 6: the resolver and the motion player play every click, the Transition tab chooses how each slide arrives, and the fixture deck's hero slide has its steps and transitions.

## Outcome at the review (Gate 3)

Preview a slide's transition in the editor, then press Present: an audience window opens (a plain slide, fullscreen on request, nothing else), this tab turns into the presenter view (the slide, what comes next, the notes, a navigator, the elapsed time and the clock), and you step through the whole deck by keyboard with every animation and transition playing, in both windows, until you end the show and the editor is back exactly as you left it.

## Approach: six thin slices, in this order

1. **The show, as data** (`model`). A small pure description of where a show is: the slide, the click on it, and whether the screen is blanked; and the moves between places: forward one click or slide, back one, jump to a slide, jump to the start or the end. It is built on `clickCount` and the resolver, so "the next step of this slide, then the next slide" is one tested function. Table tests for every move at the edges (the first slide, the last click, an empty slide, a deck of one slide).
2. **Transitions** (`render`, the motion player). The player gains a slide-to-slide play: the outgoing slide and the incoming one are two layers of the shared renderer; Fade crosses them, Slide brings the new one in from its side over the old, Push moves both, Zoom grows the new one from the old one's middle. Only `transform` and `opacity` (SP-4); the incoming slide is drawn in its state before its first click and its own animations start when the transition has finished (TN-5). Going back plays the same transition reversed, and a plain fade where reversing makes no sense (Zoom, a Slide into the first slide). As in sprint 5, the end state is drawn first and an animation only shows the way there, so an interrupted transition (a quick second key press) always lands exactly.
3. **TN-4 Preview a transition** (`editor`). The bar of the Editor-Transition board ("Slide 2 → Slide 3", Preview transition) under the canvas: plays the previous slide into the selected one in place; the first slide's panel already says it has none (sprint 6).
4. **The audience window and the show window** (`present`, a new module; `editor` does not import it). Two routes: the audience (a slide scaled to fit with black bars, no controls, no cursor, the hint "Esc to end the show" that fades after three seconds) and the presenter view (the Presenter board). A show starts at slide 1 (Present) or at the slide you are on (Present from current slide); the top bar gains the green Present button as on the boards. Both windows draw from the stored deck with the shared renderer and the motion player, so what the audience sees is what Preview showed.
5. **Opening the windows** (PM-1, Option B, decision 10). One click opens only the audience window with `window.open`; the editor tab itself turns into the presenter view and returns to the editor when the show ends. If the browser blocks the window, the card of the States board (reworded to "audience window", decision 13) explains how to allow it and offers "Present in one window": the show runs in this tab, full screen, without notes. Fullscreen is asked for from the Present click where the browser allows it, and the audience window shows its "click or press F" hint otherwise; where the Window Management API exists (Chromium), the audience window opens on the second display after the browser's permission prompt.
6. **Keeping the two windows together** (`present`, the first half of PM-3). A BroadcastChannel carries only the show's place (slide, click, blank), as the stack says; each window renders from the stored deck. This slice makes the windows useful together; its measured limit (100 ms), the hello and catch-up, the Web Locks "is that window gone" signal and the reconnect action are sprint 8 (PM-3).

## Acceptance criteria as examples, and how each is tested

U = unit, C = component (real Chromium), E = end to end (a test with two pages), P = performance (nightly), V = screenshot, A = axe, M = manual.

### TN-4 Preview a transition
- Given slide 3 with Slide chosen, When Preview transition is pressed, Then slide 2 is replaced by slide 3 coming in from the right, and the canvas ends on slide 3. (C, E)
- Given the first slide, When the Transition tab is open, Then it says there is no incoming transition and the bar offers no preview (built in sprint 6 for the panel). (C)

### TN-5 Transitions play smoothly
- Given each of Fade, Slide, Push and Zoom, When it plays, Then only `opacity` and `transform` change, and at the end the incoming slide is exactly what a plain draw of it gives. (C, U on the plays)
- Given a slide with steps, When the show moves to it, Then none of its steps plays until the transition has finished. (C, E)
- Given a transition and the press of the key that goes back, Then the same transition plays reversed, or a plain fade for Zoom. (C)
- Given the fixture's busiest slides, When a transition plays on the nightly runner, Then Chromium and Firefox keep at most 5% of frames late (the SP-4 budget); a heavy slide is checked against its own baseline. Zoom keeps its own budget, since SP-4 found it the most expensive. (P)
- 60 fps on a real laptop and a Mac stays a manual check. (M)

### PM-1 Start a presentation
- Given the editor, When Present is pressed, Then the show starts at slide 1; with Present from current slide, at the slide shown. (E)
- Given a click on Present, Then an audience window opens, this tab becomes the presenter view, and ending the show (Esc, End show) closes the audience window and returns this tab to the editor with the same slide, selection and tab open. (E with two pages)
- Given a browser that blocks the window (the pop-up path), Then the card says how to allow it, and "Present in one window" runs the show here without notes. (E with the pop-up blocked, C on the card)
- Given the audience window, Then it fills the screen with the slide scaled to fit and black bars, never cropped. (C at several sizes, V)
- Given a second display and the Window Management API, Then the audience window opens on it; without them the user drags the window and presses F. (M)

### PM-2 Present from the presenter view
- Given a show, Then the presenter view shows the current slide, the next slide (or "End of presentation"), the notes of the current slide, a navigator of every slide, the elapsed time and the time of day. (C, E, A)
- Given the audience window, Then it shows only the current slide: no controls, no cursor. (C, E)
- Given the keys Right, Space and Enter, Left and Backspace, B and Esc, Then the show steps forward and back through clicks and slides, blanks and ends. (E; the full navigation table is PM-6, sprint 8)

## Decisions needed from Peter

1. **Approve this plan.**
2. **Gate 3 criteria** (below, in `docs/development-plan.md`; written by me, you can change them).
3. **Keys that finish a show.** Esc ends the show from either window (the Audience board says so). Say if it should ask first when a show is mid-way.

## Decisions I am making (technical; Peter can overrule)

29. **The audience window is a route of the same app**, `#/show/<deck>/audience`, so it uses the same code, fonts and renderer and needs no second build; the presenter view is the editor tab in a different state (a route too), so ending the show is a route change and the editor is exactly as it was left.
30. **A show reads the stored deck.** A change made in the editor cannot happen during a show (the tab is the presenter view), so each window loads the deck once when the show starts and holds it for the whole show.
31. **A transition plays from two layers, not from a picture of the old slide.** SP-4 held the picture back as a fallback; it is only needed if real laptops struggle, which the nightly run and your machine will show.

## Assumptions to check

- Present sits at the right of the top bar as on the Main board; "Present from current slide" is in a small menu beside it and on Ctrl/⌘ Shift Enter. Ctrl/⌘ Enter starts from the beginning (the Shortcuts board); both appear on the shortcut sheet once they work.
- A show of a deck with unreadable or missing pictures still starts; the picture area is blank, as in the editor.
- No sound, no laser pointer (PM-8 is after v1.0).

## Risks

- **Two windows are the plan's second-highest risk** (SP-1): the pop-up blocker (hence Option B), fullscreen needing a user action, and the second display needing a Chromium-only API and a permission. Real Safari and a real projector are untested and need you or a Mac.
- **Transitions at 60 fps** on a populated slide: SP-4 found Chromium without a graphics card slow on a heavy zoom; the budget treats Zoom separately and the nightly run reports each kind.
- **A test of two windows** needs two pages in one browser context with `window.open`; the pop-up blocker is not enforced by Playwright's own Chromium (SP-1), so the blocked path is tested by making `window.open` return nothing, and checked by hand in real Chrome, Edge and Firefox.

## Manual checks for the review

A real second display and a projector; fullscreen in each browser; the audience window on the second display (Chrome, Edge); how each transition feels; 60 fps on your laptop and a Mac; a three-slide talk from start to finish.

## Gate 3 criteria (proposed)

"Do animations, transitions and the two windows work well enough to try a real talk?"

1. Every acceptance criterion of sprints 5 to 7 is shown working on the preview deployment, with its tests green on Chromium, Firefox and WebKit.
2. The fixture deck Autumn Launch is presented from the first slide to the last in two windows by an end-to-end test: its hero slide plays its three clicks (the picture and the rows, the circle moving, the block leaving), slides arrive with their transitions, and Esc returns the editor as it was.
3. Nothing is lost: a show never changes the deck; ending a show, closing the audience window or the browser during one leaves the deck as it was.
4. Accessibility and budgets hold: axe finds nothing on the presenter view, the audience window and the transition bar; first load inside 300 KB; the transition frame budgets met on the nightly run.
5. You present a short talk of your own from the live app in two windows, on your own machine, and say whether you would try a real one (manual).
