# Slides: project pack for Claude Code

Everything needed to start building the Slides web app (the PowerPoint-style presentation maker) in Claude Code: the user stories, the development plan, a backlog file per sprint, the final design with screenshots and tokens, and the project instructions Claude Code reads automatically.

## Start here

You need: a Claude account with Claude Code access (Pro, Max, Team or Enterprise), [Node.js](https://nodejs.org) (current LTS) and [Git for Windows](https://git-scm.com/downloads/win). The app is a Node project, so Claude Code will need Node to run it.

1. **Unzip** `slides-app.zip` somewhere permanent, for example `C:\Users\<you>\Projects`. You get a `slides-app` folder with `CLAUDE.md` at its top.
2. **Install Claude Code.** Either the desktop app (Windows download at https://claude.com/download; open the Code tab, choose Local, pick the `slides-app` folder), or the terminal version: open PowerShell and run

   ```
   irm https://claude.ai/install.ps1 | iex
   ```

3. **Make it a git repository** (the plan uses branches and pull requests). In PowerShell:

   ```
   cd C:\Users\<you>\Projects\slides-app
   git init
   git add .
   git commit -m "chore: import stories, plan and design"
   ```

4. **Start Claude Code** in that folder (`claude` in the terminal; first run asks you to sign in) and paste the prompt from [`KICKOFF.md`](KICKOFF.md).

Claude Code will summarise the project, ask you the six open decisions (team and start date, stack, hosting and so on), and propose a sprint 0 plan. Nothing is built until you approve it.

## What is in the folder

| Path | What |
|---|---|
| `CLAUDE.md` | Project instructions: stack, architecture rules, test rules, definition of ready and done, git rules, how to work. Claude Code reads this at the start of every session |
| `KICKOFF.md` | The first prompt to paste |
| `docs/user-stories.md` | 57 user stories (38 Must, 13 Should, 6 Could) with acceptance criteria |
| `docs/development-plan.md` | Agile plan: 14 two-week sprints, architecture, test strategy, risks, metrics |
| `docs/backlog/` | One file per sprint with its stories, demo, key tests and design links; plus a story-to-sprint lookup |
| `docs/decisions.md` | The six open decisions and the settled ones |
| `design/` | The Studio design: 11 screenshots, the board sources, colour and type tokens, a design README |
| `.claude/commands/` | `/start-sprint N` and `/finish-sprint N` |

## Good to know

- **Claude Code starts fresh.** It does not see the earlier design conversation. Everything it needs is in these files, so if something is missing, add it to the files rather than explaining it in chat.
- **The plan is a plan, not a contract.** Estimates are first guesses (give or take 30%) and are re-checked after sprint 2. Claude Code is told to keep to the sprint goal and send new ideas to the backlog.
- **Decide the open questions early.** The stack in `CLAUDE.md` is a proposal that the sprint 0 spikes confirm or change.
- **Design changes go through you.** Claude Code is told not to edit `design/`; it will describe a change and ask.
