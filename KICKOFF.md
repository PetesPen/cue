# First prompt for Claude Code

Open Claude Code in this folder and paste everything in the box below. If you like, start it with `claude --permission-mode plan` so it cannot change files until you approve its plan.

```
We are starting a new project from the files in this folder. Read CLAUDE.md first, then all of docs/development-plan.md, then docs/backlog/sprint-00.md. Look at design/screenshots/Main.png, Presenter.png and Style-Guide.png.

Then, without writing any code yet:
1. Tell me in about five lines what we are building and how the work is organised, so I can check you have understood it.
2. Ask me the six open decisions in docs/decisions.md. Give your recommendation for each, and keep it short. Remember I am the product owner.
3. When I have answered, propose the sprint 0 plan: the order of the foundations and the five risk spikes, what each spike will measure, and what I will see at the sprint 0 review. Wait for my OK before you build anything.
```

Once you are happy with the sprint 0 plan, tell Claude to go ahead. For every later sprint use `/start-sprint N` to plan it and `/finish-sprint N` to close it.
