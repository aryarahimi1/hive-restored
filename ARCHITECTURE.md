# Hive Restored — Architecture

> Reddit's API price changes gutted the third-party moderation ecosystem. Cross-sub threat sharing — the thing that made tools like Saferbot useful — disappeared with it. Hive Restored brings federation back **inside Devvit**, with no external services and no shared infrastructure to operate.

## System overview

Hive Restored is a **single deployable unit** — a Devvit Web app installed per-subreddit through Reddit's App Directory. Inter-sub federation rides on Reddit's own wiki API: each publisher sub writes hashed threat records to its own `r/<sub>/wiki/hive-threats` page, and peer subs poll those wikis on a 2-minute cron.

```
┌──────────────────────┐                              ┌──────────────────────┐
│  Devvit App          │                              │  Devvit App          │
│  (Subreddit A)       │                              │  (Subreddit B)       │
│                      │   ┌──────────────────────┐   │                      │
│  • Triggers          │   │  r/A/wiki/           │   │  • Triggers          │
│  • Fingerprint       │──►│  hive-threats        │──►│  • Fingerprint       │
│  • Redis cache       │   │  (JSON, TTL'd,       │   │  • Redis cache       │
│  • Mod UI            │   │   no PII)            │   │  • Mod UI            │
│                      │   └──────────────────────┘   │                      │
│                      │   ┌──────────────────────┐   │                      │
│                      │◄──│  r/B/wiki/           │◄──│                      │
│                      │   │  hive-threats        │   │                      │
│                      │   └──────────────────────┘   │                      │
└──────────────────────┘                              └──────────────────────┘
       ▲                                                       ▲
       │                                                       │
   Mod (modqueue badge + dashboard)                       Mod (modqueue badge + dashboard)
```

**Why wikis as the broker.**
- Cross-sub wiki reads are an established Reddit primitive (AutoMod configs already live there).
- No external service → no HTTP allowlist friction, no "share Reddit data with third party" policy headwinds.
- $0 hosting cost; scales with Reddit.
- The transport is ~150 LOC of TypeScript across `src/server/federation/wikiPublisher.ts` + `src/server/federation/wikiSubscriber.ts`.

**Tradeoffs we accept.**
- Poll-based, 2 min cadence (cron `*/2 * * * *`, see `src/server/routes/scheduler.ts`) — peer alerts surface within 60–120s, plenty for moderation.
- Wiki pages are world-readable → fingerprints are one-way hashes, so this is safe (see `SECURITY.md`).
- Wiki rate limit ~1 edit/min and size cap → we batch, TTL-prune, and enforce a 5s per-sub write cooldown in `wikiPublisher.ts`.

---

## Devvit App (`src/`)

### Triggers (`src/server/routes/triggers.ts`)

| Trigger | Purpose | Hot path? |
|---|---|---|
| `onCommentSubmit` | Score author. If never-seen-in-sub, compute fingerprint. Match against indexed peer threats. Flag if hit. | Yes — must be fast (<300ms) |
| `onPostSubmit` | Same as above | Yes |
| `onModAction` | When a mod bans a user, look up their cached fingerprint and append a no-PII record to this sub's `hive-threats` wiki page | Async |
| `onAppInstall` | Initialise Redis keyspace, mint the per-sub publisher salt | One-shot |
| Scheduler (`scheduler.tasks.pollPeers`) | Every 2 min: poll every trusted peer's wiki, index new alerts, persist the last-poll summary | Cron |

### Storage (Devvit-managed Redis)

No external storage. All state lives in Devvit Redis. Keyspace conventions:

```
sub:{sub}:trust                     → JSON array of trusted peer sub names
sub:{sub}:settings                  → SubConfig (shadow mode, flag threshold, etc.)
secret:hive-fp:{sub}                → per-sub 32-byte salt (set NX at first use)

fp:{username}                       → StoredFingerprint (JSON, TTL 30d)

threat:{alertId}                    → PeerThreatRecord (JSON, TTL = ttlAt)
idx:threats:active                  → JSON string[] of active alertIds
idx:cadence:{first4hex}             → JSON string[] of alertIds sharing prefix
idx:domain:active                   → JSON string[] of alertIds with a domain hash
cursor:peer:{peerSub}               → last alertId seen from this peer (dedupe)

action-log:{sub}                    → sorted set (z), 30-day retention, 1000-entry cap
action-log:{sub}:entry:{id}         → ActionLogEntry JSON
metrics:flags / metrics:action:*    → lifetime counters
```

Total per-sub footprint estimate: ~5–20 MB for a 100K-member sub with active modqueue.

### Mod actions the app takes

- `reddit.remove(post|comment)` — only if shadow mode is off AND auto-action is on AND composite score ≥ `flagThreshold`
- `reddit.banUser(...)` — only from the modqueue badge form's Ban checkbox, after a mod ticks it and submits
- `reddit.addModNote(...)` — two surfaces, never automatic in shadow mode: (a) the badge form's "Add mod note" checkbox writes one when a mod submits the popover; (b) an auto peer-match mod note fires from `runMatchCheck` only when shadow mode is off and auto-action is on (see `shouldAutoWritePeerMatchModNote` in `src/server/routes/triggers.ts`).
- Default behaviour: **shadow mode** — surface the badge, take no action until a mod ticks a checkbox

### UI layers

- **Modqueue badge** (Devvit Web form, `src/server/routes/modqueueBadge.ts`): a structured popover opened from the modqueue mod menu. Shows score, signals, expandable peer-match evidence, and opt-in action checkboxes (mod note / remove / ban). Forms are the popover surface on Devvit Web — no Blocks.
- **Webview dashboard** (React 19 + Tailwind 4, `src/client/game.tsx` talking to `src/server/trpc.ts`): trust graph editor, threat feed, action log, settings, federation status. Backed by a Hono server (`src/server/index.ts`).
- **Mod menu actions** (`src/server/routes/menu.ts`): apply trust preset, view federation status, open dashboard.

---

## Fingerprinting

Details in `docs/FINGERPRINT_SPEC.md`. Three signals, all hash-based, all computed locally:

| Signal | Algorithm | Output | File |
|---|---|---|---|
| Time entropy | 24-bin hour histogram → Shannon entropy + KL divergence vs baseline | scalar anomaly | `src/server/fingerprint/timeEntropy.ts` |
| N-gram cadence | Function-word 2/3-grams → SimHash | 128-bit hex hash | `src/server/fingerprint/ngramCadence.ts` |
| Domain history | Registrable link domains → MinHash 64-sig | base64 signature | `src/server/fingerprint/domainHistory.ts` |

Composite score `0..100` in `src/server/fingerprint/composite.ts` weights the three signals and applies a multi-signal-agreement bonus when two or more anomalies fire on the same author. Weights and the flag threshold are configurable per-sub.

**Why hashes, not features.** Federated sharing must be one-way: a peer sub can compare an incoming user against your published threat hashes, but can't reverse-engineer who you banned, what they wrote, or what links they posted. SimHash + MinHash both support similarity over hashes without recovering content.

---

## Federation protocol

### Publish (`src/server/federation/wikiPublisher.ts`)

When a mod bans a user, the app looks up the cached fingerprint for that author, builds a no-PII record, and appends it to this sub's `r/<sub>/wiki/hive-threats` page via `reddit.updateWikiPage`. Each record contains:

```jsonc
{
  "alertId": "uuid",
  "publishedAt": "iso8601",
  "ttlAt": "iso8601",                       // default 30d
  "category": "ban_evasion" | "spam" | "harassment" | "unknown",
  "epoch": "YYYY-Www",                      // ISO week the hashes were salted with
  "modHash": "sha256(hive-mod:<sub>:<mod>)[:16]",
  "fingerprint": {
    "timeKL": 0.42,
    "cadenceHash": "<publisher-salted simhash>",
    "domainHash":  "<publisher-salted minhash>",
    "composite": 78,
    "matchableV1": { "version": 1, "cadenceHash": "...", "domainHash": "..." }
  }
}
```

No usernames. No post bodies. No URLs. Publisher attribution is intrinsic (the feed lives on that sub's wiki).

### Subscribe (`src/server/federation/wikiSubscriber.ts`)

`pollPeer(peerSub)` fetches `r/<peerSub>/wiki/hive-threats` via `reddit.getWikiPage`, validates that the feed's declared `publisher` matches the sub we asked, allowlists the `category`, and indexes each new alert into three JSON-array index keys (`idx:threats:active`, `idx:cadence:<prefix>`, `idx:domain:active`). The scheduler walks the trust graph sequentially each cron tick.

### Match (`src/server/federation/threatMatcher.ts`)

On every comment/post submit from a fingerprinted author:

- **Cadence**: look up candidates in `idx:cadence:<first4hex>`, compute Hamming distance against each, accept ≤ 20/128 (~84% similarity).
- **Domain**: scan `idx:domain:active`, decode MinHash signatures, accept Jaccard ≥ 0.55.
- Return top 3 matches by similarity. Cadence wins over domain on ties (only one signal counts per alertId).

### Trust graph

Per-sub Redis set of trusted peer subs (`src/server/storage/trustGraph.ts`). Trust is **explicit and reciprocal-in-intent but not enforced** — adding a peer just means "I will poll their wiki." Three opt-in presets (`starter` / `midsize` / `large`) in `src/server/install/presets.ts`; a mod must explicitly choose one from the menu and submit the form. Mod-only form-submit handlers under `/internal/forms/*` gate every mutation via `src/server/moderator.ts`.

### Auth

There is no shared service to authenticate against. Wiki writes are authenticated by Reddit itself — only the app installed in a sub can update that sub's wiki via `reddit.updateWikiPage`. Cross-sub trust is "I added this sub to my trust graph and I trust whoever mods it." Cryptographic mod-team identity is tracked as v2 (see `SECURITY.md`).

### Anti-poisoning

Bad-faith mods could publish bogus threats. Mitigations live in code today:

- **`pollPeer` rejects mismatched publishers** — blocks trivial impersonation.
- **`parseRawThreat` allowlists `category`** — blocks markdown / control-char injection into mod-note text.
- **`sanitiseForModNote` strips `[]()<>`** from every peer-supplied field before mod-note rendering.
- **One-click "remove peer"** in dashboard, undoable from the action log (`src/server/storage/actionLog.ts`).
- **Per-publisher reputation counters** (`src/server/storage/peerReputation.ts`) — false-positive marking lands in v1.1.

---

## Privacy & compliance posture

`SECURITY.md` is canonical. Summary:

- **No user PII leaves a subreddit.** Published records are hashes + allowlisted enums + timestamps.
- **Per-publisher salt with weekly epoch rotation** (`src/server/federation/publisherSalt.ts`) defeats trivial replay: an attacker who scrapes a public feed cannot rehash Reddit's public new-comments stream to recover usernames. A separate unsalted `matchableV1` sketch is what peers actually match on.
- **Publisher attribution by construction.** Each feed lives on its publisher's wiki — no anonymous publish.
- **Right to delete.** A sub can wipe its `hive-threats` page in one wiki edit; peers prune via the alert's `ttlAt`.
- **Auditable.** Action log retains 30 days per sub with undo support for peer add/remove (`appendActionLog` / `undoActionEntry`).

---

## Performance & cost

- **Per-comment hot path**: 1 Redis GET (is-user-fingerprinted), if miss → 1 Reddit API call (user history), 3 hash computations (~8ms total), 3 Redis SETs, 1 prefix-index lookup against `idx:cadence:<first4hex>` + 1 scan of `idx:domain:active`. Total <100ms cold, <10ms warm.
- **Per peer poll**: ~150ms; sequential sweep of ~30 peers finishes well inside the 2-min cron tick.
- **Hosting cost**: $0. Devvit-managed Redis + Reddit's wiki API. No third-party services.
- **No LLM inference.** Pure deterministic hashing keeps costs zero and demos reliable.

---

## What we are NOT building (and why)

- ❌ **External coordinator service** — wikis are the broker; no Worker, KV, D1, or Durable Objects.
- ❌ **Real-time pub/sub** — 2-min polling is enough for moderation; websockets are operational complexity we don't need.
- ❌ **ML model training** — hand-tuned weights win in 4 weeks; ML loses to data starvation.
- ❌ **Cross-platform threat sharing (Discord, Mastodon)** — Reddit-only keeps the policy story clean.
- ❌ **Cryptographic mod-team identity** — tracked as v2; v1 trusts whoever has wiki-write on a peer sub.
