---
description: Plan and start a sprint from its backlog file (0 to 13)
argument-hint: <sprint number 0-13>
---

Start sprint $ARGUMENTS.

1. Read `CLAUDE.md`, `docs/decisions.md`, `docs/backlog/sprint-NN.md` (zero-pad the number, for example `sprint-04.md`) and the matching rows of `docs/development-plan.md`. Open the screenshot of every design board the sprint file links to.
2. Check the previous sprint is closed: look for its entry in `docs/sprint-log.md` and, if it ended at a gate, that the gate's criteria held. If not, say so and stop; the next sprint closes the gap before any new stories start.
3. Check every story against the definition of ready in `CLAUDE.md`. For each story write its acceptance criteria as Given / When / Then examples and note the test approach. Split anything bigger than about a week.
4. Propose the sprint plan: build order, the vertical slice each story delivers, the tests for each criterion (and which are manual), risks, and how many of the sprint's capacity days it uses. Keep a few days free in sprints below 16 days.
5. Show me the plan and wait for my approval before writing code.
6. After approval: create the task list (one task per story plus a final "check the work" task), update the "Current state" section of `CLAUDE.md`, and start with the first story on a short branch named after it.
