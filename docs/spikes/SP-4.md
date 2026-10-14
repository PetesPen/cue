# SP-4: motion at 60 fps

Run on 2026-10-14. Stories at stake: AN-3, AN-7, TN-5 (also UX-3 for how performance budgets are written).

## Question

Do 50 animated elements and a full-slide transition hold 60 fps, and can the same engine step backward?

## Verdict

**Go.** The motion design in the plan works: a pure function from (slide, click) to element states, with the Web Animations API playing the difference using only `transform` and `opacity`.

- On real graphics hardware (Chrome 155 and Edge 155 on this PC) every scenario ran at 60 fps with 0 to 1% of animation frames dropped on a normal slide and 0 to 4% on a deliberately heavy one. Slowing the CPU 4 and 6 times changed nothing.
- **Stepping back is free and exact.** The resolver is a pure function, so going back a click is "resolve the earlier click and play the difference the other way". 500 random sequences of click jumps (over 3,000 jumps) always ended in exactly the state the resolver gives, and every animation in every engine ended in the resolver's state (0 mismatches).
- **Without a graphics card** (the Linux build machines) a normal slide still holds 60 fps in Chromium and Firefox, but a heavy slide does not in Chromium, and WebKit's software drawing is slow even on a normal slide. That is a finding about how the performance budgets must be written (below), not a reason to change the design.

Real Safari is untested: Playwright's WebKit draws in software and is not a fair stand-in.

## What we measured

The spike is throwaway code in `spikes/sp-4`. A **normal slide** has 50 elements (rectangles, circles, text and images, with transparency). A **heavy slide** has 50 much larger, overlapping, translucent elements and images (about 500 to 1,100 px wide), which is a lot of overdraw. Three clicks make everything fly in, move, then fade out, each 600 ms. Transitions (fade, push, zoom) move two whole 50-element slides. "Forward three then back three" tests stepping back.

Three measures: the gap between the page's animation frames (what JavaScript can see); in Chromium, a trace of how many animation frames the browser actually presented, partly presented or dropped; and the same with the CPU slowed. The frame gap alone cannot see frames dropped by the graphics side, which is why the trace matters.

### Real graphics hardware (Chrome 155 and Edge 155, Windows)

| Scenario | Average fps | 95th percentile frame gap | Dropped animation frames (trace) |
|---|---|---|---|
| 50 elements, normal slide | 60 | 16.8 to 16.9 ms | 0 to 1 of about 360 |
| Transitions, normal slide | 59.5 to 60 | 16.8 to 16.9 ms | 0 to 3 of about 125 |
| Forward 3, back 3, normal | 59.9 to 60 | 16.9 ms | 5 to 7 of about 740 (under 1%) |
| 50 elements, heavy slide | 59.8 to 60 | 16.8 to 16.9 ms | 2 of about 365 |
| Transitions, heavy slide | 59.5 to 60 | 16.8 to 16.9 ms | 0 to 6 of 120 to 140 (0 to 4%) |
| CPU slowed 4x or 6x, heavy | 59.5 to 60.4 | 16.8 ms | not traced |

Starting the 50 animations costs 4 ms on the page's thread (10 ms with the CPU 6 times slower). The late frames that do happen are single 34 ms frames, never a run of them. Preparing the layers in advance (`will-change`) made no measurable difference, so it is not recommended.

### No graphics card (Linux build machines, software drawing)

| Engine | Normal slide | Heavy slide |
|---|---|---|
| Firefox | 60 fps in every scenario | 59 to 61 fps in every scenario |
| Chromium | 60 fps, 0 to 2 dropped frames of 120 to 720 | elements 51 fps, fade 57, push 60, **zoom 35**, step back 51; up to 15% of frames dropped |
| WebKit | 41 to 49 fps | 1 to 20 fps |

WebKit (and Chromium on the heavy zoom) are slow because software drawing has to redraw big translucent layers, and a zoom changes the size of the layer as it moves. This does not describe a normal Mac or iPhone, which draw on the graphics chip. It does describe a virtual machine, a remote desktop session or a very old laptop. In WebKit's software drawing, moving elements with `left` and `top` ran 3 times slower than with `transform` (17 against 47 fps, normal slide); on real hardware with 50 simple elements the two could not be told apart. The rule to use only `transform` and `opacity` stays because it costs nothing.

## What this means for the plan

1. **Keep the design.** Pure resolver, Web Animations API, `transform` and `opacity` only, for element animation and for transitions. Stepping back needs no extra code.
2. **Write the performance budgets for what the machines can show.** The nightly runner has no graphics card, so "60 fps" is not a fair absolute target there, especially for heavy slides. For TN-5 and UX-3:
   - On the fixture deck's normal slides, the nightly runner should hold: Firefox and Chromium at 60 fps with at most 5% of animation frames dropped (use the Chromium trace, not only the page's frame gap).
   - Heavy slides get a regression limit against their own baseline, not an absolute fps.
   - 60 fps is **confirmed by hand on a real laptop** (and a Mac with Safari) before each milestone, as the plan already says.
3. **Prefer fade and push to zoom** for the default transition, or accept a lower frame rate for zoom on machines with no graphics acceleration. A transition that changes size is the most expensive kind.
4. **Do not rely on the page's frame gap alone** to judge smoothness. Frames dropped on the graphics side are invisible to it.

## Not covered

- **Real Safari and any Mac or iPhone.** Needs a Mac.
- **A projector or a second display** (scaling a 1920 × 1080 slide to another resolution).
- **The real renderer.** The spike's slide is plain boxes; text uses the system font and pictures are small. Real slides add text layout (the rules in SP-2), images from IndexedDB, and fonts.
- **Easing, per-element delays and "with previous" timing** (AN-4, a Should story).
- **A snapshot of the outgoing slide** (the plan's fallback): not needed on real hardware, so not built. Worth trying only if real laptops struggle.
- **Whether the heavy slide is realistic.** It is deliberately extreme; real decks are usually closer to the normal one.

## How to check it on your own laptop

Run `npm run spike:sp-4`, open http://127.0.0.1:4200 and press the buttons (one per scenario). The box shows average fps and the 95th percentile frame gap in milliseconds: 16.7 is one frame at 60 Hz, so a 95th percentile under about 20 and "framesOver25ms" near zero is smooth. Then open http://127.0.0.1:4200/?heavy and press them again for the heavy slide. If you have a Mac, run both in Safari and tell me the numbers.

## Reproduce

`SPIKE=sp-4 npx playwright test -c spikes/playwright.config.ts --project=chrome` (also `edge`, `webkit`; the Firefox and Linux numbers came from the Spikes workflow, removed at Gate 1; see `docs/spikes/README.md`). Print the numbers with `node spikes/sp-4/report.mjs chrome`. The Chromium frame trace counts frames in the browser's own pipeline report (`PipelineReporter` events, state `STATE_DROPPED`).
