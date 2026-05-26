# Hive Restored — Demo Videos

This project ships **two** programmatic Remotion compositions. Both share
the same component library (`src/components/`) and design tokens
(`src/theme.ts`). No screen capture, no PNGs, no Lottie — every visual is
a React component drawing rectangles, SVG strokes, and animated text
against the dashboard's oklch palette.

## Compositions

| Id                  | Length            | Purpose                              |
|---------------------|-------------------|--------------------------------------|
| `HiveDemo`          | 86.5 s (2595 fr)  | The teaser — narrative pitch         |
| `HiveProductDemo`   | 110.0 s (3300 fr) | Programmatic "screen-recording" of a moderator using the dashboard |

Both compositions are 1920x1080 at 30 fps. Pick either one in Remotion
Studio — they sit side by side in the picker.

## Preview live

```sh
npm install
npm run dev   # opens Remotion Studio at http://localhost:3000
```

In Studio, pick either `HiveDemo` or `HiveProductDemo` from the
composition list. Edits to any file under `src/` hot-reload immediately.

## Re-render after edits

```sh
npm run type-check        # must pass clean

# Teaser
npm run build             # MP4 (h264) → out/hive-demo.mp4
npm run build:webm        # WebM (vp8) → out/hive-demo.webm  (fallback)

# Product walkthrough
npm run build:product     # MP4 (h264) → out/hive-product-demo.mp4
npm run build:product:webm # WebM (vp8) → out/hive-product-demo.webm
```

The teaser renders in ~50 s on Apple Silicon at concurrency 2 (set in
`remotion.config.ts`). The product walkthrough takes ~75 s — it has 705
more frames and a heavier per-frame DOM (dashboard chrome, multiple
panels, modal). Outputs land at `demo-video/out/`.

If the h264 render ever fails because ffmpeg is missing from a sandbox,
use the WebM scripts — Remotion v4 ships its own ffmpeg, but the VP8
path is the safest fallback.

## Teaser scenes — `HiveDemo` (from `docs/REMOTION_SCENE_PLAN.md`)

| # | Sequence name | Component                | Frames    | Time          |
|---|---------------|--------------------------|-----------|---------------|
| 1 | ColdOpen      | `ColdOpenSaferbotDead`   | 0–135     | 0.0–4.5 s     |
| 2 | TrustGraph    | `TrustGraphBuild`        | 120–495   | 4.0–16.5 s    |
| 3 | Federation    | `FederationInAction`     | 480–1080  | 16.0–36.0 s   |
| 4 | TheBadge      | `TheBadge`               | 1065–1680 | 35.5–56.0 s   |
| 5 | ModAction     | `ModAction`              | 1665–2115 | 55.5–70.5 s   |
| 6 | Close         | `CloseWordmark`          | 2100–2595 | 70.0–86.5 s   |

Scenes overlap by 15 frames so adjacent fades crossfade cleanly. No
audio — add a music bed in post.

## Product walkthrough scenes — `HiveProductDemo` (from `docs/PRODUCT_DEMO_FLOW.md`)

| # | Sequence name      | Component             | Frames    | Time          |
|---|--------------------|-----------------------|-----------|---------------|
| 1 | 01_SplashOpen      | `SplashOpen`          | 0–240     | 0.0–8.0 s     |
| 2 | 02_OverviewEmpty   | `OverviewEmpty`       | 225–510   | 7.5–17.0 s    |
| 3 | 03_TrustEmpty      | `TrustEmpty`          | 495–690   | 16.5–23.0 s   |
| 4 | 04_ApplyPreset     | `ApplyPreset`         | 675–1200  | 22.5–40.0 s   |
| 5 | 05_ThreatFeedNew   | `ThreatFeedNew`       | 1185–1560 | 39.5–52.0 s   |
| 6 | 06_ModqueueBadge   | `ModqueueBadge`       | 1545–1980 | 51.5–66.0 s   |
| 7 | 07_ActionLogUndo   | `ActionLogUndo`       | 1965–2400 | 65.5–80.0 s   |
| 8 | 08_OverviewImpact  | `OverviewImpact`      | 2385–2880 | 79.5–96.0 s   |
| 9 | 09_DashboardWide   | `DashboardWide`       | 2865–3120 | 95.5–104.0 s  |
| 10| 10_WordmarkClose   | `WordmarkClose`       | 3105–3300 | 103.5–110.0 s |

All scene-level frames are local (frame 0 = scene start). 15-frame
overlaps between scenes let the entry fade overlap with the previous
scene's exit. The product walkthrough's components live under
`src/product/components/` and the scene files under `src/product/scenes/`.

No audio. Silent. Drop a music bed in post if desired.
