# Hive Restored — Devpost Submission

> **How to use this file.** Every section below maps 1:1 to a Devpost form
> block. Paste them in order. Every `{TBD_FROM_METRICS}` marker is a number
> you fill in from `getMetricsSummary()` in `src/server/storage/metrics.ts`
> (or from the post-beta survey results per `docs/OUTREACH_PLAYBOOK.md`) on
> the morning of submission day. Source-of-truth is annotated inline.

---

## Inspiration

On **March 6, 2026**, Reddit shipped an API change that removed the
subreddit-association lookup. Within a day, r/ModSupport filled with the same
thread, over and over: *"Saferbot stopped working — what do we use now?"*
*"Hive Protect just bricked, my modqueue is on fire."* *"Anyone else lose
their ban-evasion defense overnight?"* Mid-size mod teams who had built
their entire anti-evasion workflow around one bot suddenly had nothing. The
scam-DM rings, the karma-farm-then-pivot accounts, the AI-spam floods — all
the patterns the old tooling caught — kept rotating into modqueues with no
warning signal.

We watched that thread for a week, then sat down and asked: *what would it
take to rebuild this without the lookup Reddit just killed?* The answer
turned out to be smaller than expected — opt-in, wiki-transported
federation between mod teams that already trust each other, with no usernames
or raw content in the feed. Four weeks,
narrow scope, one demo. Hive Restored is that bet.

## What it does

- **Surfaces a behavioral badge** in your modqueue the moment a flagged user
  posts — composite score, which signals fired, which peer sub flagged the
  same fingerprint, one-click ban / remove / modnote.
- **Publishes opaque behavioral fingerprints** to your sub's own
  `r/<sub>/wiki/hive-threats` page when your team bans someone, so trusted
  peer subs see the threat within ~60 seconds.
- **Lets you pick your hive** — a mod-only form to add or remove peer subs
  (or apply a preset trust circle) without touching code.
- **Defaults to shadow mode** — every install starts in alerts-only. No
  bans, no removals, no surprises. Auto-action is opt-in per signal.
- **Logs every action for audit** — setup changes use a confirm-before-undo
  flow, and moderation actions stay visible to the rest of the team.

## How we built it

**Stack:** Devvit Web (0.12.24), TypeScript, Hono, tRPC, React 19, Tailwind
CSS 4, Vite, Vitest, Zod, Redis (Devvit-managed). Federation transport is
Reddit's own wiki API via `context.reddit.getWikiPage` /
`reddit.updateWikiPage`. No external service, no Cloudflare Worker, no
HTTP allowlist friction — every cross-sub request goes through the same
primitive AutoModerator configs already use.

**Architecture, top-down.** A `onCommentSubmit` / `onPostSubmit` trigger
hits a fingerprinter that emits three orthogonal hashes (described below).
The composite scorer in `src/server/fingerprint/composite.ts` matches the
new fingerprint against the threat index Redis built from peer wikis.
When a mod bans someone, `wikiPublisher.ts` appends a hashed threat record
to this sub's wiki page. A 2-minute cron in `src/server/routes/scheduler.ts`
pulls every peer's `hive-threats` wiki page through `wikiSubscriber.ts`,
deduplicates, and updates the local match cache. The mod UI is a Devvit
form (`modqueueBadge.ts`) plus a React dashboard (`src/client/`) talking
to Hono routes via tRPC.

**Why wikis as the broker.** Running an external coordinator means a
domain to allowlist, an account to host on, a privacy story to defend, and
a single point of failure. Wikis cost nothing, scale with Reddit, and put
each mod team in literal ownership of their own threat data — they can
read it, audit it, edit it, or wipe it with one API call.

**Signal 1 — posting-time entropy** (`src/server/fingerprint/timeEntropy.ts`).
24-bin UTC hour histogram, Shannon entropy, KL divergence vs a
hand-tuned human baseline. Output: 64-bit hash. **Hard to evade because**
faking a human posting rhythm requires actually sleeping — a bot ring
posting at uniform intervals or odd hours leaves a KL signature the
fingerprint catches even if every account uses a fresh proxy.

**Signal 2 — n-gram cadence SimHash**
(`src/server/fingerprint/ngramCadence.ts`). Tokenize, mask non-function
words with `␡CONTENT␡`, extract 2- and 3-grams, take the top 32, SimHash
to 128 bits. Output: 32-char hex SimHash. **Hard to evade because**
function-word rhythm is downstream of an account's underlying language
model — every sibling account in an LLM-driven ring shares a cadence
fingerprint that survives username changes, post-topic rotation, and
copy-paste obfuscation.

**Signal 3 — domain-history MinHash**
(`src/server/fingerprint/domainHistory.ts`). Extract eTLD+1 from every
URL the account posted, filter out a 16-domain denylist of platform
hosts (reddit, imgur, youtube, etc.), MinHash to a 64-position
signature, base64. Output: ~344-byte signature. **Hard to evade because**
the entire business model of an affiliate-spam ring depends on the rings
co-posting the same set of monetized domains — rotating those domains
costs the ring real money.

**Privacy posture as a feature, not a footnote.** Threat records contain
opaque behavioral hashes, a category enum, and timestamps. No username.
No comment content. No URL lists. SimHash and MinHash both compare via
similarity *over hashes* — neither one is invertible to the source text
or URL set. Wikis are world-readable, so we describe those hashes
honestly: useful correlation tokens for trusted moderation workflows, not
unlinkable anonymity tokens. The result: a peer sub can recognize a
behavioral sibling without receiving the banned user's name or raw
content.

## Challenges we ran into

**1. The March 6 API change forced a redesign mid-project.** The original
plan leaned on the same subreddit-association lookup Saferbot used — which
disappeared a week into our scaffolding work. We rewrote the project pitch
in a day: instead of a faster Saferbot clone, this had to be the
fundamentally different thing that didn't need the killed endpoint.
Federated behavioral fingerprints became the moat.

**2. We pivoted away from a Cloudflare coordinator to a wiki broker.**
The original `coordinator/` directory was a full Cloudflare Worker with
HMAC signing, KV storage, Durable Object rate limiters — about 600 LOC
and a deployment story. After a r/Devvit thread surfaced that wiki reads
across subs are a stable, blessed primitive, we cut the whole coordinator
and rewrote federation in ~150 LOC of `wikiPublisher.ts` +
`wikiSubscriber.ts`. The coordinator is preserved in-repo as Plan B in
case Reddit policy review forces us back to it. Net effect: less code,
zero hosting cost, a cleaner privacy story.

**3. False-positive rate vs. catch rate in composite scoring.** Each
signal in isolation is noisy — a night-shift worker looks bot-like by
time entropy alone, a topic enthusiast looks like a ring by domain
history alone. Early dogfood showed unacceptable FP rates at the
single-signal threshold. We resolved it by (a) requiring ≥2 of 3
signals to fire above their individual thresholds before the composite
score climbs into action territory, (b) shipping shadow mode as the
default for every new install, and (c) instrumenting an explicit
"mark false positive" flow so the FP rate is a number we can show, not a
number we have to guess. Tightened thresholds are reflected in
`composite.test.ts`.

## Accomplishments that we're proud of

- **Federation works end-to-end.** A ban in sub A becomes a hashed wiki
  record within seconds; sub B's cron picks it up on the next 2-minute
  tick; the next time the matching fingerprint posts in sub B, the
  modqueue badge fires. Demonstrated on three internal test subs and
  on `{TBD_FROM_METRICS}` beta-installed mod teams. *(Source:
  `peerSubs` count from `getMetricsSummary` + outreach tracker in
  `docs/OUTREACH_PLAYBOOK.md`.)*
- **No usernames or content leave a subreddit.** The threat record schema is
  enforced in `wikiPublisher.ts`: opaque hash fields, a category enum,
  and timestamps. We can prove this by reading the wiki page on camera,
  which is exactly what the 0:36 beat in the demo video does.
- **`{TBD_FROM_METRICS}` mod teams ran it in shadow mode** during the
  hackathon beta window (May 23–25), collectively indexing
  `{TBD_FROM_METRICS}` federated alerts and computing
  `{TBD_FROM_METRICS}` fingerprints. *(Source: `metrics:fed:alerts`
  and `metrics:flags` Redis keys, surfaced via `getMetricsSummary()`.)*

## What we learned

- **The transport layer is rarely the hard part.** We spent two days on a
  Cloudflare coordinator and one day deleting it once we understood the
  wiki primitive. The hard part is always the privacy contract and the
  scoring threshold, not the bytes-on-the-wire.
- **Shadow mode is a product feature, not a safety valve.** Every mod
  team we pitched specifically asked whether they could run it without
  it taking any action. Shipping shadow-by-default flipped the install
  conversation from a risk debate into a 90-second trial.
- **Polish wins narrow.** Cutting LLM stylometry, multi-language n-grams,
  and the bulk-historical-scan feature on Day 8 was the single best
  decision of the project. Week 4 was bug-fixing and UI copy, not
  fighting a fourth signal.

## What's next for Hive Restored

Based on beta feedback, the v2 priorities are:

- **LLM stylometry signal (BYO key).** Out of scope for v1 because of
  demo-day reliability risk. Now feasible behind a per-sub opt-in with
  the mod's own provider key.
- **Bulk historical scan.** "Score every user who posted here in the
  last 90 days" — beta mods asked for this on Day 24. Needs careful
  Redis quota planning.
- **Multi-language n-gram cadence.** English-only is a real ceiling for
  global subs; the function-word lists exist for ~12 languages and the
  SimHash pipeline is language-agnostic.
- **Federation across ≥50 subs in one circle.** The wiki transport's
  performance ceiling above ~30 peers is currently unknown; v2 needs
  load tests and a sharded poll cadence.
- **Mobile-optimized dashboard.** The current React dashboard is
  desktop-first; a touch-friendly layout is straightforward Tailwind work.

## Built With

`typescript`, `react`, `react-dom`, `devvit`, `devvit-web`, `hono`, `trpc`,
`tailwind-css`, `redis`, `zod`, `vite`, `vitest`, `superjson`, `eslint`,
`prettier`, `simhash`, `minhash`, `shannon-entropy`, `kl-divergence`,
`reddit-api`, `wiki-api`, `node`, `javascript`

## Try It Out

- **Install on your sub:** `{DEVVIT_APP_URL}`
- **Source on GitHub:** `{GITHUB_URL}`
- **90-second demo video:** `{DEMO_VIDEO_URL}`
- **Screenshots gallery:** `{SCREENSHOTS_GALLERY}`

---

## Project Impact

Numbers below pull from `getMetricsSummary()` in
`src/server/storage/metrics.ts` (Redis-backed lifetime counters) and from
the 5-question post-beta survey defined in
`docs/OUTREACH_PLAYBOOK.md`. Fill these on submission day. Do not invent
numbers — if a beta install didn't happen, write the internal-dogfood
honest version per the OUTREACH_PLAYBOOK fallback.

| Metric | Value | Source-of-truth |
|---|---|---|
| Time saved per mod per week | `{TBD_FROM_METRICS}` hours | Survey Q3 (OUTREACH_PLAYBOOK.md) |
| Catch rate (flagged → mod would have actioned anyway) | `{TBD_FROM_METRICS}` % | Survey Q1 (OUTREACH_PLAYBOOK.md) |
| False-positive rate | `{TBD_FROM_METRICS}` % | Survey Q2 + Redis key `metrics:fp` |
| Beta sub installs during hackathon | `{TBD_FROM_METRICS}` | Outreach tracker (OUTREACH_PLAYBOOK.md §Tracking) |
| Peer subs in trust circles (aggregate) | `{TBD_FROM_METRICS}` | Redis: count across `sub:{id}:trust` sets |
| Total fingerprints computed | `{TBD_FROM_METRICS}` | Redis key `metrics:flags` |
| Federated alerts indexed | `{TBD_FROM_METRICS}` | Redis key `metrics:fed:alerts` |
| Mod actions taken via Hive badge | `{TBD_FROM_METRICS}` | `getMetricsSummary().modActions.total` |
| Would-recommend signal (keep / recommend / uninstall) | `{TBD_FROM_METRICS}` | Survey Q5 (OUTREACH_PLAYBOOK.md) |

If beta installs land at zero, use the honest fallback line from
OUTREACH_PLAYBOOK.md §"If nobody bites": *"Shadow-mode metrics from
internal dogfood testing across N test subreddits, install path
validated end-to-end."*

---

## 3 communities that benefit

The three categories below are pulled from the outreach send list in
`docs/OUTREACH_PLAYBOOK.md` so the submission, the demo's preset trust
circle, and the live beta targets are all consistent.

**1. Mid-size hobby subs with affiliate-spam rings**
(e.g. r/buildapcsales ~1.4M, r/MechanicalKeyboards ~1M). These subs deal
with rotating scam-DM accounts that pivot domains as fast as mods can
ban them. The domain-history MinHash is purpose-built for exactly this
pattern — when the same monetized domain set surfaces under a new
username in a peer sub, the badge fires.

**2. Mental-health-adjacent and advice subs with karma-farm-then-DM rings**
(e.g. r/relationship_advice ~10M, r/personalfinance ~19M). The
ban-evasion pattern here is karma farming in a low-stakes sub, then
pivoting to scam DMs in a target sub. Posting-time entropy catches the
bot-rotation rhythm; n-gram cadence catches the LLM-templated reply
style across the sibling accounts.

**3. Tech-deal and high-volume product subs vulnerable to
fake-flash-sale rings.** These rings rely on speed: post the fake deal,
collect the clicks, get banned, return tomorrow as a fresh account. By
federating bans across the ~10 peer subs that share the same victim
audience, Hive shrinks the rings' usable window from hours to minutes.

---

## Submission checklist

Run through this Tuesday morning before pasting into Devpost. Each item
links to the file or section that proves it's done.

- [ ] **Demo video uploaded to YouTube/Vimeo, unlisted, link copied into
  `{DEMO_VIDEO_URL}`** above (per `docs/DEMO_SCRIPT.md` §"Final pre-flight")
- [ ] **All Devpost form sections filled** — Inspiration, What it does,
  How we built it, Challenges, Accomplishments, What we learned, What's
  next, Built With, Try It Out
- [ ] **GitHub repo is public** and `{GITHUB_URL}` updated above
- [ ] **README has install instructions** for a fresh mod
- [ ] **Screenshots gallery uploaded** to Devpost (at minimum: splash,
  modqueue badge open, dashboard threat-feed tab, dashboard action-log
  tab, trust-circle preset form)
- [ ] **All `{TBD_FROM_METRICS}` markers replaced** with real numbers
  (run `getMetricsSummary` against the production app, paste into the
  Project Impact table)
- [ ] **All `{TBD_*_URL}` placeholders replaced** with live links
- [ ] **Helper credits added** for anyone who helped from r/Devvit
  Discord — Helper Nominations submitted via Devpost (per `PLAN.md`
  Day 27 step)
- [ ] **Discord post drafted** for r/Devvit channel announcing the
  submission, with the demo link
- [ ] **Cross-post drafted** for r/Devvit and r/ModSupport per
  `docs/OUTREACH_PLAYBOOK.md` §Timeline Day 8
- [ ] **Submitted before 23:59 ET on May 27, 2026**
