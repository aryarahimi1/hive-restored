# Hive Restored — Demo Video Script

**Target runtime:** 90 seconds (hard ceiling 95s).
**Format:** screen capture + voiceover, OBS or QuickTime, 1920×1080 @ 30fps.
**Goal:** judges close the tab thinking "yes, that's the obvious fix for what Reddit broke in March."
**Tone:** mod-empathy first. Casual, lowercase-friendly, no buzzwords. Sound like a tired mod showing another tired mod a trick that works.

> Every visual claim below maps to something actually shipped: the splash stat tiles
> (`src/client/splash.tsx`), the dashboard tabs (`src/client/game.tsx`), the
> mod menu actions (`src/server/routes/menu.ts`), the wiki publish/subscribe
> flow (`src/server/federation/`), and the modqueue badge form
> (`src/server/routes/modqueueBadge.ts`). Numbers are `{TBD_FROM_DOGFOOD}` so
> they can be filled in from `getMetricsSummary` in `src/server/storage/metrics.ts`
> on shoot day.

---

## Shot-by-shot

| TIME | VISUAL | NARRATION | NOTES |
|---|---|---|---|
| 0:00–0:04 | Browser tab on r/ModSupport showing real "what do we use now?" thread headlines (zoomed, no usernames visible). Subtle red vignette. | "march sixth. reddit killed the sub-association api." | OBS scene `coldopen`. Use the saved screenshot at `assets/demo/modsupport.png` (capture pre-shoot, blur usernames). |
| 0:04–0:10 | Cut to a modqueue with five obvious scam-DM posts piling up. No badge yet. Cursor hovers, does nothing. | "saferbot, hive protect — bricked. mod queues kept filling up anyway." | OBS scene `painqueue`. This is the only "before" shot. Don't linger. |
| 0:10–0:16 | Devvit App Directory page for "Hive Restored." Click Install. Permission sheet appears. Click Approve. | "hive restored. one-click install from the app directory." | OBS scene `install`. If the live install is flaky, splice in the pre-recorded approve click from b-roll clip `install-approve.mov`. |
| 0:16–0:22 | App splash inside the sub. Three stat tiles fade in: Trusted peers, Last poll, Threats indexed. | "opens with three tiles. peers, last poll, threats indexed." | File: `src/client/splash.tsx`. Mod-only path — make sure the recording account is a mod on the test sub. |
| 0:22–0:28 | Mod menu opens. Click "Hive: apply trust circle preset." Form opens, mod picks "Midsize (10 peers)." Toast: peers added. | "pick a preset trust circle. ten peer subs. opt-in, both ways." | File: `src/server/routes/menu.ts` (`apply-preset`). Make sure preset list is pre-seeded with believable sub names in dev. |
| 0:28–0:36 | Split-screen: left = r/sub-A modqueue, mod clicks Ban on a known bad-actor alt. Right = the alt's wiki page `r/sub-A/wiki/hive-threats` updating with a hashed record. | "ban a user in sub a. an anonymized fingerprint publishes to its wiki." | OBS scene `splitfederate`. The wiki page is real — `src/server/federation/wikiPublisher.ts` writes it on `onModAction`. Pre-warm: bg-actor alt already has 30+ comments so fingerprint is non-trivial. |
| 0:36–0:44 | Right pane stays on the wiki JSON (zoom on the three hash fields: `time`, `cadence`, `domains`). No username. No content. | "three hashes. posting-time entropy, n-gram cadence, link-domain history. no pii. no content." | This is the privacy-objection answer. Hold for two beats so the viewer reads "no pii." |
| 0:44–0:52 | Cut to sub B's mod menu. Click "Hive: poll peers now." Toast: "Polled 10 peers: 1 added, 0 skipped." | "sub b polls. one new threat indexed." | File: `src/server/routes/menu.ts` (`poll-now`). Live-real call. Cron also runs every 2min so even if the manual click stalls the indexed count will be right. |
| 0:52–1:00 | Cut to sub B modqueue. The same alt has just posted. Mod opens the row's "…" menu, hovers "Hive: threat badge." | "the alt rotates to sub b. open the row menu." | OBS scene `badgehit`. This is the money shot setup. Make sure the alt's new comment is fresh (post within the last 60s of recording). |
| 1:00–1:11 | Click "Hive: threat badge." Form popover opens: composite score, signals line, matched peer sub `r/sub-A`, similarity `{TBD_FROM_DOGFOOD}%`. Click "Show peer match evidence." Receipts expand. | "score, signals, the peer sub that flagged them. receipts, not vibes." | File: `src/server/routes/modqueueBadge.ts` (`badgeFormFields`). Menu label per `devvit.json` `modqueue-badge`. Use the `evidenceDetail` paragraph copy that already ships. |
| 1:11–1:18 | Mod ticks "Add Hive mod note on author" and "Remove this comment." Clicks Apply actions. Success toast: "Hive badge: mod note, removed comment." | "one note, one removal. logged for the team." | `modqueueBadgeForms.post('/submit')`. Action log row should appear on next dashboard load — verified live. |
| 1:18–1:24 | Cut to dashboard Action Log tab. The just-applied action sits at the top with an Undo button. Cursor hovers Undo. | "every action is undo-able. nothing the rest of the team can't reverse." | File: `src/client/game.tsx` `ActionLogTab`. Hover only — don't actually click Undo on camera. |
| 1:24–1:30 | Cut to closing card. Black background, three lines of white text:<br>`opt-in. hashes only. wiki transport.`<br>`hive restored`<br>`devvit. may 2026.` | "opt-in. hashes only. built on the same wiki primitive automod already uses." | OBS scene `closecard`. Static graphic at `assets/demo/closecard.png`. Voiceover ends ~1s before card cuts. |

**Spoken-narration word count:** 113 words. Well under the 200-word ceiling. Leaves breathing room for delivery, the wiki-zoom beat at 0:36, and a half-second silence before the close.

---

## Pre-record checklist

**Test subreddits (set up at least 24h before shoot):**
- `r/hive_demo_a` — publisher sub. Hive Restored installed. 1 mod alt (`u/hive-demo-mod-a`).
- `r/hive_demo_b` — peer sub. Hive Restored installed, `hive_demo_a` already in its trust graph (so the live "poll" returns a real result either way).
- `r/hive_demo_c` — optional third sub for the 3-minute extended cut.

**Alt accounts:**
- `u/hive-demo-mod-a` — mod on both subs, used for recording.
- `u/hive-demo-actor` — the "bad actor" alt. Needs 30+ comments across at least 3 different subs over 5+ days so the fingerprint has real entropy. Pre-seed link-domain spread (mix of imgur, youtube, one suspect-looking shortlink). Do this on Day 23 latest.

**Pre-seed data:**
- Trust circle preset "Midsize (10 peers)" populated with believable peer names (use real mid-size mod-friendly subs from `docs/OUTREACH_PLAYBOOK.md` send list — `mechanicalkeyboards`, `buildapcsales`, etc. — these are public so it's fine to display).
- One scheduled fake-ban from `u/hive-demo-actor` on `r/hive_demo_a` queued for ~60 seconds before the recording starts, so the wiki publish lands during 0:28–0:36.
- Action log on `r/hive_demo_b` should already have 2–3 prior entries so the "Recent activity" panel isn't empty on camera.

**OBS / capture settings:**
- 1920×1080, 30fps, x264 CRF 18, AAC 192k audio.
- Mic: condenser, pop filter, dampened room. Record voiceover in a separate pass over a muted screen capture — do not try to live-narrate while clicking.
- Cursor: enable cursor highlight (subtle yellow ring, not the giant click-bursts).
- Browser zoom: **125%** on the dashboard, **110%** on modqueue. Devvit form modals are already big enough at default.
- Terminal: not on camera. If you do show one (3-min cut only), use Berkeley Mono 18pt on a dark background.
- Disable all browser notifications, Slack, calendar pop-ups. New Chrome profile with only the dev-mode subs in history.

---

## Single-take vs cut decision

**Must be live (no splice):**
- 0:28–0:36 — the ban-in-sub-A → wiki publish. If this is faked the demo is dead.
- 0:44–0:52 — the poll-now toast. The "1 added" number is the proof.
- 0:52–1:00 — opening the row mod menu on the alt's fresh comment in sub B.
- 1:00–1:18 — clicking "Hive: threat badge," the form popover opening, and the action submit. One continuous click-through.

**Can be cut cleanly (splice with hard cut, no fade):**
- 0:00–0:10 cold open — entirely b-roll.
- 0:10–0:16 install — pre-recorded if live install is slow.
- 0:16–0:22 splash — can be a second take spliced in.
- 1:24–1:30 close card — static graphic, just a hard cut from the action log.

**Practical plan:** shoot 0:16 through 1:18 as one continuous take. Top-and-tail with pre-cut b-roll. Aim for 3 clean takes total; pick the best.

---

## B-roll list (for cutaways if a live take has dead air)

1. **Logo card** (`assets/demo/logo.mp4`, 2s) — fades up Hive Restored wordmark over honeycomb pattern. Drop in if 0:36 wiki zoom drags.
2. **Architecture diagram** (`ARCHITECTURE.md` system overview, rendered as a clean PNG `assets/demo/arch.png`) — for the 3-minute extended cut only.
3. **Code snippet** of `wikiPublisher.ts` lines that build the threat record — for the 3-minute cut, over "no pii, no content."
4. **r/ModSupport thread headlines** captured into one scrolling shot (`assets/demo/modsupport.png`) — use for the cold open and as filler if any live segment runs short.
5. **Modnote screenshot** showing the SPAM_WATCH modnote Hive wrote — supports the "logged for the team" line if the live action log doesn't refresh in time.
6. **Splash tile close-up** — re-record the three stat tiles in isolation, can cover any splash-render hiccup.

---

## Failure-mode rehearsal

**Risk 1 — wiki polling is slow / Reddit wiki edit takes >30s to propagate.**
*Likelihood:* medium. Reddit's wiki cache has been observed at 15–45s on hot days.
*Recovery:* the cron already polled every 2 min, so the threat is almost certainly already indexed. If `poll-now` returns "0 added," switch narration line to "sub b already indexed this peer's threat — let's see the badge" and cut straight to 0:52. If even the index is cold, fall back to the dev panel: pre-seeded threat records can be loaded via the test-only `/internal/dev/seed-threat` route. Mention in voice: keep it as "let's jump to the indexed state" — do not lie.

**Risk 2 — the alt's new comment in sub B doesn't get a fingerprint computed in time, so the form opens with no peer match.**
*Likelihood:* medium-high. `onCommentSubmit` is async; first-comment-for-a-user can take 2–8 seconds for the fingerprint, plus match-cache write.
*Recovery:* warm the alt 10 minutes before the shoot by having it comment once in sub B with throwaway content, then delete the comment. The fingerprint and match cache persist in Redis. The on-camera "Hive: threat badge" click then surfaces the full match popover near-instantly. **This is the single highest-risk moment in the script — rehearse it three times before the real take.**

**Risk 3 — Devvit form modal doesn't render correctly inside the modqueue context (a known intermittent on new accounts).**
*Likelihood:* low-medium.
*Recovery:* the comment-level menu action "Hive: explain this user" (`/internal/menu/comment-explain` in `src/server/routes/menu.ts`) returns a toast with the same score + matched-peer line. If the form fails, narrate "click for the explain toast" and use that surface instead. Less cinematic but it ships the same info and never crashes. Have this rehearsed as a fallback path.

---

## Voiceover notes

- **Pacing target:** ~1.25 words/second on average. Slower than feels natural — judges are watching at 1x and the message has to land.
- **Slow down hard on:**
  - "no pii. no content." (0:36) — half-second pause after each phrase.
  - "receipts, not vibes." (1:08) — full one-beat pause before "receipts."
  - "opt-in. hashes only." (1:24) — three separated phrases on the close card, one per beat.
- **Speed up slightly on:** install / setup section (0:10–0:28). Get past the "yes obviously you install it" beats.
- **Tone references:** the way a senior mod talks in r/ModSupport — patient, low-key, slightly tired. Not the "engaging founder pitch" energy. Imagine you're explaining this to someone whose modqueue is on fire right now.
- **Words to avoid:** leverage, revolutionize, unlock, supercharge, AI-powered (even though there's no AI here, the word still ruins the tone), seamless, frictionless.
- **Words that earn their place:** federation, fingerprint, opt-in, receipts, hashes, queue, ban.
- **One implicit objection answered on camera:** "doesn't this leak user data across subs?" — answered visually at 0:36–0:44 (zoom on the hashed wiki JSON) and verbally at the close ("opt-in. hashes only."). Do not over-explain it in the middle; the wiki zoom does the work.

---

## Submission-ready alt versions

### 30-second cut (for r/Devvit Discord teaser + social)

Use this aspect ratio: 1080×1350 (portrait, plays well in Reddit feeds and Discord embeds).

| TIME | VISUAL | NARRATION |
|---|---|---|
| 0:00–0:03 | r/ModSupport headlines, red vignette | "march sixth. reddit killed the sub-association api." |
| 0:03–0:10 | Split-screen ban-in-A → wiki page update | "ban a user. anonymized fingerprint publishes to your sub's wiki." |
| 0:10–0:18 | Sub B modqueue, mod opens row menu, clicks "Hive: threat badge," form opens with score + matched peer | "same user shows up in your peer sub's queue. open the row menu, receipts." |
| 0:18–0:24 | Quick cut: modnote written, action log entry, Undo button highlighted | "one note, one removal, undo-able by the whole team." |
| 0:24–0:30 | Close card | "opt-in. hashes only. hive restored on devvit." |

Spoken word count for the 30s cut: 52 words. Comfortable.

### 3-minute extended cut (for Devpost long-form)

Keep the 90-second core intact (0:00–1:30). Add the following sections after the close card:

| TIME | ADDS |
|---|---|
| 1:30–1:55 | Architecture diagram from `ARCHITECTURE.md` rendered clean. Voice over: walk through the three boxes — app A, wiki page, app B. Land on "no external service. same primitive AutoMod already uses." |
| 1:55–2:20 | Code zoom: `wikiPublisher.ts` showing the threat record being built — highlight that only hash fields and a category enum cross the boundary. |
| 2:20–2:40 | Federation flow diagram: trigger → fingerprint → publish → cron-poll → match-cache → badge. Eight steps, one bullet each, animated reveal. |
| 2:40–2:55 | Mod survey quote, anonymized. Pull one line from the post-beta survey (Q3 or Q5) — `{TBD_FROM_BETA}` until the survey responses come back per `docs/OUTREACH_PLAYBOOK.md`. If zero survey responses, swap in a real r/ModSupport quote (with thread permalink on screen) about the March API loss. |
| 2:55–3:00 | Hard cut back to close card, hold 2s, end. |

Total runtime for the extended cut: 3:00 even.

---

## Numbers the user must fill in before shoot

Search for `{TBD_FROM_DOGFOOD}` and `{TBD_FROM_BETA}` in this file. Three placeholders:

1. **Badge composite-score / similarity %** in the 0:52–1:10 sequence — pull from `getMetricsSummary` in `src/server/storage/metrics.ts` after the dogfood run on Day 23/24.
2. **Survey quote** in the 3-minute extended cut at 2:40 — from the post-beta survey results per `docs/OUTREACH_PLAYBOOK.md` Day 26. If no responses, use the honest fallback noted in that playbook.
3. The narration line "ten peer subs" at 0:22 assumes the Midsize preset has 10 entries — confirm against `src/server/install/presets.ts` and adjust the spoken number if it's currently 8 or 12.

---

## Final pre-flight (the morning of the shoot)

1. Run the test sub through the install flow end-to-end on a fresh alt — clear all Redis state first.
2. Verify the bad-actor alt has 30+ comments and `match:<username>` is populated in Redis on sub B.
3. Test the badge form opens correctly on both a post and a comment (cover the Risk 3 fallback).
4. Pre-record b-roll if not already in `assets/demo/`.
5. Three full takes. Pick the best. Do not over-edit. Past Devvit winners had visible cursor jitter and the videos still landed.

Submit by **23:59 ET on May 27**. Cross-post per `docs/OUTREACH.md` section 5 once submitted.
