---
description: Close a sprint: run the checks, write the review notes and update the plan
argument-hint: <sprint number 0-13>
---

Close sprint $ARGUMENTS. Do not mark anything accepted: I accept or reject each story at the review.

1. Run the full check set from `CLAUDE.md` (typecheck, lint, unit, component and integration tests, end-to-end on three browser engines, visual regression, accessibility, performance). Report failures plainly; do not hide or skip a failing test.
2. For each story in `docs/backlog/sprint-NN.md`: tick an acceptance criterion only if a test or a demo step shows it working on the preview deployment. List every unmet criterion and every story that is not done.
3. Append an entry to `docs/sprint-log.md` (create it if missing) with: the sprint goal and whether it was met; stories finished, partly finished and not started; engineering days finished against capacity; bugs found and fixed; anything that stays manual and what I should check by hand; a numbered demo script I can follow on the preview link in 45 minutes; and two or three retrospective questions.
4. Move unfinished work into the next sprint file, and say what that pushes out. After sprint 2, re-estimate the remaining sprints from the real velocity and tell me what changes.
5. Update the "Current state" section of `CLAUDE.md`, and update `docs/decisions.md` with anything we decided.
6. End with a short summary: what is ready to show, what is not, and the one thing you most want my decision on.
