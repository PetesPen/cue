# Design reference: Studio layout, Meadow colours

The refined design for Slides. Eleven screens ("boards"), one style guide, and the tokens extracted from it. It is the visual reference for the build; the product owner (Peter) owns changes to it.

## How to use it

1. **Look at the screenshots first.** `screenshots/*.png` show every board exactly as designed (1440 px wide; the two dialogs are 960 px). Open the PNG for the screen you are building before you write any UI.
2. **Take exact values from `tokens.css` / `tokens.json`.** Colours, type, spacing, radii, shadows and layout sizes are defined there and nowhere else. Do not introduce new values; if the design needs one, ask Peter.
3. **Read the board source for exact CSS** (`boards/*.dc.html`) when a PNG is not enough: padding, gaps, sizes, icon SVG paths. The boards are plain HTML with inline styles.
4. **Do not copy the board files into the app.** They use a small template syntax (`{{holes}}`, `<sc-for>`, `<sc-if>`, a `DCLogic` class) that belongs to the tool they were drawn in, and they load a `support.js` runtime that is not part of this repo. They will not render on their own. Treat them as annotated mock-ups, not components.
5. The live canvas (zoomable, all boards on one page) is private to Peter's Claude account. Ask him to open it, or to export a screenshot, if a board needs closer inspection than the PNG allows.

## Boards and the stories they cover

| Board | Screenshot | Stories | What it shows |
|---|---|---|---|
| Style-Guide | [png](screenshots/Style-Guide.png) | UX-1 | Colour, type, spacing, radius, shadow, editor layout, buttons, tabs, fields, slide-specific parts |
| Home | [png](screenshots/Home.png) | SV-2, SV-3, TH-2 | Deck library, starter layouts, backup reminder banner, storage meter, deck menu |
| Main | [png](screenshots/Main.png) | SL-1 to SL-6, EL-3 to EL-8, ZO-1 to ZO-3, TR-1 to TR-3 | Editor, Design tab, image selected, layers, arrange, opacity, notes strip |
| Editor-Text | [png](screenshots/Editor-Text.png) | EL-1, EL-2, TR-2 | Rich text editing, floating toolbar, font picker, element vs text-colour opacity |
| Editor-Animate | [png](screenshots/Editor-Animate.png) | AN-1 to AN-7 | Animate tab, click steps, step badges, motion path with ghost end, play bar |
| Editor-Transition | [png](screenshots/Editor-Transition.png) | TN-1 to TN-5 | Transition tab, effects, direction, duration, apply to all, preview |
| Export-Dialog | [png](screenshots/Export-Dialog.png) | SV-3 to SV-6 | Export choices: standalone web page, editable `.slides` file, PDF (coming later) |
| Shortcuts | [png](screenshots/Shortcuts.png) | UX-2 | Keyboard shortcut sheet (press `?`) |
| States | [png](screenshots/States.png) | SV-1, SV-3, EL-4, PM-1, UX-5 | Toasts, save status, storage banners, confirm delete, small screen, blocked pop-up, bad file, empty states |
| Presenter | [png](screenshots/Presenter.png) | PM-2 to PM-7 | Presenter window: current slide, next preview, resizable notes, timer, slide strip |
| Audience | [png](screenshots/Audience.png) | PM-1, PM-3 | Audience window: full-bleed slide, "Esc to end" hint that fades after 3 seconds |

`canvas.json` is the board layout of the original canvas (positions and titles). It is not needed to build the app.

## Design rules (from the style guide)

- Primary green is for the one main action on a screen. Selected state is always the accent tint background with tint text. Focus is a 2 px green ring with a 2 px offset.
- Selection: 1.5 px green outline with white square handles. A motion path is a dashed 1 px green line with a ghost end shape.
- In the app chrome, yellow marks animation steps and motion; danger red marks delete and errors. Do not use them for decoration.
- Every icon-only button needs an `aria-label`. Inputs always have a visible label or an `aria-label`.
- Light theme only in v1. 16:9 slides only. Slides are drawn in a fixed 1920 x 1080 space and scaled to fit.
- Fonts: the app UI uses Instrument Sans. Slides offer Instrument Sans, Figtree, Bricolage Grotesque, DM Serif Display, Space Grotesk, JetBrains Mono and Caveat, bundled as WOFF2 (open licences only; confirm each licence in sprint 0). The screenshots were taken with Instrument Sans only, so the font picker's other families appear in a fallback face there.
- The fixture deck "Autumn Launch" (12 slides in a mix of dark, white, yellow and mint backgrounds) is visible in the slide rail of `Main.png` and the strip in `Presenter.png`. Slide 3, "Our approach", is the hero example used throughout.

## Contrast check (UX-6, WCAG AA 4.5:1 for text)

Computed from the token values. The sprint 0 unit test reads `tokens.json` (`textPairs`) and keeps this true.

| Pair | Ratio |
|---|---|
| Forest on white / app background / sage | 15.6 / 14.5 / 13.4 |
| Muted on white / app background / sage | 5.4 / 5.0 / 4.6 |
| White on accent green (buttons) | 5.0 |
| Accent green on white / app background | 5.0 / 4.7 |
| Tint text on accent tint | 6.9 |
| Forest on yellow (badges) | 9.6 |
| Danger on white / danger tint; white on danger | 6.5 / 5.6; 6.5 |
| Forest on warning tint | 14.4 |
| Yellow on forest (toast action) | 9.6 |

Watch-outs: muted text on the hairline colour is 4.2 (below AA), so never put muted text on a hairline-filled surface. Disabled text (#8EA194 on #DCE6D7) is about 2.1 but disabled controls are exempt. Muted text on the sage well passes only narrowly (4.6): do not lighten either colour.

## Changes made since the first published canvas

Found when the boards were first rendered in a browser for this pack:

- Presenter: the "All slides" strip was 112 px tall and clipped the slide numbers; it is now 132 px.
- States: the "File can't be opened" card was labelled SV-4; opening a deck file is SV-3.

Both fixes are also applied to the live canvas.
