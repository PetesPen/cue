# Bundled fonts

All seven families are under the SIL Open Font License 1.1 (OFL). Each folder holds its licence text as `OFL.txt`.
The WOFF2 files are the unmodified Latin-subset files from the Fontsource npm packages below; nothing is re-subset or edited.
Only the Latin subset is bundled (U+0000-00FF plus common punctuation, currency and the euro sign, see `unicode-range` in
`fonts.css`). Text outside it falls back to the visitor's own fonts, so it can look different on another computer.

When a deck is exported with fonts embedded (`.slides` file or standalone HTML), the licence text of each embedded family
must travel with it. OFL also forbids selling the fonts on their own.

| Family | Source package | Files (SHA-256) |
|---|---|---|
| Instrument Sans | `@fontsource-variable/instrument-sans@5.3.0` | `instrument-sans-latin-wght-normal.woff2` 2ee17598a98d8a59e4df8152d015bec9ab8e4d5672cc0ab42bef806b568e3971<br>`instrument-sans-latin-wght-italic.woff2` 77210cdde0281b5ecb0d592e063a98656f1bc36993a3b98f506eb91ff4a433a5 |
| Figtree | `@fontsource-variable/figtree@5.3.0` | `figtree-latin-wght-normal.woff2` 4ba7d3d096695818fe0686be4f1e82c6b05134e18a22260336130335027462dd<br>`figtree-latin-wght-italic.woff2` 7242fa62d13d46172816b266f03c027999faa3755a52c2124bc2c440f6f4b983 |
| Bricolage Grotesque | `@fontsource-variable/bricolage-grotesque@5.3.0` | `bricolage-grotesque-latin-wght-normal.woff2` a97804dc9fbe5fc972a08018c5eda4dab7ef2346f64c57e61419d05e6de4ea1c |
| DM Serif Display | `@fontsource/dm-serif-display@5.3.0` | `dm-serif-display-latin-400-normal.woff2` fdf61e20fd2c0108e0ea28da4daca0035205b4b7fc031a3974b865b704de160a<br>`dm-serif-display-latin-400-italic.woff2` ed8b291611e32fa2d2900488dd48fc95faf0957b2ef7ddf1527e8d21dd9cf2df |
| Space Grotesk | `@fontsource-variable/space-grotesk@5.3.0` | `space-grotesk-latin-wght-normal.woff2` 0640890476fc1198ab4de571fb658de443c4d85b66466ec09534a8737ab1ce9d |
| JetBrains Mono | `@fontsource-variable/jetbrains-mono@5.3.0` | `jetbrains-mono-latin-wght-normal.woff2` 18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e<br>`jetbrains-mono-latin-wght-italic.woff2` a8afa085e9ca5e53434e2ee918ba6b65c7dd4dda56509976b36591478c99d62e |
| Caveat | `@fontsource-variable/caveat@5.3.0` | `caveat-latin-wght-normal.woff2` 891951df5e8b5b0f0bc760d31375405e795c666b5add70437de12d4a6482b33f |
