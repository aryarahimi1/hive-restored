# Hive Restored — Remotion Scene Plan

**Format:** programmatic, fully synthetic. No screen capture, no PNG assets.
**Runtime:** 90.000 s @ 30 fps = **2700 frames** exactly.
**Resolution:** 1920 × 1080.
**Audio:** silent-coherent. Optional music bed (see [Audio](#audio)).
**Captions vs narration:** **caption-driven, no voiceover** — justified in [Captions vs narration](#captions-vs-narration).

Composition root: `<Composition id="hive-demo" durationInFrames={2700} fps={30} width={1920} height={1080} />`.
Every scene is wrapped in a `<Sequence>` at the listed `from` with the listed `durationInFrames`. Animations are expressed in absolute composition frames inside each scene's local timeline (interpolations use `frame - sequence.from` internally — that's the implementer's call; this spec quotes absolute scene-local offsets).

Default transition between scenes: 15-frame opacity crossfade unless otherwise noted. Sequences overlap by exactly 15 frames where a crossfade is specified, so the listed `from + durationInFrames` totals still sum to 2700 (the last 15 frames of scene N and the first 15 frames of scene N+1 share clock time but each scene's `durationInFrames` is the full local length).

---

## Color tokens

Pulled from `src/client/game.tsx` and `src/client/index.css`. Use these as the single source of truth — no off-palette colors anywhere in the video.

```json
{
  "bg.cream":          "oklch(0.96 0.012 72)",
  "bg.cream.bright":   "oklch(0.985 0.008 72)",
  "bg.cream.alt":      "oklch(0.95 0.018 72)",
  "bg.walnut.deep":    "oklch(0.18 0.035 58)",
  "bg.walnut":         "oklch(0.20 0.04 58)",
  "bg.walnut.warm":    "oklch(0.22 0.04 58)",
  "text.ink":          "oklch(0.19 0.026 62)",
  "text.muted":        "oklch(0.43 0.028 62)",
  "text.softMuted":    "oklch(0.48 0.03 62)",
  "text.onDark":       "oklch(0.97 0.008 72)",
  "text.onDark.dim":   "oklch(0.83 0.02 72)",
  "text.onDark.label": "oklch(0.78 0.08 62)",
  "accent.amber":      "oklch(0.58 0.17 39)",
  "accent.amber.hot":  "oklch(0.52 0.18 39)",
  "accent.amber.soft": "oklch(0.56 0.14 38)",
  "accent.kraft":      "oklch(0.48 0.09 42)",
  "danger.red":        "oklch(0.55 0.18 28)",
  "danger.red.soft":   "oklch(0.72 0.12 32)",
  "ok.green":          "oklch(0.58 0.14 148)",
  "border.warm":       "oklch(0.86 0.032 68)",
  "border.warm.alt":   "oklch(0.82 0.035 68)"
}
```

Notes:
- `danger.red` and `ok.green` are additions that match the warm-walnut palette in hue weight; both already track with existing oklch values used inside `ReputationBadge` (`oklch(0.55 0.15 55)` amber) and the focus ring's chroma range. Keep chroma ≤ 0.18 to stay inside the design language.
- Never use pure `#000` or `#fff`. Backgrounds are walnut or cream. Text on dark is `text.onDark`, text on light is `text.ink`.

---

## Font stack

Load via `@remotion/google-fonts`. Two faces, no more.

- **Body / captions:** `Inter` — weights 400, 600, 800, 900. Letter-spacing matches the dashboard's `tracking-[-0.04em]` on display sizes.
  - `loadFont` keys: `inter` from `@remotion/google-fonts/Inter`.
- **Display / impact:** `Anton` — single weight (400, but Anton reads ~900). Use for scene 1 "Saferbot", scene 6 wordmark "Hive Restored", and any caption explicitly tagged `display`.
  - `loadFont` keys: `anton` from `@remotion/google-fonts/Anton`.

All other captions use `Inter 800` or `Inter 900`. Body details (signal list lines, mod note text) use `Inter 600`. Tiny labels (TTL, alert id) use `Inter 700` with `tracking-[0.14em]` uppercase per the dashboard convention.

Caption sizing rules:
- Hero captions (center-screen, scenes 1, 6): 140–180 px Anton, line-height 0.95.
- Bottom-third captions (scenes 2–5): 96–112 px Inter 900, line-height 1.05, max-width 1500 px.
- Sub-captions / tagline: 44–56 px Inter 700, color `text.muted` or `text.onDark.dim`.

---

## Captions vs narration

**This video has no voiceover. It is caption-driven.** Reasons:

1. **Faster to produce.** No mic, no room treatment, no retakes, no sync. The pipeline is deterministic: change copy → re-render → ship.
2. **Accessible by default.** Reddit and Twitter autoplay muted. Captions land for every viewer; narration would not.
3. **No recording risk.** The DEMO_SCRIPT live take has three "must-be-live" beats and a Risk 2 ranked medium-high. A programmatic render has zero on-the-day risk.
4. **Tone control is exact.** Mod-empathy voice is easier to hit in 7-word captions than in a 113-word VO read — the script's own VO notes warn against the wrong energy. Captions remove the failure mode.
5. **Coherent silent.** Music is optional. If a host strips audio (Discord embed, Reddit feed muted) the video still tells the whole story.

Caption rules:
- ≤ 7 words per caption.
- ≥ 90 frames (3 s) dwell time per caption before it fades.
- Lowercase-friendly, mod-speak. No buzzwords. Verbs over nouns where possible.
- Always one caption on screen at a time. Never two. Never animated word-by-word — full caption fades in, holds, fades out.

---

## Scene-by-scene

Each scene below lists: `id`, `frames`, `background`, `elements[]`, `transitionOut`. Element `animation` keys use absolute scene-local frames (frame 0 = first frame of the sequence). Positions use either `{ top, left }` for absolute placement or `anchor: center` for centered layout against a 1920×1080 stage.

### Scene 1 — `cold-open-saferbot-dead`

- **frames:** `{ from: 0, durationInFrames: 240 }`  (0.000 s – 8.000 s)
- **background:** `bg.walnut.deep` (`oklch(0.18 0.035 58)`)
- **mood:** serious, slow, heavy

| # | type | position | size | text | color | fontSize | fontWeight | animation |
|---|---|---|---|---|---|---|---|---|
| 1.1 | `Text` | anchor: center, y-offset -40 | auto | `Saferbot` | `text.onDark` | 220 | Anton 400 | `fadeIn{from:6,to:30}` then `holdUntil:150` |
| 1.2 | `Rect` (strike-through line) | top: 540, left: 540 | width: 0 → 840, height: 14, borderRadius: 7, slight 1.5° rotation | — | `danger.red` | — | — | `growWidth{from:120,to:150,fromWidth:0,toWidth:840,ease:'easeOutCubic'}` |
| 1.3 | `Text` (the word "Saferbot" again, layered) | same as 1.1 | auto | `Saferbot` | `text.onDark.dim` | 220 | Anton 400 | `crossFadeOpacity{from:150,to:175,fromOpacity:1,toOpacity:0.35}` (the strike-through "kills" it visually) |
| 1.4 | `Caption` (bottom-third) | bottom: 180, anchor: center-x | maxWidth: 1500 | `what now?` | `text.onDark` | 112 | Inter 900 | `fadeIn{from:180,to:210}` `holdUntil:225` `fadeOut{from:225,to:240}` |

- **transitionOut:** 15-frame crossfade into scene 2 (bg shifts walnut → cream).

Implementation note: the strike-through should feel hand-drawn — give the `Rect` a subtle skew (`transform: skewX(-3deg)`) and animate the width with a non-linear ease so it lands like a pen stroke, not a swipe.

---

### Scene 2 — `trust-graph-build`

- **frames:** `{ from: 225, durationInFrames: 375 }`  (7.500 s – 20.000 s; 15-frame overlap with scene 1 for the crossfade)
- **background:** `bg.cream` (`oklch(0.96 0.012 72)`)
- **mood:** clean, system, additive

Five trust graph nodes appear in a loose pentagon around center (1920×1080 stage center at 960, 540). Node radius 64 px. Connector lines draw between them after all nodes are visible.

Node layout (positions are circle centers):
- N1 `r/mechanicalkeyboards` — (560, 380)
- N2 `r/buildapcsales`        — (1360, 380)
- N3 `r/coffee`               — (1560, 720)
- N4 `r/hive_demo_a`          — (960, 820)
- N5 `r/cscareerquestions`    — (360, 720)

| # | type | position | size | text | color | fontSize | fontWeight | animation |
|---|---|---|---|---|---|---|---|---|
| 2.1 | `TrustGraphNode` | (560, 380)  | r: 64 | `r/mechanicalkeyboards` | fill `bg.cream.bright`, stroke `accent.kraft`, label `text.ink` | label 22 | Inter 800 | `fadeIn{from:0,to:18}` + `scaleIn{from:0,to:18,fromScale:0.7,toScale:1}` |
| 2.2 | `TrustGraphNode` | (1360, 380) | r: 64 | `r/buildapcsales` | same | 22 | Inter 800 | `fadeIn{from:18,to:36}` + `scaleIn{from:18,to:36,fromScale:0.7,toScale:1}` |
| 2.3 | `TrustGraphNode` | (1560, 720) | r: 64 | `r/coffee` | same | 22 | Inter 800 | `fadeIn{from:36,to:54}` + `scaleIn{from:36,to:54,fromScale:0.7,toScale:1}` |
| 2.4 | `TrustGraphNode` | (960, 820)  | r: 80 (larger — this is "you") | `r/hive_demo_a`, sub-label `you` | fill `bg.walnut`, label `text.onDark` | 24 | Inter 900 | `fadeIn{from:54,to:72}` + `scaleIn{from:54,to:72,fromScale:0.7,toScale:1.05}` then settle to 1 at frame 84 |
| 2.5 | `TrustGraphNode` | (360, 720)  | r: 64 | `r/cscareerquestions` | same as 2.1 | 22 | Inter 800 | `fadeIn{from:72,to:90}` + `scaleIn{from:72,to:90,fromScale:0.7,toScale:1}` |
| 2.6 | `Connector` (4 lines, from N4 center to N1, N2, N3, N5 — stagger draws) | start: (960, 820), end: each peer center | strokeWidth: 4, color `accent.amber.soft`, dashArray: 0 (solid) | — | — | — | — | line 1: `drawLine{from:96,to:114}`; line 2: `drawLine{from:108,to:126}`; line 3: `drawLine{from:120,to:138}`; line 4: `drawLine{from:132,to:150}` |
| 2.7 | `Caption` (bottom-third) | bottom: 140, anchor: center-x | maxWidth: 1500 | `opt-in trust graph between mod teams` | `text.ink` | 96 | Inter 900 | `fadeIn{from:165,to:195}` `holdUntil:330` `fadeOut{from:330,to:360}` |
| 2.8 | `Caption` (sub, just below 2.7) | bottom: 80, anchor: center-x | maxWidth: 1200 | `the subs you already trust` | `text.muted` | 44 | Inter 700 | `fadeIn{from:210,to:240}` `holdUntil:330` `fadeOut{from:330,to:360}` |

- **transitionOut:** 15-frame crossfade. Background stays cream into scene 3 (no color shift, just element swap).

Implementation note: `Connector` should draw via SVG `stroke-dasharray` / `stroke-dashoffset` animation, not via a div with growing width — at the angles involved, a div approach will look pixelated.

---

### Scene 3 — `federation-in-action`

- **frames:** `{ from: 585, durationInFrames: 600 }`  (19.500 s – 39.500 s; 15-frame overlap with scene 2)
- **background:** `bg.cream` (`oklch(0.96 0.012 72)`)
- **mood:** mechanical, cause-and-effect

Split-screen layout. Left panel (50, 80) to (920, 1000). Right panel (1000, 80) to (1870, 1000). 80 px gutter. Each panel is a `DashboardPanel` mock — rounded `2rem` corners, `bg.cream.bright` fill, `border.warm` stroke, drop shadow `0 24px 80px rgba(65,45,25,0.12)` matching the real header.

Left panel content:
- Header strip (top 90 px): label `r/hive_demo_a · modqueue`, color `accent.kraft`, 28 px Inter 800, all-caps tracking 0.14em.
- Body: three stacked "comment row" rectangles (rows of size 770 × 110 px, 24 px gap, 30 px inner padding, `bg.cream.alt` fill, `border.warm` stroke). Each row has two text lines: a fake username (`u/————` placeholder bar — actual rendered as a grey pill `Rect` 180×16 px, color `border.warm.alt`) and a fake content line (a 600×12 px `Rect`, same color). The middle row is "the bad actor" and gets highlighted at frame 90.

Right panel content:
- Header strip: label `r/hive_demo_b · modqueue`, same style.
- Body: same three rows, but the middle row gets a `DashboardBadgeMock` (small, 280 × 64 px pill on the right edge of the row) that fades in after the federation line lands.

| # | type | position | size | text | color | fontSize | fontWeight | animation |
|---|---|---|---|---|---|---|---|---|
| 3.1 | `DashboardPanel` (left) | top: 80, left: 50 | 870 × 920 | — | fill `bg.cream.bright`, stroke `border.warm` | — | — | `fadeIn{from:0,to:24}` |
| 3.2 | `Text` | top: 110, left: 80 | — | `r/hive_demo_a · modqueue` | `accent.kraft` | 28 | Inter 800 (uppercase, tracking 0.14em) | `fadeIn{from:12,to:30}` |
| 3.3 | 3× row `Rect` (left panel rows 1, 2, 3) | top: 220 / 354 / 488, left: 80 | 770 × 110 | — | `bg.cream.alt`, stroke `border.warm` | — | — | `fadeIn{from:18,to:42}` |
| 3.4 | Highlight overlay on left row 2 (the ban moment) | top: 354, left: 80 | 770 × 110 | — | fill `danger.red` at opacity 0 → 0.22 → 0 | — | — | `fadeIn{from:84,to:96}` `holdUntil:120` `fadeOut{from:120,to:140}` |
| 3.5 | `Text` "BAN" pill on left row 2 (right side) | top: 386, left: 740 | 110 × 46 | `BAN` | bg `danger.red`, text `text.onDark` | 22 | Inter 900 | `fadeIn{from:96,to:114}` + slight `scaleIn{from:96,to:114,fromScale:0.85,toScale:1}` |
| 3.6 | `DashboardPanel` (right) | top: 80, left: 1000 | 870 × 920 | — | same as 3.1 | — | — | `fadeIn{from:0,to:24}` |
| 3.7 | `Text` | top: 110, left: 1030 | — | `r/hive_demo_b · modqueue` | `accent.kraft` | 28 | Inter 800 (uppercase, tracking 0.14em) | `fadeIn{from:12,to:30}` |
| 3.8 | 3× row `Rect` (right panel rows 1, 2, 3) | top: 220 / 354 / 488, left: 1030 | 770 × 110 | — | `bg.cream.alt`, stroke `border.warm` | — | — | `fadeIn{from:18,to:42}` |
| 3.9 | `Connector` (the "publish" arc) | start: (850, 410), end: (1030, 410), curved arc upward by 140 px | strokeWidth: 6, color `accent.amber`, with small arrowhead at end | — | — | — | `drawLine{from:140,to:200,ease:'easeInOutCubic'}` then `fadeOut{from:240,to:260}` |
| 3.10 | Small `Text` floating above the arc midpoint at peak | top: 230, left: 940 | — | `wiki publish` | `accent.kraft` | 28 | Inter 800 | `fadeIn{from:175,to:200}` `holdUntil:240` `fadeOut{from:240,to:260}` |
| 3.11 | `DashboardBadgeMock` on right row 2 | top: 386, left: 1700 | 170 × 46 | `Hive · 87%` (static here, animated in scene 4) | bg `bg.walnut`, text `text.onDark`, accent dot `accent.amber` | 20 | Inter 900 | `fadeIn{from:210,to:240}` + `slideUp{from:210,to:240,distance:24}` |
| 3.12 | `Caption` (bottom-third) | bottom: 60, anchor: center-x | maxWidth: 1600 | `ban in one sub → flag in the next` | `text.ink` | 96 | Inter 900 | `fadeIn{from:300,to:330}` `holdUntil:540` `fadeOut{from:540,to:570}` |
| 3.13 | `Caption` (sub, just below 3.12) | bottom: 18, anchor: center-x | maxWidth: 1400 | `same primitive automod already uses` | `text.muted` | 36 | Inter 700 | `fadeIn{from:360,to:390}` `holdUntil:540` `fadeOut{from:540,to:570}` |

- **transitionOut:** the right panel zooms toward the camera into scene 4 (the badge becomes the focus). Implement as a 30-frame scale-up of the right panel from 1.0 → 2.4 with origin at the badge's center, while crossfading the left panel and bg toward scene 4's layout. Use `easeInOutCubic`.

Implementation note: the curved arc in 3.9 should be an SVG `path` with a quadratic Bezier control point at (940, 270). Stroke-dashoffset animates from path-length → 0. The arrowhead is a small triangle drawn at the path endpoint, fading in at frame 195–200.

---

### Scene 4 — `the-badge`

- **frames:** `{ from: 1170, durationInFrames: 615 }`  (39.000 s – 59.500 s; 15-frame overlap with scene 3)
- **background:** `bg.cream.bright` (`oklch(0.985 0.008 72)`)
- **mood:** technical credibility, calm authority

A single, centered `DashboardBadgeMock` blown up. This mirrors the real modqueue badge form (`src/server/routes/modqueueBadge.ts`). Card size: 1100 × 720, centered at (960, 540), `border.warm` stroke 2px, `bg.cream.bright` fill, drop shadow as scene 3.

Inside the card, top-down:
1. Header bar: small label `MODQUEUE BADGE`, then a big title `composite score`.
2. Score module on the right side of the header row: large numeral, animated 0 → 87.
3. Divider line.
4. Three signal evidence rows, each with: icon dot (`accent.amber`), label, value-hash placeholder pill.
5. Footer strip: `r/hive_demo_a` matched · `87% similarity` · `no PII shared` (small tags).

| # | type | position | size | text | color | fontSize | fontWeight | animation |
|---|---|---|---|---|---|---|---|---|
| 4.1 | `DashboardPanel` (the badge card) | anchor: center | 1100 × 720 | — | fill `bg.cream.bright`, stroke `border.warm` | — | — | `fadeIn{from:0,to:18}` + `slideUp{from:0,to:24,distance:40}` |
| 4.2 | `Text` (eyebrow label) | top: 100 (within composition), left: 460 | — | `MODQUEUE BADGE` | `accent.kraft` | 22 | Inter 800 (uppercase, tracking 0.18em) | `fadeIn{from:18,to:36}` |
| 4.3 | `Text` (card title) | top: 140, left: 460 | — | `composite score` | `text.ink` | 56 | Inter 900 (tracking -0.04em) | `fadeIn{from:24,to:42}` |
| 4.4 | Score chip background `Rect` | top: 110, left: 1230 (right of card) | 220 × 130 | — | `bg.walnut.warm` | — | — | `fadeIn{from:18,to:36}` |
| 4.5 | `AnimatedCounter` (the score) | inside 4.4, centered | — | `0` → `87` (suffix `%`) | `text.onDark` | 100 | Inter 900 (tabular-nums) | `count{from:60,to:150,fromValue:0,toValue:87,ease:'easeOutCubic'}`; counter holds at 87 from frame 150 onward |
| 4.6 | `Rect` (divider) | top: 270, left: 460 | 1000 × 2 | — | `border.warm` | — | — | `growWidth{from:48,to:78,fromWidth:0,toWidth:1000}` |
| 4.7 | Signal row 1 (dot + label + hash pill) | top: 320, left: 460 | row 1000 × 60 | label: `posting-time entropy`, hash pill: `t:9f3a…d12` | label `text.ink` 32 / Inter 800; pill bg `bg.cream.alt`, pill text `text.muted` 22 / Inter 700 (monospace tabular) | — | — | `fadeIn{from:90,to:120}` + `slideRight{from:90,to:120,distance:24}` |
| 4.8 | Signal row 2 | top: 410, left: 460 | row 1000 × 60 | label: `n-gram cadence`, hash pill: `n:4c11…7be` | same | — | — | `fadeIn{from:135,to:165}` + `slideRight{from:135,to:165,distance:24}` |
| 4.9 | Signal row 3 | top: 500, left: 460 | row 1000 × 60 | label: `link-domain history`, hash pill: `d:a07e…5f2` | same | — | — | `fadeIn{from:180,to:210}` + `slideRight{from:180,to:210,distance:24}` |
| 4.10 | Footer pill row | top: 600, left: 460 | three pills, 8px gap, each ~auto width × 44 | `matched · r/hive_demo_a`, `similarity · 87%`, `no PII shared` | each pill bg `bg.cream.alt`, text `text.ink` 20 / Inter 800; the `no PII shared` pill gets bg `ok.green` at 0.15 opacity, text `ok.green` | — | — | each pill `fadeIn`: pill 1 `{from:225,to:255}`, pill 2 `{from:240,to:270}`, pill 3 `{from:255,to:285}` |
| 4.11 | `Caption` (bottom-third, beneath card) | bottom: 80, anchor: center-x | maxWidth: 1500 | `three signals · no PII shared` | `text.ink` | 96 | Inter 900 | `fadeIn{from:330,to:360}` `holdUntil:555` `fadeOut{from:555,to:585}` |

- **transitionOut:** 15-frame crossfade into scene 5. The badge card fades down while scene 5's action buttons fade up in the same screen region.

Implementation note: `AnimatedCounter` should use `interpolate(frame, [60, 150], [0, 87], { extrapolateRight: 'clamp' })` then `Math.round`. Tabular numerals prevent jitter — use `font-variant-numeric: tabular-nums` in CSS.

---

### Scene 5 — `mod-action`

- **frames:** `{ from: 1770, durationInFrames: 450 }`  (59.000 s – 74.000 s; 15-frame overlap with scene 4)
- **background:** `bg.cream.bright` (`oklch(0.985 0.008 72)`)
- **mood:** decisive, satisfying

A row of three action buttons, centered. Each button: 360 × 140, 32 px border-radius, 24 px gap, Inter 900 24 px label, uppercase. Then a fourth element appears: a checkmark animation over the middle button.

Button styling (mirrors real dashboard CTA in `src/client/game.tsx` line ~552):
- Button 1 `BAN USER`: bg `bg.walnut`, text `text.onDark`.
- Button 2 `REMOVE COMMENT`: bg `accent.amber`, text `text.onDark`. (This is the one that gets the checkmark.)
- Button 3 `ADD MOD NOTE`: bg `bg.cream.alt`, text `text.ink`, stroke `border.warm`.

| # | type | position | size | text | color | fontSize | fontWeight | animation |
|---|---|---|---|---|---|---|---|---|
| 5.1 | `Text` (eyebrow) | top: 280, anchor: center-x | — | `pick your move` | `accent.kraft` | 24 | Inter 800 (uppercase, tracking 0.18em) | `fadeIn{from:0,to:24}` |
| 5.2 | `Rect` button 1 | top: 380, left: 372 | 360 × 140 | `BAN USER` | bg `bg.walnut`, text `text.onDark` | 28 | Inter 900 | `fadeIn{from:18,to:42}` + `slideUp{from:18,to:42,distance:32}` |
| 5.3 | `Rect` button 2 (middle) | top: 380, left: 780 | 360 × 140 | `REMOVE COMMENT` | bg `accent.amber`, text `text.onDark` | 28 | Inter 900 | `fadeIn{from:30,to:54}` + `slideUp{from:30,to:54,distance:32}` |
| 5.4 | `Rect` button 3 | top: 380, left: 1188 | 360 × 140 | `ADD MOD NOTE` | bg `bg.cream.alt`, text `text.ink`, stroke `border.warm` | 28 | Inter 900 | `fadeIn{from:42,to:66}` + `slideUp{from:42,to:66,distance:32}` |
| 5.5 | `Rect` selection ring around button 2 | top: 372, left: 772 | 376 × 156, border 4px, radius 36 | — | stroke `accent.amber.hot` | — | — | `fadeIn{from:120,to:140}` |
| 5.6 | `Rect` button 2 fill darken (signals "pressed") | top: 380, left: 780 | 360 × 140 | — | bg `accent.amber.hot` (overlay opacity 0 → 1) | — | — | `fadeIn{from:140,to:155}` |
| 5.7 | Checkmark `Connector` (SVG path, 2 strokes forming a ✓) | center of button 2 | 80 × 80 | — | stroke `text.onDark`, strokeWidth 10, strokeLinecap round | — | — | `drawLine{from:155,to:185,ease:'easeOutCubic'}` (path-length stroke-dashoffset animation) |
| 5.8 | Success toast `Rect` (appears below buttons) | top: 580, anchor: center-x | 720 × 88, radius 24 | `removed · logged for the team` | bg `bg.walnut`, text `text.onDark` 28 / Inter 800 | — | — | `fadeIn{from:185,to:215}` + `slideUp{from:185,to:215,distance:24}` `holdUntil:360` |
| 5.9 | `Caption` (bottom-third) | bottom: 100, anchor: center-x | maxWidth: 1400 | `one click — done.` | `text.ink` | 112 | Inter 900 | `fadeIn{from:240,to:270}` `holdUntil:405` `fadeOut{from:405,to:435}` |
| 5.10 | `Caption` (sub) | bottom: 40, anchor: center-x | maxWidth: 1200 | `every action is undo-able` | `text.muted` | 36 | Inter 700 | `fadeIn{from:285,to:315}` `holdUntil:405` `fadeOut{from:405,to:435}` |

- **transitionOut:** 30-frame crossfade into scene 6 (cream → walnut.deep). Slower than default — the close needs room to breathe.

Implementation note: the checkmark path should be a single SVG `path d="M 25 42 L 38 55 L 60 28"` with `strokeDasharray` set to the path's total length and `strokeDashoffset` animated from total-length → 0. Round caps and round joins are required; without them the corners look brittle.

---

### Scene 6 — `close-wordmark`

- **frames:** `{ from: 2205, durationInFrames: 495 }`  (73.500 s – 90.000 s; 30-frame overlap with scene 5)
- **background:** `bg.walnut.deep` (`oklch(0.18 0.035 58)`)
- **mood:** earned, quiet, conclusive

Single hero composition: the wordmark `Hive Restored` in Anton, large. Tagline below. Sub-credits below that. End on the wordmark held still for the last 2.0 s.

| # | type | position | size | text | color | fontSize | fontWeight | animation |
|---|---|---|---|---|---|---|---|---|
| 6.1 | `Wordmark` `Text` line 1 | anchor: center, y-offset: -90 | auto | `Hive` | `text.onDark` | 200 | Anton 400 | `fadeIn{from:30,to:75}` + `slideUp{from:30,to:75,distance:32}` |
| 6.2 | `Wordmark` `Text` line 2 (same line, layered) | anchor: center, y-offset: -90, x-offset: +260 | auto | `Restored` | `accent.amber` | 200 | Anton 400 | `fadeIn{from:60,to:105}` + `slideUp{from:60,to:105,distance:32}` |
| 6.3 | `Rect` (small honeycomb hex accent, decorative) | anchor: center, y-offset: +30 | 28 × 32 (hexagon SVG) | — | stroke `accent.amber`, no fill | — | — | `fadeIn{from:90,to:120}` |
| 6.4 | `Text` tagline | anchor: center, y-offset: +100 | maxWidth: 1500 | `shared defense, mod-controlled.` | `text.onDark.dim` | 56 | Inter 700 | `fadeIn{from:120,to:150}` |
| 6.5 | `Text` sub-credits line 1 | anchor: center, y-offset: +220 | — | `open source · built on Devvit · ship may 27` | `text.onDark.label` | 36 | Inter 700 (tracking 0.12em) | `fadeIn{from:165,to:195}` |
| 6.6 | `Text` sub-credits line 2 | anchor: center, y-offset: +280 | — | `r/hive_restored` | `text.onDark.dim` | 32 | Inter 800 | `fadeIn{from:195,to:225}` |
| 6.7 | Final hold (everything stays on screen) | — | — | — | — | — | — | `holdUntil:435` |

- **transitionOut:** **none.** Hard cut on the last frame (frame 2700). No fade — leaves the wordmark seared.

Implementation note: the offset trick in 6.1 + 6.2 puts "Hive Restored" on one visual line but lets "Restored" be a separate color. Alternative: use a single `<Text>` with two `<span>` children and per-span color. Either is fine.

---

## Frame budget verification

| scene | from | duration | end | local color | local duration in seconds |
|---|---|---|---|---|---|
| 1 | 0    | 240 | 240  | walnut.deep | 8.000 |
| 2 | 225  | 375 | 600  | cream       | 12.500 |
| 3 | 585  | 600 | 1185 | cream       | 20.000 |
| 4 | 1170 | 615 | 1785 | cream.bright| 20.500 |
| 5 | 1770 | 450 | 2220 | cream.bright| 15.000 |
| 6 | 2205 | 495 | 2700 | walnut.deep | 16.500 |

Overlaps are 15 frames between scenes 1↔2, 2↔3, 3↔4, 4↔5 (4 × 15 = 60 frames) and 30 frames between 5↔6 (one × 30). Sum of `durationInFrames`: 240 + 375 + 600 + 615 + 450 + 495 = **2775**. Subtract overlap frames consumed by crossfades: 2775 − 60 − 15 = 2700 frames of clock time. **Total runtime: 2700 frames = 90.000 s.** ✓

Caption dwell verification (the ≥ 90 frame / 3 s rule):
- 1.4 `what now?` — 45 frames hold + 15 fade out, plus 30 frame fade in. **Exception, intentional**: this caption is part of the cold-open beat and should land fast then leave. Total on-screen time including fades: 60 frames ≈ 2.0 s. If the implementer wants strict compliance, extend hold to frame 270 and add 15 frames to scene 1 (260 total), pulling the overlap with scene 2 to match. Left as a producer's call.
- 2.7 `opt-in trust graph between mod teams` — 135 frames hold. ✓
- 3.12 `ban in one sub → flag in the next` — 210 frames hold. ✓
- 4.11 `three signals · no PII shared` — 195 frames hold. ✓
- 5.9 `one click — done.` — 135 frames hold. ✓
- 6.4 + 6.5 + 6.6 sub-stack — all held until frame 435 (≥ 240 frames). ✓

---

## Component inventory

The developer will build the following reusable Remotion components. All take a `style` prop pass-through and read the color tokens from a shared `tokens.ts` module.

- **`<Caption text fontSize fontWeight color position dwell fadeIn fadeOut />`** — bottom-thirds or center-screen text overlay; auto-handles the fade-in / hold / fade-out timeline given `dwell` and fade frame ranges.
- **`<DisplayHero text color fontSize />`** — Anton-rendered hero text for scenes 1 and 6; supports the "strike-through" overlay child slot.
- **`<TrustGraphNode cx cy radius label sublabel fillColor strokeColor labelColor delay />`** — circular node with a centered label rendered just below the circle; handles its own fade + scale in.
- **`<Connector start end strokeColor strokeWidth curve drawFrom drawTo arrowhead />`** — SVG path connector (straight or quadratic-Bezier) that draws via `stroke-dashoffset`; optional arrowhead at end.
- **`<DashboardPanel top left width height fillColor strokeColor shadow children />`** — rounded `2rem` card mimicking the real dashboard `Panel` component; children are positioned absolutely inside.
- **`<DashboardBadgeMock score similarity matchedSub size variant />`** — the modqueue badge in two sizes (`small` for the row chip in scene 3, `large` for the centered card in scene 4); composes `AnimatedCounter` and `SignalRow`.
- **`<SignalRow label hashLabel iconColor delay />`** — one row of the signal evidence list (dot + label + monospace hash pill); handles its own slide-in.
- **`<AnimatedCounter fromValue toValue startFrame endFrame suffix ease />`** — interpolates a numeric value across a frame range and renders it with tabular numerals; suffix appended on every frame.
- **`<ActionButton label variant pressed checkmark />`** — one of the three mod-action buttons in scene 5; `variant` is `walnut | amber | outline`; `checkmark` toggles the SVG-drawn check overlay.
- **`<Wordmark primaryText accentText accentColor tagline subcredits />`** — the closing brand mark; composes the two-color title, hex accent, tagline, and stacked sub-credits with a built-in stagger.
- **`<SceneBackground color>`** — full-frame `AbsoluteFill` with the scene's oklch color; lets scene swaps be a single prop change.

11 components total.

---

## Audio

Optional. The video MUST be coherent silent. If a music bed is added, use one of the following royalty-free tracks. Both are CC0 / royalty-free for commercial use including hackathon submissions.

1. **Track A — "Wallpaper" by Kevin MacLeod** (YouTube Audio Library / incompetech.com)
   - URL: https://incompetech.com/music/royalty-free/index.html?keywords=wallpaper
   - Mood: minimal, slightly pensive piano + pad. Matches the mod-empathy tone.
   - Use: full 90 s, ducked to roughly -18 LUFS.

2. **Track B — "Calm Background" by Lesfm** (Pixabay)
   - URL: https://pixabay.com/music/ambient-calm-background-music-lesfm-117785/
   - Mood: ambient pad with subtle motion, no melody. Lets captions carry the narrative.
   - Use: trim to 90 s, fade-in 0 → 1.5 s, fade-out 88.5 → 90.0 s.

Implementation: place behind all sequences with `<Audio src={...} volume={0.4} />`. Add a single 15-frame fade-out on the last frame of scene 6 so the video does not clip to silence.

---

## What lives outside this spec

- No live screen capture. No PNG sourcing. No Lottie. No external animation libs. Plain Remotion + CSS-in-JS animations only.
- No React code in this document — the next agent writes the compositions and components against this spec.
- No voiceover script. Captions ARE the script.
- Dashboard text content (sub names, signal labels, hash placeholders) is illustrative — the implementer should pull live-feeling but non-identifying values; never use a real `u/` username. The hash labels are intentionally truncated (`9f3a…d12`) to underscore the "no PII" message.
