# Backlog index

One file per sprint, with the stories (full acceptance criteria), demo, key tests and design references copied in so a session can work from a single file. The plan and the sprint numbers come from `../development-plan.md`.

| Sprint | Goal | Days | Stories |
|---|---|---|---|
| [0](sprint-00.md) | Foundations and risk spikes | 16 | (none) |
| [1](sprint-01.md) | Decks, shell and saving | 16 | UX-1, SL-1, SL-2, SV-1, SV-2 |
| [2](sprint-02.md) | Elements you can move | 18 | EL-5, EL-3, ZO-1, TR-1, SV-7 |
| [3](sprint-03.md) | Rich text and notes | 22 | EL-1, EL-2, SL-6, EL-7, EL-10 |
| [4](sprint-04.md) | Images, undo and slide management | 16 | EL-4, EL-8, SL-3, SL-4 |
| [5](sprint-05.md) | Keyboard, speed and first animations | 19 | UX-2, UX-3, AN-1, AN-2, TR-3, SL-5 (colour), AN-4 |
| [6](sprint-06.md) | Motion and sequencing | 20 | AN-3, AN-5, AN-6, TN-1, EL-6 |
| [7](sprint-07.md) | Transitions and the two windows | 14 | TN-4, TN-5, PM-1, PM-2 |
| [8](sprint-08.md) | A complete presenting experience | 14 | PM-3, PM-4, PM-5, PM-6 |
| [9](sprint-09.md) | Deck files, browsers and offline use | 16 | SV-3, UX-5, UX-7 |
| [10](sprint-10.md) | Standalone HTML | 12 | SV-4, SV-5 |
| [11](sprint-11.md) | Polish: layers, motion, transitions | 14 | ZO-2, ZO-3, TR-2, AN-7, TN-2, TN-3 |
| [12](sprint-12.md) | Polish: layout, timer, access | 8 | SL-5 (image), PM-7, UX-4, UX-6 |
| [13](sprint-13.md) | Release hardening | 16 | (none) |
| [After v1.0](after-v1.md) | Stretch | n/a | EL-9, PM-8, SV-6, TH-1, TH-2, TH-3 |

## Story to sprint lookup

| Story | Title | Priority | Sprint |
|---|---|---|---|
| SL-1 | Add a slide | Must | [1](sprint-01.md) |
| SL-2 | Navigate between slides | Must | [1](sprint-01.md) |
| SL-3 | Reorder slides | Must | [4](sprint-04.md) |
| SL-4 | Duplicate and delete slides | Must | [4](sprint-04.md) |
| SL-5 | Set a slide background | Should | [5](sprint-05.md) (colour), [12](sprint-12.md) (image) |
| SL-6 | Add speaker notes | Must | [3](sprint-03.md) |
| EL-1 | Add rich text | Must | [3](sprint-03.md) |
| EL-2 | Choose fonts | Must | [3](sprint-03.md) |
| EL-3 | Add shapes | Must | [2](sprint-02.md) |
| EL-4 | Add images | Must | [4](sprint-04.md) |
| EL-5 | Move, resize and rotate | Must | [2](sprint-02.md) |
| EL-6 | Align and snap | Should | [6](sprint-06.md) |
| EL-7 | Copy, paste and delete | Must | [3](sprint-03.md) |
| EL-8 | Undo and redo | Must | [4](sprint-04.md) |
| EL-9 | Group elements | Could | [after v1.0](after-v1.md) |
| EL-10 | Pick any colour | Should | [3](sprint-03.md) |
| ZO-1 | Reorder with commands | Must | [2](sprint-02.md) |
| ZO-2 | See and rearrange layers | Should | [11](sprint-11.md) |
| ZO-3 | Lock, hide and rename layers | Should | [11](sprint-11.md) |
| TR-1 | Fade any element | Must | [2](sprint-02.md) |
| TR-2 | Control fill and text transparency separately | Should | [11](sprint-11.md) |
| TR-3 | Transparency in animation and export | Must | [5](sprint-05.md) |
| AN-1 | Make an element appear | Must | [5](sprint-05.md) |
| AN-2 | Make an element disappear | Must | [5](sprint-05.md) |
| AN-3 | Move an element | Must | [6](sprint-06.md) |
| AN-4 | Control timing and feel | Should | [5](sprint-05.md) |
| AN-5 | Sequence steps click by click | Must | [6](sprint-06.md) |
| AN-6 | Preview animations | Must | [6](sprint-06.md) |
| AN-7 | Go back a step | Should | [11](sprint-11.md) |
| TN-1 | Choose a transition | Must | [6](sprint-06.md) |
| TN-2 | Set duration and direction | Should | [11](sprint-11.md) |
| TN-3 | Apply to all slides | Should | [11](sprint-11.md) |
| TN-4 | Preview a transition | Must | [7](sprint-07.md) |
| TN-5 | Transitions play smoothly | Must | [7](sprint-07.md) |
| PM-1 | Start a presentation | Must | [7](sprint-07.md) |
| PM-2 | Present from the presenter view | Must | [7](sprint-07.md) |
| PM-3 | Keep both windows in sync | Must | [8](sprint-08.md) |
| PM-4 | Read and resize notes | Must | [8](sprint-08.md) |
| PM-5 | Preview what comes next | Must | [8](sprint-08.md) |
| PM-6 | Navigate the deck | Must | [8](sprint-08.md) |
| PM-7 | Time my talk | Should | [12](sprint-12.md) |
| PM-8 | Show a pointer | Could | [after v1.0](after-v1.md) |
| SV-1 | Autosave locally | Must | [1](sprint-01.md) |
| SV-2 | Manage multiple decks | Must | [1](sprint-01.md) |
| SV-3 | Save and open a deck file | Must | [9](sprint-09.md) |
| SV-4 | Export to HTML | Must | [10](sprint-10.md) |
| SV-5 | Import and export fidelity | Should | [10](sprint-10.md) |
| SV-6 | Export as PDF or images | Could | [after v1.0](after-v1.md) |
| SV-7 | One tab per deck | Must | [2](sprint-02.md) |
| TH-1 | Pick a theme | Could | [after v1.0](after-v1.md) |
| TH-2 | Start from a template | Could | [after v1.0](after-v1.md) |
| TH-3 | Reuse my own slide layouts | Could | [after v1.0](after-v1.md) |
| UX-1 | A sleek, uncluttered editor | Must | [1](sprint-01.md) |
| UX-2 | Fast, keyboard-first work | Must | [5](sprint-05.md) |
| UX-3 | Responsive performance | Must | [5](sprint-05.md) |
| UX-4 | Zoom and fit | Should | [12](sprint-12.md) |
| UX-5 | Works in modern browsers | Must | [9](sprint-09.md) |
| UX-6 | Accessible by default | Should | [12](sprint-12.md) |
| UX-7 | Install and work offline | Must | [9](sprint-09.md) |
