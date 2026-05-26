# Hive Restored — 4-Week Build Plan

Hackathon window: **April 29 – May 27, 2026**.
Current status: **Phase 4 — submission polish** (May 26, 2026). All four phases below are shipped; tomorrow is record-and-submit day.

---

## Guiding principles (don't violate these)

1. **Polish > ambition.** Past Devvit winners shipped narrow, reliable, beautiful apps. Cut features ruthlessly to make week-4 polish breathing room.
2. **One demo, 90 seconds, cinematic.** Every architectural decision must serve the final demo video. If a feature doesn't show up on camera, it doesn't ship.
3. **Mods are the customer, judges are the gate.** Every UI choice should make a working mod say "yes, finally." That's also what wins Moderator's Choice.
4. **The federation is the moat.** Single-sub heuristics are commodity. Inter-sub sharing through an opt-in trust graph is what no one else will build in 4 weeks.

---

## Phase 0 — Pre-signup (now, before Reddit dev account exists)

You are here. Goal: have everything ready so the moment you sign up for the hackathon and run `npm create devvit`, you're sprinting, not configuring.

- [x] Folder + repo layout (`README.md`, `PLAN.md`, `ARCHITECTURE.md`)
- [ ] Fingerprint signal spec (`docs/FINGERPRINT_SPEC.md`) — *in progress, specialist agent*
- [ ] TypeScript skeleton with typed stubs (`src/`, `coordinator/`) — *in progress, specialist agent*
- [ ] Day-1 policy email draft for Reddit dev support (`docs/POLICY_EMAIL.md`)
- [ ] Mod-outreach DM drafts (`docs/OUTREACH.md`)

**Exit criteria**: clone the repo on a fresh machine and you know exactly what to build next.

---

## Phase 1 — Week 1 (Apr 29 – May 5 if starting on time; for us, day 1 after signup)

**Theme: Unblock policy, end-to-end skeleton, one signal working.**

### Day 1 — non-negotiable
- Send the policy email to `devvit-support@reddit.com` (template in `docs/POLICY_EMAIL.md`)
- Post in r/Devvit Discord introducing the project — start collecting helpers (Devvit Helper Award = $500 × 6, helps you win it too)

### Days 2–4
- `npm create devvit@latest hive-restored` — overlay official scaffold on existing skeleton
- Wire `onCommentSubmit` trigger → call `computeFingerprint(authorId)` → log to Redis
- Implement **Signal 1: posting-time entropy** end-to-end (cheapest, no LLM dependency)
- Stand up Cloudflare Worker coordinator with two endpoints: `POST /publish` and `GET /threats?subs=...`

### Days 5–7
- Implement **Signal 2: n-gram cadence (SimHash)** — pure TS, no external API
- Mod-facing badge in modqueue (basic Devvit Blocks UI — webview polish comes week 3)
- Internal dogfood on a throwaway test sub with 2 mod alts

**Week-1 exit criteria**: a mod can install the app on a test sub, comment as a "bad actor" alt, and see a fingerprint computed and stored. No federation yet, no UI polish.

---

## Phase 2 — Week 2

**Theme: Federation works, third signal in, trust graph editable.**

### Days 8–10
- **Signal 3: domain-history MinHash** + composite scoring (3 signals → 0–100)
- Coordinator: trust-graph schema, signed publish payloads (HMAC with per-sub secret)
- Devvit settings form: mod picks peer subs, picks which signals to share, opts in/out per category

### Days 11–14
- Federation E2E: ban a user in sub A → publish fingerprint → sub B sees them next comment → badge appears
- Modnote integration: every auto-flag adds a modnote so other mods see context
- Action log in Redis with 30-day retention (for "Undo" + audit)

**Week-2 exit criteria**: two test subs, federated. Banning in one surfaces a warning in the other within 30 seconds.

---

## Phase 3 — Week 3

**Theme: Webview dashboard polish, beta install on real subs.**

### Days 15–17
- Build the webview dashboard (React inside Devvit Web):
  - Trust graph editor (visual: add/remove peer subs, see incoming/outgoing share volume)
  - Threat feed (incoming alerts, with evidence panels)
  - Action log + undo button
  - Settings (signal weights, thresholds, auto-action rules)

### Days 18–21
- Reach out to 3–5 friendly mid-size mod teams (50K–500K members) from week 1 r/Devvit relationships
- Beta install with kill-switch (per-sub disable, fast)
- Collect metrics: false-positive rate, true-positive rate, mod-action-saved estimate

**Week-3 exit criteria**: 3 real subs running it in shadow mode (alerts only, no auto-action yet) for 48+ hours.

---

## Phase 4 — Week 4

**Theme: Ruthless polish, demo video, submission.**

### Days 22–25
- Fix every bug surfaced by beta. **No new features.**
- Polish all copy (mod-facing strings) — this is where judges feel the quality
- Empty states, error states, loading states, accessibility pass
- One-click installer wizard with the 3 preset trust circles (small / mid / large sub defaults)

### Days 26–27
- Record demo video (script in `docs/DEMO_SCRIPT.md` — write in week 3)
- Write submission: tool overview, project impact, 3 communities that benefit
- Submit. Then ping every helpful person in r/Devvit Discord with a Helper Nomination

---

## Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Reddit redlines the federation approach | Medium | Fatal | Pivot codebase to single-sub "Synthetic Detector" — same fingerprinting, same UI, no federation. Decide by Day 3. |
| Devvit HTTP allowlist blocks coordinator domain | Medium | High | Request allowlist Day 1. Fallback: bundle a relay through reddit.com webhooks |
| Fingerprint false-positive rate >5% in beta | Medium | High | Ship in shadow mode by default; mods opt in to auto-action |
| No mod takes the beta seriously | Low | Medium | Pre-seed r/Devvit Discord relationships in week 1, not week 3 |
| Devvit Redis quota too small for fingerprint cache | Low | Medium | Coordinator stores the hot set, app stores only recently-seen users (TTL 7 days) |
| Can't ship visual trust-graph editor in time | Low | Low | Fallback: dropdown multi-select. Ugly but functional. |

---

## Scope cuts (decide upfront — don't pretend you'll have time)

**Shipping in v1:**
- 3 signals (time entropy, n-gram cadence, domain history)
- Up to 30 peer subs per trust circle
- 3 preset trust-circle templates
- Modqueue badge + dashboard
- Shadow mode + opt-in auto-actions

**Explicitly NOT shipping in v1 (post-hackathon roadmap):**
- LLM stylometry (BYO key) — too much variability, too much demo risk
- Mobile-optimized dashboard
- Multi-language n-gram cadence (English only at launch)
- Bulk historical scan ("score every user who ever posted here")
- Public threat-feed for non-mods
- Federation across more than ~50 subs in one circle (performance unknown)

---

## Success metrics (for the submission write-up)

- **Time saved**: estimate hours saved per mod per week (we will instrument this in beta)
- **Catch rate**: % of subsequently-banned users that Hive Restored flagged before the ban
- **False-positive rate**: % of flagged users mods marked as "not a threat"
- **Install velocity**: # of subs installed during hackathon window
- **Peer subs in trust circles**: aggregate network density

These numbers go in the Project Impact section of the Devpost submission. **Instrument them from Day 1.**
