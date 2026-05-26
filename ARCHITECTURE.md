# Hive Restored — Architecture

> 🔄 **REVISION — May 18, 2026.** Per community guidance in r/Devvit, federation now runs through **Reddit's own wiki API**, not an external Cloudflare Worker. All threat hashes live in each publisher sub's `r/<sub>/wiki/hive-threats` page; peers poll those wikis. The original Cloudflare design in `coordinator/` is preserved as **Plan B** in case wiki size/rate limits or policy review forces a return to it.
>
> **What this changes vs. the diagram below:**
> - No external coordinator service in MVP — delete the middle box, replace with "Reddit Wiki"
> - No HMAC / Ed25519 signing needed — Reddit's API auth handles writer authentication
> - No HTTP allowlist needed — all calls go through `context.reddit.*`
> - Policy story becomes trivial: "we use wikis the same way AutoModerator does"
> - Polling cadence ~60s; publish via `reddit.updateWikiPage()`; subscribe via `reddit.getWikiPage()`
>
> The trigger logic, fingerprint signals, Redis schemas, Mod UI, trust graph, and threat record format are all **unchanged**. Only the transport layer is different. See `src/federation/wikiBroker.ts` for the new implementation surface.

## System overview (Plan B / original Cloudflare design — preserved for reference)

Hive Restored is a **single deployable unit** — a Devvit app installed per-subreddit through Reddit's App Directory. Inter-sub federation rides on Reddit's own wiki API: each publisher sub writes hashed threat records to its own `r/<sub>/wiki/hive-threats` page, and peer subs poll those wikis.

```
┌──────────────────────┐                              ┌──────────────────────┐
│  Devvit App          │                              │  Devvit App          │
│  (Subreddit A)       │                              │  (Subreddit B)       │
│                      │   ┌──────────────────────┐   │                      │
│  • Triggers          │   │  r/A/wiki/           │   │  • Triggers          │
│  • Fingerprint       │──►│  hive-threats        │──►│  • Fingerprint       │
│  • Redis cache       │   │  (JSON, append-only, │   │  • Redis cache       │
│  • Mod UI            │   │   TTL'd, no PII)     │   │  • Mod UI            │
│                      │   └──────────────────────┘   │                      │
│                      │   ┌──────────────────────┐   │                      │
│                      │◄──│  r/B/wiki/           │◄──│                      │
│                      │   │  hive-threats        │   │                      │
│                      │   └──────────────────────┘   │                      │
└──────────────────────┘                              └──────────────────────┘
       ▲                                                       ▲
       │                                                       │
   Mod (modqueue + comment-menu badge)                    Mod (modqueue + comment-menu badge)
```

**Why wikis as the broker.**
- Cross-sub wiki reads are an established Reddit primitive (AutoMod configs already live there).
- No external service → no HTTP allowlist friction, no "share Reddit data with third party" policy headwinds.
- $0 hosting cost; scales with Reddit.
- The transport is ~150 LOC of TypeScript across `wikiPublisher.ts` + `wikiSubscriber.ts`.

**Tradeoffs we accept.**
- Poll-based, ~2 min cadence (cron `*/2 * * * *`) — peer alerts surface within 60–120s, plenty for moderation.
- Wiki pages are world-readable → fingerprints are one-way hashes, so this is safe.
- Wiki rate limit ~1 edit/min and size cap ~500KB → we batch + TTL-prune.

---

## Devvit App (`src/`)

### Triggers

| Trigger | Purpose | Hot path? |
|---|---|---|
| `onCommentSubmit` | Score author. If never-seen-in-sub, compute fingerprint. Match against incoming threat feed. Flag if hit. | Yes — must be fast (<300ms) |
| `onPostSubmit` | Same as above | Yes |
| `onModAction` | When a mod bans a user, publish that user's fingerprint to the coordinator with the action category | Async (scheduled) |
| `onAppInstall` | Initialize Redis schema, prompt mod through setup wizard | One-shot |
| Scheduler (`@devvit/scheduler`) | Nightly: refresh fingerprints for users seen today; trim Redis caches; sync trust graph | Daily |

### Storage (Devvit Redis)

Keyspace conventions:

```
sub:{subredditId}:config              → SubConfig (JSON)
sub:{subredditId}:trust               → Set<peerSubredditId>
sub:{subredditId}:signals             → SignalConfig (which signals on, weights)

user:{userId}:fingerprint             → Fingerprint (JSON, TTL 30d)
user:{userId}:seen-in:{subredditId}   → boolean + first-seen timestamp (TTL 30d)

threat:{hash}                         → ThreatRecord (JSON, TTL 90d)
threat:index:bytime                   → Sorted set (score = unix ts) for feed

action-log:{subredditId}              → Stream (last 1000 actions, TTL 30d)
```

Total per-sub footprint estimate: ~5–20 MB for a 100K-member sub with active modqueue. Comfortable inside any reasonable Devvit Redis quota.

### Mod actions the app takes

- `reddit.remove(post|comment)` — only if mod opted into auto-action
- `reddit.banUser(...)` — only if mod opted into auto-action AND composite score ≥ threshold
- `reddit.sendModmail(...)` — opt-in template for "low-trust account" notice
- `reddit.addModNote(...)` — every flag adds a modnote with the score + signals that fired
- Default behavior: **shadow mode** — surface the badge in modqueue UI, take no action

### UI layers

- **Modqueue badge** (Devvit Blocks): popover over a flagged item showing score, signals, "evidence" expandable, action buttons
- **Webview dashboard** (Devvit Web + React): trust graph editor, threat feed, action log, settings
- **Custom post (optional)**: "weekly hive report" — a public, anonymized digest mods can pin

---

## Fingerprinting

Details in `docs/FINGERPRINT_SPEC.md`. High-level:

| Signal | Algorithm | Output | Compute cost |
|---|---|---|---|
| Time entropy | 24-bin hour histogram → KL divergence vs baseline → LSH | 64-bit hash | <1ms |
| N-gram cadence | Function-word 2/3-grams → top-32 → SimHash | 128-bit hash | <5ms |
| Domain history | External link domains → MinHash 64-sig | 64×8-byte signature | <2ms |

Composite score `0..100` is a weighted match score against the most-similar threat in the feed. Weights configurable per-sub.

**Why hashes, not features.** Federated sharing must be one-way: a peer sub can compare an incoming user against your published threat hashes, but can't reverse-engineer who you banned, what they wrote, or what links they posted. SimHash + MinHash both support similarity over hashes without recovering content.

---

## Federation protocol

### Publish (sub → coordinator)

When a mod bans a user (manually or via auto-action), the app posts:

```json
POST /v1/publish
Authorization: HMAC-SHA256 <signature>
X-Sub: t5_abc123
Content-Type: application/json

{
  "v": 1,
  "ts": 1747500000,
  "sub": "t5_abc123",
  "category": "scam_dm" | "ai_spam" | "ban_evasion" | "brigade" | "other",
  "severity": 1..3,
  "fingerprint": {
    "time": "base64(64-bit hash)",
    "cadence": "base64(128-bit hash)",
    "domains": "base64(64-sig MinHash)"
  },
  "ttl_days": 30
}
```

No usernames. No content. No subreddit-of-origin disclosure to non-trusted subs.

### Subscribe (sub → coordinator)

```
GET /v1/threats?since=<ts>
Authorization: HMAC-SHA256 <signature>
```

Returns threat records published by subs in the requesting sub's trust graph. Subs only see what their trusted peers published.

### Trust graph

Bi-directional: sub A must add sub B AND sub B must add sub A for sharing in both directions. The coordinator enforces this. One-way invites supported (a small sub can subscribe to a big sub's feed without reciprocating).

### Auth

Each sub generates a 32-byte secret at install. Stored in Devvit app secrets (per-sub setting). All coordinator requests are HMAC-signed. Coordinator stores only the public sub ID + a hashed verifier of the secret (so it can verify without storing the secret).

### Anti-poisoning

Bad-faith mods could publish bogus threats. Mitigations:
- **Reputation per publishing sub** — peers see "this sub has had X% of its threats marked false-positive by your team"
- **Per-publisher rate limits** — coordinator enforces max N publishes/hour/sub
- **Mod-team-of-N attestation** — for high-severity categories, require 2 distinct mods to confirm before publish
- **One-click "stop trusting this sub"** in dashboard

---

## Coordinator service (`coordinator/`)

**Stack**: Cloudflare Worker + Workers KV (threat index) + D1 (trust graph + per-sub config) + Durable Objects (rate limit counters).

**Why Cloudflare**: free tier covers hackathon-scale traffic, global edge (low latency for any sub), zero ops.

**Endpoints**:

```
POST   /v1/publish              ← publish threat record
GET    /v1/threats?since=<ts>   ← poll threat feed (apps poll every 60s)
POST   /v1/trust                ← add/remove peer sub in trust graph
GET    /v1/trust                ← list current trust graph
POST   /v1/feedback             ← mark a threat as false-positive (reputation signal)
GET    /v1/health               ← uptime check
```

Stateless from app's POV; coordinator state is recoverable from app-side Redis (each app keeps a copy of its own publishes).

---

## Privacy & compliance posture

- **No user PII leaves a subreddit.** Coordinator stores only hashes + opaque category codes.
- **No subreddit names in threat records by default.** Mods can opt in to attribution (helpful for transparency in their dashboard).
- **Opt-in everywhere.** Trust graphs are explicit. Signal sharing is per-signal opt-in.
- **Right to delete.** A sub can wipe its published threats with one call; coordinator removes them within 60 seconds.
- **Auditable.** Every published record has a `ts` + originating sub ID; mods see exactly what their sub has published in the dashboard.

This posture is what we'll get pre-cleared with Reddit dev support on Day 1.

---

## Performance & cost (back of envelope)

- **Per-comment hot path**: 1 Redis GET (is-user-seen), if miss → 1 Reddit API call (user history, ~100 items), 3 hash computations (~8ms total), 3 Redis SETs, 1 coordinator threat-feed lookup (cached in-memory, refreshed every 60s). Total <100ms for cold users, <10ms for warm users.
- **Coordinator**: ~$5/month at 50 active subs. Free tier comfortably to 100K requests/day.
- **No LLM inference in MVP.** Pure deterministic hashing keeps costs zero and demos reliable.

---

## What we are NOT building (and why)

- ❌ **Real-time pub/sub** — coordinator polling at 60s cadence is enough; a websocket fanout is operational complexity we don't need
- ❌ **ML model training** — hand-tuned weights win in 4 weeks; ML loses to data starvation
- ❌ **Browser extension companion** — Devvit covers the surface
- ❌ **Cross-platform threat sharing (Discord, Mastodon)** — Reddit-only keeps the policy story clean
