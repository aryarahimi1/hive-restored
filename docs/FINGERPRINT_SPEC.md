# Hive Restored — Fingerprint Spec (MVP, 4-week)

Status: Draft v0.1
Scope: Three behavioral fingerprint signals shipped in the MVP, their federation payload, and composite scoring.
Runtime: Devvit (TypeScript), Redis-backed, `context.reddit.getCommentsAndPostsByUser(username, { limit: 100 })`.

Design goals:
1. Cheap per-user evaluation (target < 50 ms compute, < 8 KB Redis write).
2. No raw user content leaves the host sub — peers only receive fixed-size hashes.
3. Coordinator stores hashes only; similarity comparisons are pure functions of hashes.
4. LLM calls are reserved for high-suspicion candidates (`composite >= 65`).

---

## 0. Shared types and helpers

```ts
type UserFingerprint = {
  username_hmac: string;     // HMAC-SHA256(username, sub_salt), 16 bytes hex
  observed_at: number;       // unix seconds
  item_count: number;        // # of items used to build the fingerprint
  time_fp:    TimeFp   | null;
  ngram_fp:   NgramFp  | null;
  domain_fp:  DomainFp | null;
};

// All three signals return null when below their minimum-data threshold.
```

Hash widths are chosen to fit Redis hash fields and stay small over the federation websocket: 64-bit signals are stored as hex (16 chars), the 128-bit SimHash as hex (32 chars).

---

## 1. Posting-time entropy signature

### Intuition
Humans have a diurnal cycle: most users concentrate ~80% of activity inside an 8–10 hour window. Karma-farm bots either (a) post uniformly across 24 h or (b) post on rigid scheduled intervals (`cron`-like). Both deviate from the human baseline in opposite directions — uniformity raises Shannon entropy, rigid scheduling lowers autocorrelation variance. We capture both with a single 24-bin histogram plus a quantized "shape" hash.

### Input
Last N (≤100) item timestamps from `getCommentsAndPostsByUser`. UTC seconds. No content needed.

### Algorithm

```text
function buildTimeFp(timestamps: number[]): TimeFp | null:
  if timestamps.length < 20: return null              // see minimum-data section

  hist = new Float32Array(24).fill(0)
  for t in timestamps:
    hour = (t / 3600) mod 24            // UTC; do NOT localize, we don't know TZ
    hist[hour] += 1
  normalize hist so sum(hist) == 1      // probability vector p

  // Shannon entropy (max = log2(24) ≈ 4.585)
  H = -Σ p[i] * log2(p[i] + 1e-12)

  // KL divergence vs human baseline q (precomputed from a large sample
  // of mod-trusted users in your sub; see baseline section)
  KL = Σ p[i] * log2((p[i] + 1e-12) / (q[i] + 1e-12))

  // Quantize p to a 64-bit LSH fingerprint:
  //  - For each adjacent pair of bins (12 pairs), set 1 bit for which is larger.
  //  - For each of 12 "sectors" (2 hours each), set 1 bit for above/below median.
  //  - Pack high-entropy flag (1 bit) + reserved (1 bit) + KL bucket (6 bits, 0..63).
  bits = packBits([
    pairwiseGreaterFlags(p),    // 12 bits
    sectorAboveMedianFlags(p),  // 12 bits
    sortedRankNibbles(p, 4),    // 32 bits: top-8 hour ranks, 4 bits each
    H > 4.0 ? 1 : 0,            // 1 bit (suspicious uniformity)
    0,                          // 1 bit reserved
    clamp(KL * 8, 0, 63)        // 6 bits
  ])
  return { hist_hash: bits.toHex(), H, KL, bin_count: 24 }
```

The 64-bit hash is *not* a pure LSH — the high 56 bits encode shape (Hamming-comparable across users) and the low 8 bits encode magnitude (compared with absolute difference, not Hamming).

### Baseline `q`
Compute once per sub: sample 500–2000 long-tenured non-removed commenters, average their normalized histograms. Store as a 24-float vector in Redis under `hive:baseline:time:<sub>`. Refresh monthly.

### Output (stored + federated)
```ts
type TimeFp = {
  hist_hash: string;   // 16 hex chars (64 bits)
  H:  number;          // Shannon entropy, 0..log2(24)
  KL: number;          // KL vs sub baseline
  bin_count: number;   // observation count (for confidence weighting)
};
```

### Similarity
```text
function timeMatch(a: TimeFp, b: TimeFp): number in [0,1]:
  shapeHam = hamming(a.hist_hash[high 56 bits], b.hist_hash[high 56 bits])
  shapeSim = 1 - shapeHam / 56
  klDelta  = abs(a.KL - b.KL)
  klSim    = exp(-klDelta)                // close KL => same anomaly profile
  return 0.7 * shapeSim + 0.3 * klSim
```

Match thresholds (per-account suspicion, not pairwise):
- `H > 4.3` (within ~6% of uniform): **flag uniformly-posting bot**
- `KL > 1.5` and `H < 3.0`: **flag rigid-schedule bot** (peaked at unhuman hours)
- Pairwise `timeMatch > 0.85` AND both `KL > 0.8`: **ring candidates**

### False positives & mitigations
- **Shift workers / overseas users**: high KL vs a US-centric baseline. Mitigation: compute baseline per sub; weight `KL` lower if user has > 6 months tenure and clean modlog.
- **Genuinely uniform users (insomniacs)**: rare but real. Mitigation: time signal *alone* never bans — it must be combined.
- **New baseline drift**: refresh `q` monthly with rolling sample.

### Compute cost
24-bin histogram + entropy + KL + bit packing over ≤100 timestamps: O(N) with N≤100. Measured target: < 0.5 ms. No I/O beyond Redis read of baseline (cache in memory for 1 h).

### Why it can't be gamed cheaply
To match a human profile, an attacker must (a) localize per account to a plausible TZ, (b) inject jitter that matches human autocorrelation, and (c) run a posting scheduler that wakes/sleeps. Doable but pushes cost-per-account up by 5–10x and removes the bot's main advantage (parallel 24/7 farming).

---

## 2. N-gram writing cadence hash

### Intuition
LLM-driven karma farms share a base model and a small prompt library, so they emit characteristic *function-word skeletons* — "I just wanted to", "would highly recommend", "in my experience as a". Matching on rare nouns or named entities would falsely link any two users talking about the same topic, so we restrict the n-gram alphabet to **function words + closed-class tokens** (stopwords, punctuation classes, pronoun/aux/conj/prep, plus POS-coarse markers for content words).

### Input
Concatenated body text from the last ≤100 comments + selftext posts. Strip code blocks, quote blocks, and URLs *before* tokenization (URLs go to signal 3).

### Algorithm

```text
STOPWORDS  = curated 180-word list (en) + punctuation classes {.,!?;:}
CONTENT_TAG = "<W>"   // replaces any non-stopword content token

function tokenizeForCadence(text: string): string[]:
  lowercase
  strip URLs, code fences, quote lines
  split on whitespace + punctuation; keep punctuation as tokens
  for each tok:
    if tok in STOPWORDS: emit tok
    elif tok is punctuation class: emit class symbol
    else: emit CONTENT_TAG

function buildNgramFp(allBodies: string[]): NgramFp | null:
  if total non-stopword tokens across bodies < 400: return null

  counts = map<string, int>()
  for body in allBodies:
    toks = tokenizeForCadence(body)
    for i in 0..len(toks)-2: counts[toks[i] + " " + toks[i+1]] += 1
    for i in 0..len(toks)-3: counts[toks[i..i+3].join(" ")] += 1

  // Drop n-grams that are all CONTENT_TAG or all punctuation
  filter counts where ngram has >= 1 stopword token

  // Keep top K=32 by frequency, ties broken by lexicographic
  topK = topNByCount(counts, 32)

  // SimHash to 128 bits
  v = new Int32Array(128).fill(0)
  for (gram, c) in topK:
    h = sha1(gram).first128bits()
    weight = log2(1 + c)
    for bit i in 0..127:
      v[i] += (h.bit(i) ? +weight : -weight)
  fp_bits = pack bits where v[i] > 0

  return {
    simhash: fp_bits.toHex(),     // 32 hex chars
    k_features: 32,
    token_total: totalTokens
  }
```

### Output (stored + federated)
```ts
type NgramFp = {
  simhash: string;    // 32 hex chars (128 bits)
  k_features: number; // 32
  token_total: number;
};
```

### Similarity
```text
function ngramMatch(a: NgramFp, b: NgramFp): number in [0,1]:
  ham = hamming128(a.simhash, b.simhash)
  if ham <= 18: return 1.0           // near-certain ring match (≥ 86% bit agreement)
  if ham <= 28: return 1.0 - (ham-18)/20   // graded
  return 0
```

Thresholds calibrated against the SimHash random-collision rate: for 128-bit, random pairs cluster around Hamming 64 with σ≈5.66, so Hamming ≤ 28 is > 6σ from random. We start strict at ≤18 and loosen per-sub via dashboard.

### False positives & mitigations
- **Two members of the same niche community** that both use a "host" register (mods, customer-service-trained users). Mitigation: function-word-only n-grams removes topic linkage; the residual style overlap is the *intended* signal, but we require ≥ 2 matches across distinct authors before any ring escalation.
- **Short-comment users** (one-liners). Mitigation: `token_total < 400` returns null (handled by minimum-data section).
- **Translated content**: tokenize as best-effort; non-English users will tend to score low matches against the English-stopword skeleton, which is fine (they won't false-positive against English bot rings) but means we don't catch non-English bot rings in MVP. Tracked for v0.2.

### Compute cost
~100 bodies × ~60 tokens avg = 6 k tokens. Tokenize + count + top-32 + SimHash over 32 features × 128 bits = < 5 ms in V8. SHA-1 is the dominant cost; cache per-ngram hashes in a Redis LRU keyed by ngram string for repeat features across users.

### Why it can't be gamed cheaply
Defeating this requires either (a) per-account prompt diversification (raises LLM cost ~3x and degrades quality), or (b) post-generation paraphrase with a *different* base model (doubles inference cost and still leaks function-word distribution from the paraphraser). Either way, the cost-per-karma economics break for the spammer.

---

## 3. Domain-link history hash

### Intuition
Scam rings cycle accounts but reuse a fixed inventory of destination domains (affiliate shorteners, sketchy storefronts, lookalike domains). Domain sets are small (typically 5–50), changes are slow, and Jaccard similarity over MinHash gives us a cheap, federation-safe estimate.

### Input
All external links extracted from post URLs, selftext markdown, and comment bodies in the last ≤100 items. Reduce each URL to its *registrable* domain (eTLD+1) via the Public Suffix List. Drop reddit.com, redd.it, imgur.com, and any other allowlisted same-platform domains (configurable per sub).

### Algorithm

```text
function buildDomainFp(items): DomainFp | null:
  domains = set<string>()
  for item in items:
    for url in extractUrls(item):
      d = registrableDomain(url)
      if d not in ALLOWLIST and d not in DENY_NOISE: domains.add(d)

  if domains.size < 3: return null

  // 64 MinHash signatures
  K = 64
  HASHES = precomputed 64 (a_i, b_i) pairs, a_i odd, b_i any, mod (2^61 - 1)
  sig = new Uint32Array(K).fill(0xFFFFFFFF)
  for d in domains:
    h0 = murmur3_32(d)
    for i in 0..K-1:
      hi = (HASHES[i].a * h0 + HASHES[i].b) mod (2^61-1)
      hi32 = hi & 0xFFFFFFFF
      if hi32 < sig[i]: sig[i] = hi32

  return {
    minhash: base64(sig),     // 256 bytes -> 344 base64 chars
    n_domains: domains.size
  }
```

### Output (stored + federated)
```ts
type DomainFp = {
  minhash: string;    // base64 of 64×uint32 = 344 chars
  n_domains: number;
};
```

### Similarity
```text
function domainMatch(a: DomainFp, b: DomainFp): number in [0,1]:
  agree = count(i in 0..63 where a.sig[i] == b.sig[i])
  return agree / 64    // unbiased Jaccard estimator
```

Per-sub thresholds (default):
- `>= 0.55` → strong ring evidence
- `0.30..0.55` → contributing signal
- `< 0.30` → ignored

### False positives & mitigations
- **News/discussion subs** where many users link the same outlets. Mitigation: aggressive `DENY_NOISE` list of top-200 globally-linked domains, refreshed weekly per sub from the sub's own top-linked-domain stats; remove any domain appearing in > 5% of recent legit users' fingerprints (TF-IDF-style domain weighting).
- **Single overlapping affiliate**: 1 shared domain over small sets can inflate Jaccard. Mitigation: require `n_domains >= 5` on *both* sides for a ring match to register.

### Compute cost
~100 items, ~150 URLs max, eTLD+1 resolution via cached PSL trie: < 2 ms. MinHash with 64 hashes × ≤50 domains: ~3 k ops, < 1 ms.

### Why it can't be gamed cheaply
To defeat this, the ring must (a) maintain a per-account disjoint domain inventory (linear scaling of domain registration cost, the spammer's actual scarce resource), or (b) route through a churning shortener (then the shortener domain itself becomes the shared link, instantly visible). The economics force the ring back into the open.

---

## 4. Minimum data thresholds

Each signal returns `null` when input is too thin, and the composite scorer skips null signals (re-weighting the rest).

| Signal | Minimum | Rationale |
|---|---|---|
| Time entropy | 20 timestamps | Below 20, histogram noise dominates; KL is unstable. |
| N-gram cadence | 400 tokens total across all bodies | Top-32 features unreliable below this; SimHash gets noisy. |
| Domain links | 3 distinct external registrable domains | MinHash on < 3 items has too few signatures populated. |

New-account handling: if all three signals are null, return `composite = null` and surface to the mod as "insufficient history — manual review". Do *not* auto-ban from a null fingerprint. For accounts where 1–2 signals are available, the composite is computed over the present signals with the absent ones contributing 0 weight (see below).

---

## 5. Composite score

A peer match returns up to three per-signal similarities `s_time`, `s_ngram`, `s_domain` ∈ [0,1]. Standalone suspicion (no peer match) uses per-signal anomaly flags from sections 1–3 (uniformity, rigid-schedule, etc.) projected to [0,1].

```text
function composite(s_time?, s_ngram?, s_domain?): number in [0,100] | null:
  weights = { time: 0.20, ngram: 0.45, domain: 0.35 }   // ngram is hardest to game
  num = 0; den = 0
  for k in [time, ngram, domain]:
    if s_k != null:
      num += weights[k] * s_k
      den += weights[k]
  if den == 0: return null
  base = (num / den) * 100

  // Multi-signal bonus: rings tend to trip ≥ 2 signals; bonus reflects that.
  present = count of non-null s_k
  if present == 3 and min(s_time, s_ngram, s_domain) > 0.4:
    base = min(100, base + 8)
  if present == 2 and both > 0.5:
    base = min(100, base + 4)

  return round(base)
```

Mod-UI band suggestions:
- `0–34`: green (no action)
- `35–54`: yellow (watch / soft-throttle)
- `55–74`: orange (queue for human mod review; eligible for LLM second-pass)
- `75–100`: red (auto-remove pending mod confirm; auto-publish federation payload on confirmed ban)

LLM gating: only call the OpenAI-backed style classifier when `composite >= 65` AND at least the n-gram signal is present.

---

## 6. Federation payload

Published to the coordinator when a host sub takes a confirmed mod action. The payload contains only hashes, opaque enums, and timestamps — never usernames-of-victims, raw content, or any subreddit-association data.

```json
{
  "schema": "hive.fingerprint.v1",
  "publisher_sub_hmac": "b1f6...e2",
  "publisher_pubkey_id": "ed25519:2026-05",
  "signature": "base64-ed25519-sig-over-canonical-json",
  "user_hmac": "8c44...91",
  "action": {
    "category": "BAN_SPAM_RING | BAN_EVASION | BAN_SCAM_DM | REMOVE_REPEAT | OTHER",
    "confidence": 87,
    "issued_at": 1747526400
  },
  "fingerprint": {
    "observed_at": 1747526100,
    "item_count": 92,
    "time_fp":   { "hist_hash": "a1b2c3d4e5f60718", "H": 3.41, "KL": 0.62, "bin_count": 92 },
    "ngram_fp":  { "simhash": "9c8e...d2", "k_features": 32, "token_total": 5421 },
    "domain_fp": { "minhash": "base64-256B...", "n_domains": 11 }
  },
  "ttl_days": 180,
  "revocation_url": "https://hive.example/revoke/<token>"
}
```

Canonicalization: JCS (RFC 8785) before signing. Coordinator verifies signature against the publisher's rotating Ed25519 key. Each `user_hmac` is `HMAC-SHA256(username_lowercased, FEDERATION_SHARED_SALT)` — the salt is shared across all peers so the same user produces the same `user_hmac` everywhere, but the username cannot be brute-forced from the hash without the salt (kept in a hardware-backed secret store on the coordinator and rotated yearly with a 30-day overlap).

A peer sub receiving the payload runs `timeMatch`, `ngramMatch`, `domainMatch` against its own locally-stored fingerprints for users currently active in modqueue and surfaces matches to its mods. Crucially: the coordinator stores fingerprints, not users; lookup is fingerprint-similar-to-fingerprint, not user-id lookup, which preserves the "no subreddit association" property.

Revocation: a publisher can POST to `revocation_url` to retract a payload (false-positive correction). Peers honor revocations within 24 h; coordinator broadcasts.

---

## 7. Implementation checklist (4-week MVP)

- Week 1: Devvit scaffold, Redis schemas, `fetchUserHistory`, time signal end-to-end, baseline sampler.
- Week 2: N-gram tokenizer (stopword list, content-tag substitution), SimHash, top-K extraction; domain extractor with PSL + allowlist UI.
- Week 3: Federation client (Ed25519 signing, JCS), coordinator stub, peer-pull and on-demand match; composite scorer; mod-UI panel.
- Week 4: Calibration against historical ban data from 2–3 partner subs; threshold tuning; LLM second-pass for `composite >= 65`; revocation flow; load test at 50 req/s per sub.

End of spec.
