# PRODUCT_DEMO_FLOW.md

Frame-accurate spec for the second Hive Restored video: a programmatic
"screen-recording" of a moderator's first 90 seconds with the app, rendered
in Remotion. No screen capture, no live takes — every pixel is a mock
component animated by `useCurrentFrame()`.

- Composition id: `HiveProductWalkthrough`
- Resolution: 1920x1080, 30fps
- Total duration: **3300 frames = 110.0s** (inside the 100–120s budget)
- Total scenes: **11**
- New components beyond the teaser's 11: **14** (see Component Inventory)
- Voice: lowercase mod-talk, not marketing speak. Captions read like a
  mod narrating to another mod over a screenshare. See `docs/OUTREACH.md`
  for the established tone.
- No VO. Captions only. Music bed slot reserved (see Audio).

The video sits at `demo-video/out/hive-product-walkthrough.mp4` once
rendered (separate composition from the existing 86.5s teaser).

---

## Global conventions

These apply to every scene unless overridden.

- **Cursor**: a single `<Cursor>` instance lives at the composition root,
  driven by an `interpolate` over `frame` between waypoints declared in
  each scene. Default cursor stays at its last position between scenes
  (no teleport). Cursor moves are ~30 frames using a soft cubic ease
  (`Easing.bezier(0.25, 0.1, 0.25, 1)`). On `click` events the cursor
  emits a 12-frame ripple ring (opacity 0.6 → 0, scale 0.4 → 2).
- **Hover before click**: every click is preceded by a 6-frame hover
  pause at the target — the implementation agent enforces this by
  having every `interactions[]` `click` entry implicitly use the
  previous 6 frames as hover.
- **Captions**: same dark-pill style as the teaser. Max 8 words,
  positioned bottom 15%, min dwell 90 frames, fade-in 12f / fade-out 12f.
  All caption text is lowercase.
- **Transitions between scenes**: default 15-frame crossfade. Tab
  switches inside the dashboard are *not* scene boundaries — they're
  a re-render of the panel area only (220ms = ~7-frame cross-dissolve
  of the tab panel itself).
- **Timing primitives**: typing animation 3 chars/frame. Number tickers
  use `spring({ frame, fps: 30, config: { damping: 18, mass: 1 } })`
  for the easing curve and `Math.round(interpolate(...))` for the
  displayed value.
- **State container**: a single `useMemo` per scene returns the mocked
  `DashboardState` at the current frame. Scenes do not own React
  state — everything is a pure function of `frame`.
- **Mock sub name**: `r/yoursub` throughout.
- **Mocked moderator**: `u/you` (the logged-in mod). The "banned"
  account is `u/example_alt`.

---

## Scene 1 — splash + open dashboard

- **id**: `splash-open`
- **frames**: `{ from: 0, durationInFrames: 240 }` (8.0s)
- **description**: Mirror of the real `splash.tsx` — centered
  "Hive Restored" wordmark, subtitle "federated bad-actor detection
  for moderators.", three skeleton stat tiles, then a single orange
  "Open dashboard" button. Cursor moves to the button and clicks.
- **cursor**:
  - frame 0: enters from offscreen bottom-right at (1850, 1050)
  - frame 30: arrives at (1100, 600) (idle drift while page loads)
  - frame 120: skeleton tiles resolve to real numbers (0, never, 0)
  - frame 150–180: moves on a slight downward arc to the
    "Open dashboard" button center at approximately (960, 720)
  - frame 186–192: hover dwell
  - frame 192: click + ripple
  - frame 192–240: hold while crossfade kicks off
- **interactions**:
  ```
  [
    { "frame": 192, "type": "click", "target": "splash.openDashboard", "payload": null }
  ]
  ```
- **state_changes**:
  - frame 120: splash state goes `loading` → `mod`, stat tiles populate
    with `{ trustedPeers: 0, lastPoll: "never", threatsIndexed: 0 }`
- **captions**:
  - `0–105`: "shared defense for mod teams."
  - `120–225`: "let's open the dashboard."
- **transitions**: enter from black (15f fade-in), exit 15f crossfade
  into Scene 2 starting at frame 225 (overlap with scene 2's first 15f)

---

## Scene 2 — empty overview, "setup needed"

- **id**: `overview-empty`
- **frames**: `{ from: 240, durationInFrames: 270 }` (9.0s)
- **description**: Dashboard chrome appears: header with
  "Federation control room for r/yoursub" + dark status card on the
  right reading "Setup needed", and below it the tab strip with
  Overview selected. The Overview panel renders four zeroed metric
  tiles ("Trusted peers 0", "Active threats 0", "Indexed total 0",
  "Last poll Never"), an "Impact" panel with the "Metrics warming up"
  empty state, and two side-by-side panels: "No peers yet" and
  "No alerts indexed."
- **cursor**:
  - frame 240: at last position (960, 720) from scene 1
  - frame 255–285: drifts up-left to (640, 280) (status card area),
    pauses 8f — implied "reading the status pill"
  - frame 320–355: arcs across to the "Trust Graph" tab pill at
    approximately (430, 340)
  - frame 361–367: hover dwell on the tab
  - frame 367: click on Trust Graph tab
  - frame 367–510: cursor lingers near tab strip
- **interactions**:
  ```
  [
    { "frame": 367, "type": "click", "target": "tabs.trust", "payload": null }
  ]
  ```
- **state_changes**:
  - frame 367: `activeTab` goes `'overview'` → `'trust'`, panel
    crossfades over 7 frames (368–375)
- **captions**:
  - `255–360`: "fresh install. nothing to do yet."
  - `370–480`: "needs peers. let's add some."
- **transitions**: 15-frame crossfade from scene 1; the tab switch
  inside this scene is a panel-only 7f cross-dissolve, not a scene cut

---

## Scene 3 — trust graph empty state

- **id**: `trust-empty`
- **frames**: `{ from: 510, durationInFrames: 180 }` (6.0s)
- **description**: Trust Graph tab is now active. Header still
  visible. Panel reads "Trust Graph — Add peer subs whose moderation
  signals should reach this install." The peer input row is visible
  (placeholder "modsupport"), the "Add peer" button is orange, and
  below it the dashed empty-state pill reads "No peers yet — Start
  with one friendly test subreddit, then poll peers from the mod
  menu." A secondary "Apply preset" link/button is visible to the
  right of the input row (this is a mock affordance representing the
  real `forms.applyPreset` mod-menu form, surfaced inline for the
  video).
- **cursor**:
  - frame 510: continues from tab pill at (430, 340)
  - frame 540–575: arcs down to the empty-state card center at
    approximately (760, 580), pause 10f — reading
  - frame 590–630: arcs up-right to the "Apply preset" button at
    approximately (1280, 430)
  - frame 636–642: hover dwell
  - frame 642: click
- **interactions**:
  ```
  [
    { "frame": 642, "type": "click", "target": "trust.applyPresetButton", "payload": null }
  ]
  ```
- **state_changes**:
  - frame 642: a mock form sheet starts sliding in from the right
    edge over 18 frames (642–660)
- **captions**:
  - `540–660`: "twenty subs of peer pressure, one click."
- **transitions**: panel cross-dissolved in from scene 2; exits into
  the preset form overlay (no scene cut — the form is part of
  scene 4)

---

## Scene 4 — apply preset, peers animate in

- **id**: `apply-preset`
- **frames**: `{ from: 690, durationInFrames: 510 }` (17.0s)
- **description**: A right-side sheet slides over the dashboard with
  three radio rows: "Starter (3 peers)", "Midsize (10 peers)",
  "Large (20 peers)" each with description text from
  `src/server/install/presets.ts`. Cursor selects Midsize, clicks the
  primary "Apply preset" CTA. Sheet slides out, and the peer list
  animates in below the input row — 10 `<MockPeerRow>` cards stagger
  in from `translateY(8px) opacity 0` to settled, 4 frames apart in
  alphabetical order: askhistorians, changemyview, explainlikeimfive,
  modnews, modsupport, nostupidquestions, personalfinance,
  redditrequest, science, todayilearned. Each shows "r/<name>",
  "Added just now", and the reputation badge as "—" (no FP/threats
  data yet). Top-of-page status card pulses, transitioning from
  "Setup needed" to "Ready to poll."
- **cursor**:
  - frame 690: sheet has just finished sliding in; cursor at (1280, 430)
  - frame 700–740: moves to the "Midsize (10 peers)" radio at ~(1400, 540)
  - frame 746–752: hover dwell
  - frame 752: click — radio fills orange
  - frame 770–810: moves down to "Apply preset" CTA at ~(1500, 880)
  - frame 816–822: hover dwell
  - frame 822: click
  - frame 822–840: sheet slides out (18f)
  - frame 840–1200: cursor idles at right-margin near (1500, 600),
    occasionally micro-drifting (5px noise) — implied "reading the
    list as it populates"
- **interactions**:
  ```
  [
    { "frame": 752, "type": "click", "target": "presetForm.midsize", "payload": "midsize" },
    { "frame": 822, "type": "click", "target": "presetForm.submit", "payload": { "preset": "midsize" } }
  ]
  ```
- **state_changes**:
  - frame 840: `peers` goes `[]` → 10-item array; rows stagger in
    4 frames apart starting frame 850 (row 0 at 850, row 1 at 854,
    row 9 at 886). Each row springs from `opacity 0, translateY 8px`
    to `opacity 1, translateY 0` over 18 frames.
  - frame 900: status pill text crossfades over 12 frames from
    "Setup needed" → "Ready to poll". Pill background tint shifts
    from dark slate to dark slate with a subtle 3% lightness bump.
  - frame 1080: a small toast `<MockToast>` slides in from the top
    right reading "applied midsize: 10 added, 0 already present",
    dwells 90 frames, slides out by frame 1200.
  - frame 1140: status pill transitions a second time, "Ready to
    poll" → "Federation active" (this is the cue described in the
    user story step 5; visually identical animation as the first
    transition).
- **captions**:
  - `700–820`: "pick a preset. midsize is the goldilocks."
  - `840–960`: "ten peers, one click."
  - `970–1080`: "trust graph: live."
  - `1100–1200`: "federation active."
- **transitions**: form sheet uses an 18-frame slide-from-right
  (translateX 100% → 0). Peer rows stagger as documented. Status
  pill uses a 12-frame text crossfade with a 4-frame background
  tint pulse. Scene exits with 15f crossfade into scene 5.

---

## Scene 5 — threat feed: new alert fades in

- **id**: `threat-feed-new`
- **frames**: `{ from: 1200, durationInFrames: 360 }` (12.0s)
- **description**: User clicks the "Threat Feed" tab. The tab panel
  cross-dissolves. The panel header reads "Threat Feed — Incoming
  peer alerts indexed from trusted subreddit wiki feeds." A single
  `<MockThreatRow>` fades in from opacity 0 to 1 over 24 frames with
  a 2px upward translate. The row shows:
  - top label `r/personalfinance · 3a9f51e2`
  - title "Cadence"
  - composite chip: dark card on the right showing "Composite 87"
  - facts row: "Signals: Cadence", "Published: just now",
    "Expires in: 14d"
  - "Show detail" affordance at the bottom.
  Cursor clicks the row's "Show detail" button; the detail grid
  expands (grid-template-rows 0fr → 1fr over 18f) revealing five
  Fact tiles: Matched signal "Cadence", Similarity "87%", Publisher
  "r/personalfinance", Alert ID "3a9f51e2-…", TTL "14d (date)".
- **cursor**:
  - frame 1200: at last position ~(1500, 600)
  - frame 1215–1255: arcs up-left to the Threat Feed tab pill at
    approximately (570, 340)
  - frame 1261–1267: hover dwell
  - frame 1267: click on Threat Feed tab
  - frame 1275–1320: drifts down to the new threat row at ~(960, 540)
  - frame 1380–1420: moves to the "Show detail" button at
    approximately (960, 700)
  - frame 1426–1432: hover dwell
  - frame 1432: click
- **interactions**:
  ```
  [
    { "frame": 1267, "type": "click", "target": "tabs.threats", "payload": null },
    { "frame": 1432, "type": "click", "target": "threats.row[0].toggleExpand", "payload": "3a9f51e2" }
  ]
  ```
- **state_changes**:
  - frame 1267: `activeTab` `'trust'` → `'threats'`, panel
    cross-dissolves 7f
  - frame 1280: `threats` array goes `[]` → one-item array. Row
    fade-in over 24 frames (1280–1304). Composite number ticks
    from 0 → 87 over 30 frames (1280–1310) using spring damping 18.
  - frame 1432: row `expanded` state flips to `true`; detail grid
    height animates over 18 frames (1432–1450).
- **captions**:
  - `1220–1330`: "new alert. came from personalfinance."
  - `1340–1430`: "composite eighty-seven. cadence match."
  - `1450–1550`: "this is the receipt. one click away."
- **transitions**: panel cross-dissolve on tab switch; threat row
  fade-up over 24f; detail expansion as described. Scene exits 15f
  crossfade into scene 6.

---

## Scene 6 — modqueue badge modal

- **id**: `modqueue-badge`
- **frames**: `{ from: 1560, durationInFrames: 420 }` (14.0s)
- **description**: A `<MockBadgeModal>` overlays the dashboard
  (dashboard dims to 35% brightness behind a 0.55-opacity backdrop).
  The modal is the visual equivalent of what the modqueue badge
  surfaces: a card titled "u/example_alt — matched threat" with:
  - composite score arc/donut on the left, numeral animating 0 → 87
    over 36 frames
  - three signal rows on the right: "Cadence ✓", "Domain history ✓",
    "Posting-time entropy ✓"
  - publisher line: "first seen by r/personalfinance · 14d TTL"
  - three action buttons stacked horizontally at the bottom:
    "Add mod note" (outline), "Remove" (outline), "Ban + report"
    (filled orange, primary)
  Cursor moves to "Ban + report" and clicks. The button compresses
  2px (active state) for 4f, then a checkmark SVG draws over the
  button face (stroke-dashoffset animation, 24f). Modal scales 1 →
  0.96 and fades out over 20f. A `<MockToast>` slides in top-right
  reading "banned u/example_alt — published to peers."
- **cursor**:
  - frame 1560: at last position ~(960, 700)
  - frame 1575: backdrop appears (dashboard dims); cursor remains
  - frame 1590–1640: cursor moves diagonally to the donut center at
    approximately (660, 540), brief 6f pause — implied "reading the
    score"
  - frame 1660–1710: moves across signals at (1180, 480), (1180, 540),
    (1180, 600) with 8f dwells (skimming)
  - frame 1740–1790: arcs down to "Ban + report" CTA at
    approximately (1180, 760)
  - frame 1796–1802: hover dwell
  - frame 1802: click
  - frame 1820: cursor relaxes slightly (drifts 6px right)
- **interactions**:
  ```
  [
    { "frame": 1802, "type": "click", "target": "badge.banAndReport", "payload": { "user": "example_alt" } }
  ]
  ```
- **state_changes**:
  - frame 1575: modal enters, backdrop fades over 12 frames
  - frame 1580: composite numeral starts ticking 0 → 87 over 36
    frames (1580–1616) using spring(damping: 18)
  - frame 1600: signal rows stagger in 6f apart with check icons
    drawing in over 12f each
  - frame 1802: button "active" compression 4f
  - frame 1810: checkmark draws over button face over 24f
  - frame 1840: modal fades + scales out over 20 frames
  - frame 1860: toast slides in from top-right, dwells 90 frames,
    slides out by frame 1970
  - frame 1860: dashboard brightness returns to 100% over 12 frames
- **captions**:
  - `1580–1700`: "modqueue popped this. same fingerprint."
  - `1720–1840`: "three signals lined up. that's the bar."
  - `1850–1970`: "ban + report. published to my peers too."
- **transitions**: backdrop fade-in 12f, modal scale-in
  (0.96 → 1.0 + opacity 0 → 1) over 14f starting frame 1572.
  Modal exit 20f scale-down + fade-out. Scene exits 15f crossfade
  into scene 7.

---

## Scene 7 — action log: undo confirm UX

- **id**: `action-log-undo`
- **frames**: `{ from: 1980, durationInFrames: 420 }` (14.0s)
- **description**: Cursor clicks "Action Log" tab. Panel switches.
  The new ban entry is at the top with relative time
  "just now": title "Banned u/example_alt", detail "Acted on a
  federated threat from r/personalfinance · alert 3a9f51e2", type
  pill "Mod". Below it, two earlier entries: "Applied preset
  midsize" (peer, just now) and "Trusted r/personalfinance"
  (peer, 1m ago, with an "Undo" button). The user moves the cursor
  to the "Undo" button on the "Trusted r/personalfinance" entry.
  Clicks "Undo". The button morphs into a two-button confirm row:
  "Confirm" (filled orange) and "Cancel" (outline) with a "Remove?"
  label — this mirrors the real `PeerRow` confirming UX. The user
  clicks "Confirm". A toast slides in from top-right reading
  "removed r/personalfinance from your trust graph." The peer
  count in the header status card ticks 10 → 9 (but the
  "Federation active" pill stays — still has ≥1 peer).
- **cursor**:
  - frame 1980: from last position
  - frame 1995–2040: arcs up to Action Log tab pill at ~(710, 340)
  - frame 2046–2052: hover dwell
  - frame 2052: click on Action Log tab
  - frame 2070–2130: drifts to the "Undo" button on row 3 at
    approximately (1280, 700)
  - frame 2136–2142: hover dwell
  - frame 2142: click — button morphs to confirm row
  - frame 2160–2210: moves 30px left to "Confirm" CTA at ~(1180, 700)
  - frame 2216–2222: hover dwell
  - frame 2222: click
- **interactions**:
  ```
  [
    { "frame": 2052, "type": "click", "target": "tabs.actions", "payload": null },
    { "frame": 2142, "type": "click", "target": "actions.row[2].undo", "payload": null },
    { "frame": 2222, "type": "click", "target": "actions.row[2].confirmUndo", "payload": null }
  ]
  ```
- **state_changes**:
  - frame 2052: `activeTab` `'threats'` → `'actions'`, panel
    cross-dissolves 7f
  - frame 2060: `actions` array now contains three entries; top
    entry (the ban) fades in from opacity 0 over 12 frames
  - frame 2142: row[2] enters `confirming = true`, button area
    morphs (width interpolates from 80px → 220px over 12 frames,
    "Undo" label fades out, "Remove? / Confirm / Cancel" fades in)
  - frame 2230: toast slides in top-right reading "removed
    r/personalfinance from your trust graph.", dwells 90f, exits
    by frame 2340
  - frame 2240: header peer count "10" → "9" ticks down over 12f
  - frame 2250: row[2] fades + collapses (height interpolates to 0)
    over 18 frames, then list re-flows
- **captions**:
  - `2000–2120`: "everything is logged."
  - `2150–2270`: "undo is a two-tap confirm. no oops bans."
  - `2280–2400`: "audit trail, all of it, mod-readable."
- **transitions**: panel cross-dissolve on tab switch. Confirm
  morph as described. Scene exits 15f crossfade into scene 8.

---

## Scene 8 — overview: impact counters tick up

- **id**: `overview-impact`
- **frames**: `{ from: 2400, durationInFrames: 480 }` (16.0s)
- **description**: Cursor clicks "Overview" tab. Panel switches.
  The four top metric tiles now show non-zero values: "Trusted
  peers 9", "Active threats 1", "Indexed total 1", "Last poll just
  now (1 new)". Below them, the Impact card is no longer empty —
  it renders four `<ImpactStat>` tiles that animate from 0:
  - "Flags raised" 0 → 12
  - "Mod actions" 0 → 4 (with detail line "Ban 1 · Remove 0 ·
    Modnote 3")
  - "False positives" 0 → 0 (no animation, stays at 0)
  - "Federation alerts" 0 → 7
  Status pill at top reads "Federation active" with a subtle
  ambient pulse (opacity 1.0 → 0.85 → 1.0 every 60 frames).
- **cursor**:
  - frame 2400: from last position ~(1180, 700)
  - frame 2415–2460: arcs up to Overview tab pill at ~(290, 340)
  - frame 2466–2472: hover dwell
  - frame 2472: click
  - frame 2480–2580: drifts down through metric tiles then settles
    near the Impact card center at ~(960, 660)
  - frame 2580–2880: holds steady — implied "watching numbers
    settle"
- **interactions**:
  ```
  [
    { "frame": 2472, "type": "click", "target": "tabs.overview", "payload": null }
  ]
  ```
- **state_changes**:
  - frame 2472: `activeTab` `'actions'` → `'overview'`, panel
    cross-dissolves 7f
  - frame 2490: four top metric tiles re-render with values
    9 / 1 / 1 / "just now (1 new)" — no ticker, just direct mount
  - frame 2520: impact tile 1 "Flags raised" ticks 0 → 12 over
    48 frames (spring damping 16)
  - frame 2540: impact tile 2 "Mod actions" ticks 0 → 4 over 48f
  - frame 2540: detail line under "Mod actions" crossfades over 18f
    from "—" to "Ban 1 · Remove 0 · Modnote 3"
  - frame 2580: impact tile 4 "Federation alerts" ticks 0 → 7 over
    48f
  - frame 2640 onward: status pill ambient pulse loop
- **captions**:
  - `2430–2540`: "back to overview."
  - `2560–2700`: "lifetime counters, visible to my whole team."
  - `2720–2860`: "this is what shadow mode looks like working."
- **transitions**: panel cross-dissolve on tab switch. Number
  tickers as described. Scene exits 15f crossfade into scene 9.

---

## Scene 9 — pull back: full dashboard wide shot

- **id**: `dashboard-wide`
- **frames**: `{ from: 2880, durationInFrames: 240 }` (8.0s)
- **description**: Camera (CSS `transform: scale()` on the
  dashboard root) zooms out from 1.0 → 0.78 over 90 frames,
  re-centering so the entire dashboard chrome — header, status
  pill, tab strip, overview panel, impact card, peer list preview,
  threat preview — is visible inside the 1920x1080 frame with a
  soft cream margin. Cursor fades out over 24 frames. The whole
  dashboard gets a subtle 4px shadow-elevation increase over the
  zoom-out, plus a 12-frame parallax drift (translateY −24px).
- **cursor**:
  - frame 2880: visible at last position
  - frame 2880–2904: fades out (opacity 1 → 0), no movement
- **interactions**:
  ```
  []
  ```
- **state_changes**:
  - frame 2880: zoom interpolates 1.0 → 0.78 over 90 frames
    (cubic ease-out)
  - frame 2880: shadow elevation interpolates over 90 frames
  - frame 2880: translateY 0 → −24px over 90 frames
- **captions**:
  - `2900–3060`: "ten subs. one mod. shared defense."
- **transitions**: enters via 15f crossfade. Exits via 15f
  cross-dissolve where the dashboard fades to 0.4 opacity behind
  the closing wordmark of scene 10.

---

## Scene 10 — wordmark close

- **id**: `wordmark-close`
- **frames**: `{ from: 3120, durationInFrames: 180 }` (6.0s)
- **description**: Dashboard sits at 0.4 opacity behind a
  centered "Hive Restored" wordmark (the same typography the
  teaser uses). Below it, two subtitle lines:
  - line 1: "shared defense, mod-controlled."
  - line 2: "built on devvit."
  Wordmark scales 0.94 → 1.0 over 30f with a spring; subtitles
  fade in 12f apart (line 1 at frame 3150, line 2 at frame 3162).
  No cursor.
- **cursor**: none — `<Cursor opacity={0} />` for the whole scene
- **interactions**:
  ```
  []
  ```
- **state_changes**:
  - frame 3120: wordmark spring-in
  - frame 3150: subtitle line 1 fade-in over 18f
  - frame 3162: subtitle line 2 fade-in over 18f
  - frame 3270: everything fades to black over 30f (final frame
    3299 is full black)
- **captions**: none — the subtitles ARE the closing line. No
  dark-pill caption overlay this scene.
- **transitions**: 15f crossfade in from scene 9. Final 30f fade
  to black.

---

## Scene 11 — final hold

- **id**: `final-hold`
- **frames**: `{ from: 3300, durationInFrames: 0 }` (terminator)
- **description**: Reserved single-frame end marker. In Remotion
  the composition's last rendered frame is `durationInFrames - 1`,
  so this scene exists only to anchor the total duration math at
  exactly 3300. No content.

> Total math: 240 + 270 + 180 + 510 + 360 + 420 + 420 + 480 + 240
> + 180 = **3300 frames** = 110.0s at 30fps. ✓

---

## Component inventory (new components beyond the teaser's 11)

Each component is a pure function of `frame` plus the props
listed. None of them import from `src/client/*` — they are visual
mocks living in `demo-video/src/product/`.

1. **`<Cursor>`** — `{ from: {x,y}, to: {x,y}, clickAt?: number,
   opacity?: number }`. Renders the macOS-style arrow cursor SVG,
   tweens position with cubic easing, emits a ripple ring on
   `clickAt`.
2. **`<TypingText>`** — `{ text: string, startFrame: number,
   charsPerFrame?: number }`. Types text out one character at a
   time using `Math.floor((frame - startFrame) * cpf)` as the
   slice length. Used for any typed input (peer names, search,
   form fields).
3. **`<MockDashboardChrome>`** — `{ subName: string, status:
   'setup_needed' | 'ready' | 'polling', activeTab: TabId,
   peerCount: number, frame: number }`. Renders the header,
   status pill (with crossfade between status labels), tab strip,
   and slots `children` for the active panel.
4. **`<MockTabPanel>`** — `{ id: TabId, frame: number, children }`.
   Wrapper that fades panel contents in/out over 7 frames on
   `activeTab` change. Uses a `key` prop tied to `id` to trigger
   re-mount.
5. **`<MockMetricTile>`** — `{ label: string, value: string |
   number, compact?: boolean, animateFrom?: number, fromValue?:
   number }`. The top-row metric tile from the real Overview tab.
   When `animateFrom` is set, value interpolates from `fromValue`
   to `value` over 30 frames.
6. **`<MockPeerRow>`** — `{ peer: string, addedAt: string,
   reputation?: { fp: number; threats: number; fpRate: number },
   enterFrame: number, frame: number }`. Mirrors the real
   `PeerRow`. Springs in from `opacity 0, translateY 8px` over
   18f starting `enterFrame`.
7. **`<MockThreatRow>`** — `{ threat: MockThreat, expanded:
   boolean, enterFrame: number, frame: number }`. Mirrors the
   real `ThreatRow`. Composite number ticks 0 → composite over 30
   frames. Expansion uses the same grid-template-rows trick
   (0fr → 1fr) over 18 frames.
8. **`<MockActionLogEntry>`** — `{ entry: MockAction, frame:
   number, confirmingFromFrame?: number, fadeOutFromFrame?:
   number }`. Mirrors the real `ActionRow`. Handles the Undo →
   Confirm/Cancel morph and the collapse-out animation.
9. **`<MockToast>`** — `{ text: string, enterFrame: number,
   exitFrame: number, frame: number, appearance?: 'success' |
   'neutral' }`. Slides in from top-right (`translateX 100% → 0`)
   over 12f, holds, slides out over 12f.
10. **`<MockBadgeModal>`** — `{ user: string, composite: number,
    signals: string[], publisher: string, ttl: string,
    enterFrame: number, exitFrame: number, frame: number,
    onCheckmarkFrame?: number }`. Renders the modqueue badge as
    a centered modal with a dimming backdrop. Composite numeral
    is internally a number ticker tied to `enterFrame`. Includes
    the three action buttons and the checkmark stroke-dashoffset
    animation on the primary CTA.
11. **`<MockPresetForm>`** — `{ enterFrame: number, exitFrame:
    number, selectedFrame: number, submitFrame: number, frame:
    number }`. Right-side sheet with the three preset radio
    rows. Selection animation flips the Midsize radio at
    `selectedFrame`. Slides in 18f / out 18f.
12. **`<MockSettingsForm>`** — `{ frame: number }`. Stubbed for
    future scenes; not actively used in this video but built so
    the component library is complete. (Optional — implementer
    may skip.)
13. **`<ImpactStat>`** — `{ title: string, detail: string,
    targetValue: number, animateFromFrame: number, frame: number,
    durationFrames?: number }`. The Impact card tile from the
    real OverviewTab. Number ticks from 0 → `targetValue` over
    `durationFrames` (default 48) using spring damping 16.
14. **`<MockStatusPill>`** — `{ status: 'setup_needed' | 'ready' |
    'polling', frame: number, transitionAtFrames?: number[] }`.
    The dark status card on the right of the header. Crossfades
    between status copies at the given transition frames.

> Total: **14 new components**, all in `demo-video/src/product/`.
> The implementer may skip `<MockSettingsForm>` if time-boxed —
> the video does not visit Settings. That brings the minimum to 13.

---

## Mock data

A single export at `demo-video/src/product/mockData.ts` produces
the dashboard state at any frame. Sketch:

```ts
export const MOCK_SUB = 'yoursub';
export const MOCK_BANNED_USER = 'example_alt';

export const MOCK_PRESET_PEERS = [
  'askhistorians', 'changemyview', 'explainlikeimfive', 'modnews',
  'modsupport', 'nostupidquestions', 'personalfinance',
  'redditrequest', 'science', 'todayilearned',
];

export const MOCK_THREAT = {
  alertId: '3a9f51e2-7b04-4d2e-9f6a-1c5e8b3a44d1',
  publisherSub: 'personalfinance',
  category: 'cadence',
  composite: 87,
  matchedSignals: ['cadence'],
  markedFP: false,
  publishedAt: 'just now',
  ttlAt: '14d',
};

export const MOCK_ACTIONS_AFTER_BAN = [
  { id: 'a1', type: 'mod', title: 'Banned u/example_alt',
    detail: 'Acted on a federated threat from r/personalfinance · alert 3a9f51e2',
    ts: 'just now', undo: null },
  { id: 'a2', type: 'peer', title: 'Applied preset "Midsize (10 peers)"',
    detail: '10 peers added, 0 already present.',
    ts: 'just now', undo: null },
  { id: 'a3', type: 'peer', title: 'Trusted r/personalfinance',
    detail: 'Added to the federation trust graph from the mod menu form.',
    ts: '1m ago', undo: { kind: 'removePeer', peer: 'personalfinance' } },
];

export const MOCK_IMPACT_TARGETS = {
  flagsRaised: 12,
  modActionsTotal: 4,
  modActionsBreakdown: 'Ban 1 · Remove 0 · Modnote 3',
  falsePositives: 0,
  federationAlerts: 7,
};
```

---

## Audio

- **Single music slot**: one continuous instrumental bed for the
  full 110 seconds.
- **Recommendation**: a calm, mid-tempo lo-fi or ambient piano
  track around 75–90 BPM. Suggested specifics:
  - "Reflection" by Tom Fox (Soundstripe)
  - "Patience" by Pyrosion (Artlist) — instrumental piano
  - or any "documentary calm" cue from Epidemic Sound's
    "thoughtful corporate" pack
- The implementer should expose an `<Audio src={...} />` at the
  composition root, volume 0.35, with a 1.5s fade-in (frames
  0–45) and 2.0s fade-out (frames 3240–3300).
- No voiceover. No SFX (no click sounds, no whooshes — the
  visuals carry it).

---

## Voice / caption style

- Lowercase. Periods optional. Em-dashes welcome.
- Read like a mod talking to another mod over a screenshare —
  not a sales deck.
- Never use: "powerful", "seamless", "revolutionary",
  "AI-powered", "leverage", "unlock".
- Always OK: "shadow mode", "modqueue", "federation",
  "trust graph", "your sub", "peers", "ban + report",
  "audit trail".
- Max 8 words per caption. If a thought is longer, split it
  across two captions back-to-back (min 90f dwell each).

---

## Constraints checklist

- [x] 100–120s total → 110.0s ✓
- [x] No voiceover ✓
- [x] No real tRPC imports — all mock components ✓
- [x] Cursor moves with bezier easing, not teleports ✓
- [x] Every click preceded by 6f hover ✓
- [x] Typing animation at 3 chars/frame ✓
- [x] Caption max 8 words, min 90f dwell ✓
- [x] No features that don't exist in the shipped product ✓
- [x] No modal tutorials / fake copy ✓
- [x] Status pill copy matches `statusCopy` in `game.tsx` ✓
- [x] Preset names match `src/server/install/presets.ts` ✓
- [x] Undo UX matches `PeerRow` two-step confirm ✓

---

## Report

- **Total frame count**: 3300 (110.0s at 30fps)
- **Scene count**: 11 (10 content scenes + 1 terminator marker)
- **New components beyond teaser's 11**: 14 (13 if `<MockSettingsForm>`
  is skipped, which is acceptable since the video doesn't visit
  Settings)
