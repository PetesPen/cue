# Sprint 8 plan: A complete presenting experience

Status: **approved by Peter on 2026-10-17, together with the plan for sprint 9, and built the same day** (what finished and what stays manual is in `docs/sprint-log.md`) ("I approve"; on the Reconnect banner and the next-slide wording: "Your thoughts are good"). Plans are approved in pairs (rule 9 of `CLAUDE.md`). Stories: PM-3, PM-4, PM-5, PM-6 (all Must), and, proposed, TN-2 and TN-3 pulled forward from sprint 11. There is no gate at the end of this sprint and no review after it: the next review is after sprint 9 (Gate 4 follows sprint 10).

Sprint 7 already built much of what these stories ask for, so this sprint is smaller than its nominal 14 days. What is left is below; the room is used for TN-2 and TN-3 (their board exists and their model is ready since sprint 6), which leaves sprint 11 lighter, and as a buffer for what Gate 3's manual checks find.

## What is already there (sprint 7) and what is left

| Story | Already built in sprint 7 | Left for sprint 8 |
|---|---|---|
| PM-3 Keep both windows in sync | the place (slide, click, blank) goes both ways over a BroadcastChannel; a window that opens asks ("hello") and is told; ending from either window ends both; a presenter view that goes away (browser Back) ends the audience window | the **100 ms** measured by a test; the audience window closed on its own (the presenter view keeps working and offers **Reconnect**); the presenter tab **closed or reloaded** (the audience window notices and closes, or waits for the reload); a reload of either window keeps the place |
| PM-4 Read and resize notes | the notes are shown, at 22 px, in a fixed panel that scrolls | the **draggable divider**, **A− and A+**, and **remembering** both |
| PM-5 Preview what comes next | the preview shows the next click's state, then the next slide, then "End of presentation"; a badge says what the click does | the wording on the board ("Next · Click 2 of 3"), and a test of each case |
| PM-6 Navigate the deck | the keys (arrows, Space, Enter, Backspace, Page keys, Home, End, B, W, a number then Enter, Esc), the navigator, the Jump box, a click on the audience window | **one table of show keys** that feeds the key handler, the shortcut sheet and the tests, and the rest of the tests |

## Outcome at the review

Rehearse a twenty-minute talk of your own without touching the mouse: the two windows stay together within a tenth of a second; close either one and the right thing happens; the notes are the size you want, and stay that way; and a transition can be given a direction and a length, or applied to every slide.

## Approach: five thin slices, in this order

1. **Keeping the windows together** (`present`). Each show window holds a Web Lock named after itself until it dies (SP-1: the one signal that needs no timers and works in a hidden window); the other asks for it, and when it is granted that window is gone. The presenter view then shows a warning banner (the style of States) "The audience window was closed. Reconnect", and Reconnect opens it again from the click and catches it up with "hello". The audience window closes when the presenter view is gone for good, and waits a few seconds first, so a reload of the presenter tab does not close it. The show's place is kept in `sessionStorage` for the tab, so a reload of either window returns to the same place. Where Web Locks are missing, the goodbye message and `window.closed` stand in.
2. **The latency test** (PM-3). A two-page test stamps a key press in the presenter window and the moment the audience window draws the change, on the same machine clock, over many presses; Chromium and Firefox are held to 100 ms, WebKit is reported (as SP-1 found).
3. **Notes** (PM-4). A separator between the slides and the notes that is dragged with the mouse and moved with the arrow keys (an accessible `separator`), A− and A+ with the size shown ("22 px", as on the board), long notes scroll, and both choices are remembered on this browser.
4. **The table of show keys and the last of PM-5 and PM-6** (`present`). One table, like the editor's: each key, its meaning, its group; the key handler, the "Presenting" group of the shortcut sheet and the table tests read it. The next-slide preview's wording is the board's.
5. **TN-2 and TN-3** (`editor`, pulled forward). The Transition tab of the board: Direction (four arrows) for Slide and Push, Duration (0.2 to 3 s, 0.6 by default, the slider of the Animate tab), "Apply to all slides" (one undo step) and "Reset to none". The Preview and the show already play the stored direction and duration.

## Acceptance criteria as examples, and how each is tested

U = unit, C = component (real Chromium), E = end to end (two pages), P = performance, M = manual.

### PM-3 Keep both windows in sync
- Given the two windows, When a key is pressed in one, Then the other draws the change within 100 ms (Chromium and Firefox; WebKit reported). (E, P)
- Given the audience window is closed by hand, Then the presenter view keeps working and says so with Reconnect, and Reconnect opens a window that shows the place the show is at. (E, C)
- Given the presenter tab is closed, Then the audience window closes; given it is reloaded, Then the audience window waits, and the show goes on from the same place. (E)
- Given the show is ended from either window, Then both end and the editor is back as it was left (from sprint 7). (E)

### PM-4 Read and resize notes
- Given the divider, When it is dragged or moved with the arrow keys, Then the notes panel grows or shrinks against the slides, within limits, and the view reflows. (C, E)
- Given A+ and A−, Then the notes text scales in steps of 2 px, from 14 to 40, independent of the panel. (C)
- Given long notes, Then they scroll inside the panel and the rest of the view stays put. (C)
- Given the panel and the text size changed, When a new show starts, Then they are as they were left. (C, E)

### PM-5 Preview what comes next
- Given clicks remain, Then the preview shows the state after the next click and says "Next · Click 2 of 3"; given none remain, Then it shows the next slide as it opens, and on the last slide "End of presentation". (C)

### PM-6 Navigate the deck
- Given the table of keys, Then every key does what the table says in either window, and the sheet lists the same keys. (U table tests, C, E)
- Given a click on the audience window in full screen, Then it goes forward; given the navigator or the Jump box, Then the slide is shown as it opens. (C)

### TN-2 and TN-3 (pulled forward)
- Given Slide or Push, When a direction is chosen, Then the preview and the show bring the slide in from that side; given Fade, Zoom or None, Then there is no direction control. (C, E)
- Given the duration slider, Then it runs from 0.2 to 3 s in tenths and the transition lasts that long. (C, U)
- Given "Apply to all slides", Then every slide but the first has this transition, direction and duration, in one undo step; "Reset to none" does the opposite for this slide. (U, C)

## Decisions needed from Peter

1. **Approve this plan**, including TN-2 and TN-3 moving from sprint 11 to here (sprint 11 keeps layers, TR-2 and AN-7; sprint 12 is unchanged).
2. **The Reconnect banner** is not on any board. I would show it under the top bar of the presenter view in the warning style of the States board. Is that right?
3. **The next-slide wording.** PM-5 says "Next: step 2 of 3" and the Presenter board says "Next · Click 2". I would follow the board and add "of 3". Is that right?

## Decisions I am making (technical; Peter can overrule)

32. **"Is that window gone" is a Web Lock** held by each show window (`cue-show:<deck>:<role>`), as SP-1 recommended; the goodbye message and `window.closed` are the fallback.
33. **The show's place is kept in `sessionStorage`** (this tab only), so a reload of either window returns to the same place; nothing about a show is written to the deck.
34. **The notes panel's size and text size are remembered in `localStorage`** on this browser, not per deck.
35. **One table of show keys**, read by the handler, the sheet and the tests, so they cannot disagree (as for the editor's shortcuts, UX-2).

## Risks

- **Closing detection differs by engine** (SP-1: in WebKit, Playwright's `page.close()` does not destroy the page): the tests close the windows from inside the page where they must, and the real browsers stay on the manual list.
- **A reload is not a close.** The audience window waits a few seconds for the presenter lock to return; the wait is a number to tune with real use.
- **A latency test can be spoiled by a busy runner**: it takes the median and a high percentile of many presses and is retried once in CI, like the frame budgets.

## Manual checks for the next review

Closing and reloading each window in real Chrome, Edge, Firefox and Safari; Reconnect on a real second display; dragging the divider with a trackpad; notes at several sizes on your laptop; a twenty-minute talk.
