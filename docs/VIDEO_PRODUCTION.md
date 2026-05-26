# Hive Restored — Video Production Pack

Everything you need to walk into a recording session and not improvise. Paired with `docs/DEMO_SCRIPT.md`. Voice stays the same: lowercase-friendly, mod-empathy, no buzzwords.

---

## 1. Thumbnail concepts

Three concepts. Pick one per cut, or A/B-test the top two on the 90s main. Headline text is what burns into the image — keep it ≤6 words, mobile-readable at 320px wide.

### Concept A — "Saferbot is dead" (stark / serious) ★ RECOMMENDED LEAD

Background: a flat near-black field (`oklch(0.16 0.03 58)`, the deepest dashboard walnut), with a single faint honeycomb-cell outline ghosted in the upper-right corner so the brand mark is implied, not loud. Foreground subject: the word **SAFERBOT** in a heavy condensed sans, set in a muted gray with a single red strikethrough slashing through it diagonally — like someone crossed it out with a sharpie. To the right, smaller but in clean white: `what now?`. The mood is obituary, not panic. No faces, no reaction shots. The "Hive Restored" wordmark sits bottom-left in the warm cream `oklch(0.96 0.012 72)`, half the size of the headline, with a tiny `devvit · may 2026` underneath in `oklch(0.78 0.08 62)`.

- Dominant color: deep walnut `oklch(0.16 0.03 58)` with a single red strikethrough at `oklch(0.58 0.17 39)`
- Headline (≤6 words): **SAFERBOT — what now?**
- Wordmark placement: bottom-left, cream, ~40% of headline size

**Why this is the lead:** the audience already knows the pain. The thumbnail doesn't sell — it acknowledges. Mods scrolling r/Devvit or r/ModSupport recognize the word "Saferbot" instantly; the strikethrough delivers the emotional beat in 200ms. It pairs with any of the three titles below without pulling the same lever twice. The other two concepts (technical + empathy) leak too much before the click — A holds tension. CTR on "problem-statement" thumbnails in the dev-tools niche reliably beats "feature explainer" thumbnails by 2–3x.

### Concept B — "the trust graph" (technical credibility)

Background: same dashboard cream `oklch(0.96 0.012 72)` so it reads like a screenshot leaked from the product. Foreground: a simplified node graph — 6 hexagonal nodes labeled `r/sub-a`, `r/sub-b`, `r/sub-c`, etc. (use the same public sub names from the Midsize preset so they're legible and not fabricated), connected by thin lines in `oklch(0.78 0.08 62)`. One node glows red `oklch(0.58 0.17 39)` with a small `BANNED` tag, and the lines pulsing out of it terminate in small badge icons on the other nodes. Overlay text top-right in heavy walnut: **federated, opt-in, hashes only**. The mood is calm and infrastructural — looks like an architecture diagram someone would screenshot from a postmortem.

- Dominant color: warm cream `oklch(0.96 0.012 72)` with red accent node `oklch(0.58 0.17 39)`
- Headline (≤6 words): **federated, opt-in, hashes only**
- Wordmark placement: bottom-right, walnut `oklch(0.2 0.04 58)`, same baseline as the bottom node row

### Concept C — "2 a.m. modqueue" (empathy / mod POV)

Background: a dimmed, slightly desaturated screenshot of an overflowing modqueue (real Devvit modqueue UI, blur usernames). Color-graded cool and tired — pull saturation down 30%, drop the highlights. Foreground: an overlay panel in the bottom third, dashboard-cream, showing a single Hive badge row with `composite: 87` and `matched: r/sub-a` visible — like one alert came in and quieted the chaos. Overlay text top-left in white with a soft drop shadow: **the queue isn't yours alone**. A small clock graphic in the corner reads `02:14`. Mood: relief, not victory. This is the "you've been seen" thumbnail.

- Dominant color: muted slate (desaturated screenshot) with warm cream `oklch(0.96 0.012 72)` callout
- Headline (≤6 words): **the queue isn't yours alone**
- Wordmark placement: bottom-center inside the callout panel, walnut `oklch(0.2 0.04 58)`

---

## 2. YouTube metadata

### Title — 3 candidates (all ≤65 chars)

1. **hive restored — federated mod tools for reddit, post-saferbot** *(62 chars)* ★ RECOMMENDED
2. **after reddit killed saferbot: a devvit replacement that works** *(62 chars)*
3. **federated ban-evasion detection on devvit (hive restored demo)** *(63 chars)*

**Recommended:** #1. It front-loads the product name (brand recall after the click), names the killed thing mods are searching for ("saferbot"), and tags the surface ("devvit") for the algorithm. "Federated mod tools for reddit" is the search-intent phrase a tired mod actually types. #2 is the strongest emotional title but buries the brand. #3 wins on pure SEO but reads like a conference talk and loses the mod-empathy frame.

### Description template

```
{ONE-LINE HOOK — this goes in the first 2 lines, above the fold}
when reddit removed the sub-association api in march, saferbot and hive
protect lost their main mechanic. this is what i built instead.

hive restored is a devvit app that lets mod teams share anonymized
behavioral fingerprints of banned users across an opt-in trust graph of
peer subs. when a flagged account rotates to your sub, you see a badge
in modqueue with the matched peer sub, the composite score, and the
receipts. no pii. no content. no sub-association lookups. federation
rides on reddit's own wiki api — same primitive automoderator already
uses.

three signals on every fingerprint:
  • posting-time entropy (kl divergence)
  • function-word n-gram cadence (simhash)
  • link-domain history (minhash)

everything is opt-in, hashes only, and every mod action is undo-able
by the whole team.

— links —
install (devvit app directory): {DEVPOST_URL}
source code: {GITHUB_URL}
hackathon submission: {DEVPOST_URL}
architecture writeup: {GITHUB_URL}/blob/main/ARCHITECTURE.md
demo script (this video, annotated): {GITHUB_URL}/blob/main/docs/DEMO_SCRIPT.md

— chapters —
{paste the chapter list from section 3 below}

— credits —
built by u/{YOUR_USERNAME} for the reddit mod tools hackathon, may 2026.
huge thanks to the r/devvit discord for early roasts, and to the mod
teams who beta-tested in shadow mode.

— for mods —
if you mod a sub that's been hit by ban-evasion or scam-dm waves since
march and want early access, dm me on reddit or open an issue on the
repo.

#devvit #redditmods #moderationtools #saferbot #hiveprotect
#opensource #reddit #modtools #federation #trustandsafety
```

### Tags (12, balancing broad → specific)

```
reddit moderation, devvit, reddit mod tools, saferbot replacement,
hive protect alternative, ban evasion detection, federated trust graph,
reddit api 2026, modqueue tools, behavioral fingerprinting,
reddit wiki api, mod tools hackathon
```

### Category

Science & Technology

---

## 3. Chapter markers

### 90-second main cut (paste into description)

```
0:00 the day saferbot died
0:10 one-click install
0:16 the dashboard
0:22 pick your trust circle
0:28 ban in sub a → wiki publish
0:36 what crosses the wire (hashes only)
0:44 sub b polls the hive
0:52 the badge lands in modqueue
1:00 score, signals, peer match
1:10 mod note + remove + log
1:18 every action is undo-able
1:24 opt-in. hashes only.
```

### 3-minute extended cut (Devpost)

```
0:00 the day saferbot died
0:10 one-click install
0:16 the dashboard
0:22 pick your trust circle
0:28 ban in sub a → wiki publish
0:36 what crosses the wire (hashes only)
0:44 sub b polls the hive
0:52 the badge lands in modqueue
1:00 score, signals, peer match
1:10 mod note + remove + log
1:18 every action is undo-able
1:24 opt-in. hashes only.
1:30 how the federation actually works
1:55 the threat record, line by line
2:20 trigger → fingerprint → publish → poll → match → badge
2:40 what a mod said in beta
2:55 hive restored — devvit, may 2026
```

---

## 4. Captions / on-screen text overlays

Burn these in during edit. All overlay text ≤4 words. Font: a clean condensed sans (Inter Tight or Söhne Breit Kräftig if you have it; otherwise system Inter at weight 800). All overlays anchor bottom-center unless noted; safe-area padding 96px from frame edge. Dwell time is total on-screen seconds including 6-frame fade in/out.

| Time | Overlay text | Position | Color (oklch) | Weight | Dwell | Notes |
|---|---|---|---|---|---|---|
| 0:02 | **march 6, 2026** | top-left | `oklch(0.58 0.17 39)` red | 800 | 3.0s | over modsupport scroll, slight red vignette already in scene |
| 0:08 | **saferbot — dead** | bottom-center | `oklch(0.96 0.012 72)` cream on black plate | 900 | 2.0s | strikethrough across "saferbot" |
| 0:13 | **one click** | bottom-center | `oklch(0.96 0.012 72)` cream | 800 | 2.5s | during install/approve |
| 0:18 | **mod-only view** | top-right, small | `oklch(0.78 0.08 62)` warm tan | 700 | 3.0s | quiet, lowercase, signals "this isn't user-facing" |
| 0:24 | **10 peers · opt-in** | bottom-center | `oklch(0.2 0.04 58)` walnut on cream plate | 800 | 3.0s | sync with preset toast |
| 0:32 | **publishing to wiki** | bottom-right | `oklch(0.58 0.17 39)` red | 800 | 3.5s | live during ban→publish |
| 0:38 | **no pii** | center-screen, large | `oklch(0.96 0.012 72)` cream on `oklch(0.16 0.03 58)` walnut plate | 900 | 2.0s | hold for the privacy beat — the script calls this out as the objection answer |
| 0:41 | **no content** | center-screen, large | same as above | 900 | 2.0s | second line, same style, sequential reveal |
| 0:46 | **polling 10 peers** | bottom-center | `oklch(0.2 0.04 58)` walnut | 700 | 3.0s | matches toast timing |
| 0:54 | **same actor. new sub.** | top-center | `oklch(0.58 0.17 39)` red | 800 | 3.5s | this is the money-shot caption — keep it short |
| 1:02 | **composite: {SCORE}** | top-right | `oklch(0.96 0.012 72)` cream on walnut plate | 900 | 4.0s | fill {SCORE} from internal test metrics |
| 1:06 | **matched: r/sub-a** | top-right, below previous | `oklch(0.78 0.08 62)` tan | 700 | 3.5s | stack under composite |
| 1:14 | **logged for the team** | bottom-center | `oklch(0.96 0.012 72)` cream on walnut plate | 800 | 3.0s | over the apply-actions toast |
| 1:20 | **undo-able. always.** | bottom-center | `oklch(0.96 0.012 72)` cream | 800 | 3.5s | over action log hover; do not click |
| 1:26 | (no overlay — let the close card speak) | — | — | — | — | the closing graphic is its own typography |

**Style rules across all overlays:**
- Always lowercase except acronyms.
- Always with a soft 12px-blur 40%-opacity drop shadow against busy backgrounds so text stays legible at 480p preview.
- Never animate the text itself (no typewriter, no slide-in). 6-frame opacity fade in, 6-frame fade out. Motion goes in the underlying footage, not the captions.
- Maximum two overlays on screen at once (the composite/matched stack at 1:02 is the only exception).

---

## 5. Audio + voiceover

### Pacing

- **Target:** 1.25 words/second average (≈75 WPM). The DEMO_SCRIPT already calls this out and the 113-word count fits cleanly into 90s with breathing room.
- **Slow down hard on:** "no pii. no content." (0:36) and "receipts, not vibes." (1:08) — half-second pause around each phrase. The captions reinforce these beats so the audio can breathe.
- **Speed up slightly on:** install/setup (0:10–0:28). Mods already know what installing a Devvit app looks like.

### Music — 3 royalty-free options (all free tier, no signup friction over 5 min)

1. **"Solitude" by Vlad Gluschenko** — YouTube Audio Library (free, attribution optional). Slow ambient piano with a low synth pad. Loops cleanly at ~2 min so it fits both the 90s main and 3-min extended. Tone: serious-but-warm, sits under VO without competing. Use this as the lead.
2. **"Reflection" by Pufino** — Pixabay Music (free, no attribution required, MP3 download). 2:34 runtime. Ambient piano with a slow swell at the 60s mark — coincidentally lands right around the badge-appears money shot if you start the track at 0:00. Good fallback if Solitude reads too sleepy in the final mix.
3. **"Lost in Dreams" by Pufino** — Pixabay Music (free). 2:11 runtime. Slightly more rhythmic (faint pulse around 90 BPM) — use for the 30-second cut where you need a touch more energy without going cinematic.

Avoid: anything with drums above ~95 BPM, anything with a melodic hook (it competes with VO), anything that crescendos hard (the message has to land, not the music). All three tracks above are mixable to -22 LUFS sitting under a -12 dB VO peak.

### VO recording checklist

- **Mic:** condenser preferred (Shure SM7B / Rode NT1 class) but a Blue Yeti at cardioid on a boom arm is fine. Whatever you have, no laptop mics.
- **Mic distance:** 6–8 inches from the diaphragm, slightly off-axis (15–20°) to dodge plosives.
- **Pop filter:** non-negotiable, foam or mesh.
- **Room treatment:** record inside a closet or under a heavy duvet over your head and the mic. A bedroom with curtains drawn and a rug down is acceptable. Bathroom is not. If you can clap and hear flutter echo, fix the room before recording.
- **Levels:** peaks at **-12 dB**, average around -18 dB. If you're clipping at all, pull the gain. You can boost in post; you can't un-clip.
- **Take-2 backup:** record three full takes back to back without listening between them. Listen after. Pick the best take whole — don't Frankenstein lines from different takes unless one specific phrase is broken.
- **Plosives + sibilance:** if you hear popping on the playback of take 1, move further off-axis. Do not try to fix it with de-ess in post; re-record.
- **Silence handling:** record 30 seconds of room tone at the top of the session. You'll need it to bridge the deliberate pauses without dead-air contrast.
- **Pre-roll:** sip water, do one read-through cold to clear vocal fry, then start the real takes.

---

## 6. Distribution plan

### 90-second main cut — YouTube

Upload as **unlisted** first, send link to 2–3 trusted mods for sanity check, then flip to **public** the morning of May 27. Embed in the Devpost submission and in the r/Devvit + r/ModSupport posts (see `docs/OUTREACH.md` section 5).

### 30-second cut — social

Aspect ratio 1080×1350 portrait, already specified in the script.

**r/Devvit Discord** (`#general` or `#hackathon`):
```
finished cut for the hackathon — hive restored, federated mod-signal sharing
after saferbot/hive protect lost the sub-association api. 30s teaser, the
full demo is on youtube + the devpost is live. would love eyes from anyone
who saw the build along the way. {VIDEO_URL}
```
*(220 chars, fits.)*

**Twitter/X:**
```
when reddit killed the sub-association api in march, saferbot and hive
protect lost their main mechanic.

built the replacement for the devvit hackathon. opt-in, hashes only,
federation rides on reddit's own wiki api.

90s demo: {VIDEO_URL}
```
*(218 chars after URL collapse — fits in one tweet.)*

**Reddit cross-post** (use the full submission post from `docs/OUTREACH.md` section 5; embed the 90s video inline, link the 30s cut as a comment for the mobile-feed scrollers).

### 3-minute extended cut — Devpost + long-form

- Embed on the Devpost project page as the primary video.
- Optional Hacker News **Show HN** post (the morning of May 28, after the hackathon submission deadline so it doesn't conflict with the r/Devvit window):
  ```
  Show HN: Hive Restored — federated bad-actor detection for Reddit mods
  ```
  Body (≤220 chars of the lede):
  ```
  reddit removed the sub-association api in march; this is the replacement i
  built for the mod tools hackathon. opt-in trust graph between mod teams,
  hashed behavioral fingerprints over the wiki api. 3-min demo + source.
  ```

### Cross-posting hygiene

- Do not post to all surfaces simultaneously — stagger by 2–4 hours so each surface gets its own first-hour spike. YouTube algorithm cares about the first-24h velocity from search and embed-driven traffic; concentrated bursts read better than steady drip.
- Reply to every comment in the first 6 hours on Reddit. Comment activity is part of the post's ranking signal and the audience expects the builder to be present.

---

## 7. Pre-record final checklist (single page, copy-paste, 15 min before record)

```
[ ] redis state for r/hive_demo_a and r/hive_demo_b wiped + reseeded
[ ] u/hive-demo-actor has 30+ comments across 3+ subs, oldest 5+ days old
[ ] u/hive-demo-actor warm-commented in sub b 10 min ago (then deleted) so
    the fingerprint + match cache are in redis (Risk 2 mitigation)
[ ] scheduled fake-ban from u/hive-demo-actor on sub a queued for T+60s
[ ] midsize preset confirmed at 10 peers in src/server/install/presets.ts
    (or narration line at 0:22 updated to the actual number)
[ ] action log on sub b has 2–3 prior entries so "recent activity" isn't empty
[ ] dashboard "trusted peers" tile shows a believable count, not 0
[ ] {TBD_FROM_TESTING} composite-score + similarity % filled into script
[ ] OBS scenes loaded: coldopen, painqueue, install, splitfederate,
    badgehit, closecard
[ ] OBS canvas 1920×1080, output 30fps, x264 CRF 18, AAC 192k
[ ] browser zoom set to 125% on dashboard tab, 110% on modqueue tab
[ ] fresh chrome profile loaded — only hive_demo_a and hive_demo_b in history
[ ] all browser notifications disabled (chrome://settings/content/notifications)
[ ] slack, discord, calendar, mail quit (not just closed)
[ ] do not disturb on at the os level
[ ] cursor highlight enabled, subtle yellow ring (not click-burst rings)
[ ] both alt accounts logged in on separate browser profiles, no logout risk
[ ] u/hive-demo-mod-a confirmed as mod on both test subs
[ ] modqueue badge form rehearsed open-close once on a post AND a comment
    (covers Risk 3 fallback)
[ ] Risk 1 fallback rehearsed: "sub b already indexed this peer's threat"
    line memorized in case poll-now returns 0 added
[ ] mic at 6–8 inches, off-axis ~15°, pop filter in place
[ ] mic test: spoken peak hitting -12 dB on the loudest line
    ("the badge appears in queue")
[ ] 30s of room tone recorded at top of session
[ ] water within reach, phone on silent and face-down
[ ] close card png pre-rendered at assets/demo/closecard.png and verified
[ ] b-roll clips present in assets/demo/ (install-approve.mov,
    modsupport.png, logo.mp4 at minimum)
[ ] target: 3 clean takes, screen-capture first then VO over muted screencap
```

---

## Notes for the editor (you, probably, at 1am)

- Cut hard, never fade. The only fades are the 6-frame fades on caption overlays.
- Keep the cursor visible at all times — invisible cursor reads as a fake screencap.
- The wiki-zoom at 0:36–0:44 is the privacy proof. If the JSON is hard to read at the recorded zoom, freeze-frame and digitally zoom in post — do not re-shoot just for legibility.
- Music ducks -6 dB under VO. The duck releases over 800ms, not instantly, so it doesn't pump.
- Color: do not grade. The dashboard's warm cream is already part of the brand; a teal-orange LUT will fight it. Leave the footage at native white balance.
- Export: H.264, 1080p, 12 Mbps target bitrate (YouTube re-encodes anyway, no point overshooting). AAC 192k stereo audio.
