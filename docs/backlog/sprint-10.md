# Sprint 10: Standalone HTML

- Capacity: 12 engineering days (2 engineers, about 80% focus, 2 weeks)
- Ends with Gate 4: First full show, all 39 Must stories (end of sprint 10)
- Next: [sprint-11.md](sprint-11.md) · Previous: [sprint-09.md](sprint-09.md)

Work only on this sprint's goal. New ideas go to the backlog, not into the sprint (see `CLAUDE.md`). Tick the boxes as criteria are shown working on the preview deployment.

## Goal

Standalone HTML.

## Demo at the review

Present from one offline HTML file that matches the editor.

## Key automated tests

No-network export test; three-renderer pixel comparison; 30-slide timing.

## Stories (2, and 1 proposed)

1 Must, 1 Should, and SV-8 (Should) if Peter agrees with the plan. Story order below is the suggested build order.

### SV-4 Export to HTML (Must)

As a presenter, I want to export a deck as one HTML file, so that I can present from any browser without the editor.

Acceptance criteria:
- [ ] The exported file works offline with no external requests, and includes all images and fonts.
- [ ] It supports 16:9 scaling, keyboard navigation, animations, transitions and transparency exactly as in the editor.
- [ ] It includes a simple presenter mode with notes, and the same keyboard shortcuts as the app.
- [ ] A deck of 30 slides with images exports in under 10 seconds.

Design: [`Export-Dialog`](../../design/screenshots/Export-Dialog.png) ([source](../../design/boards/Export-Dialog.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. At least one end-to-end test is required (Must story).

### SV-5 Import and export fidelity (Should)

As a presenter, I want exported decks to look identical to my slides, so that surprises never happen on show day.

Acceptance criteria:
- [ ] Text wrapping, fonts, positions and layering match the editor to within one pixel at 1920 × 1080.
- [ ] Export and import round-trip: opening a saved deck file and exporting it again yields the same deck.

Design: [`Export-Dialog`](../../design/screenshots/Export-Dialog.png) ([source](../../design/boards/Export-Dialog.dc.html))

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name. Push tests down the pyramid where possible.

### SV-8 Back up all decks (Should; proposed for this sprint, Peter decides with the plan)

As a presenter, I want to back up every deck in one step and be reminded when I have not, so that clearing the browser's data never costs me my work.

Added 2026-10-17 at Peter's request (his answer to the sprint 9 review's first question). The plan is [`docs/plans/sprint-10.md`](../plans/sprint-10.md); it would come after SV-4 and SV-5 and is the first thing cut if the sprint runs over.

Acceptance criteria:
- [ ] "Back up all decks" saves one file that holds every deck with its pictures, animations, transitions, notes and fonts, and says how many decks it holds and how large it is. It works while saving is failing, and it never changes a deck.
- [ ] Opening that file in Cue adds every deck in it as a new deck and never replaces one; a deck in it that cannot be read is named, and the others are still added.
- [ ] The Home board shows the reminder ("It has been N days since your last backup…") when a deck has changed since it was last saved to a file and that file is 14 days old or more (a deck never saved to a file counts from the day it was made). A backup or a single-deck export counts as saving. Nothing has changed, nothing to say.
- [ ] The reminder's Back up all decks button makes the backup; its close button hides the reminder for 14 days.

Design: [`Home`](../../design/screenshots/Home.png) ([source](../../design/boards/Home.dc.html)) (the reminder banner).

Tests: write each criterion as a Given / When / Then example first; each example becomes a test name.

## Definition of done reminder

See `CLAUDE.md`. A story is not done until its criteria are shown on the preview deployment, its tests are merged and green on all three browser engines, there are no new accessibility violations, and no performance budget is broken.
