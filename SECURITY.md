# security

hive restored is a federated bad-actor detector for reddit mods. this file
covers the privacy model, the trust model, known limits, and how to report
a vulnerability.

## privacy model

every published threat record is a small json blob on the publishing sub's
own `r/<sub>/wiki/hive-threats` page (`src/server/federation/wikiPublisher.ts`):

- `alertId` — random uuid, not derived from the target user
- `publishedAt` / `ttlAt` — iso timestamps; default ttl is 30 days
- `category` — allowlisted enum (`ban_evasion` / `spam` / `harassment` / `unknown`)
- `epoch` — the iso week (`yyyy-www`) the hashes were salted with
- `modHash` — sha256 of `hive-mod:<sub>:<moderator>` truncated to 16 hex chars
- `fingerprint.cadenceHash` — publisher-scoped salted simhash of function-word n-grams
- `fingerprint.domainHash` — publisher-scoped salted minhash of registrable domains
- `fingerprint.matchableV1` — deterministic opaque behavioral hashes that trusted peers can recompute for v1 matching
- `fingerprint.timeKL` / `cadenceAnomaly` / `domainAnomaly` / `composite` — scores

no usernames. no post bodies. no comment text. no url lists. no
subreddit-association api lookup. publisher context is visible because each
feed lives on that publisher's wiki. the content tokens that feed the cadence
hash are masked to a single sentinel before hashing, so the signal captures
stylistic rhythm and not topic. the matchable v1 hashes make peer matching
possible; they are opaque sketches, not a promise that a public observer with
full reddit activity cannot try correlation attacks.

## per-publisher salt + weekly rotation (c-1 mitigation)

the raw simhash / minhash functions are public and would otherwise be
trivially replayable — anyone could pull a sub's published feed, run the
same hashes over reddit's public new-comments stream, and link a hash back
to a username with high confidence. that defeats the whole privacy story.

mitigation (`src/server/federation/publisherSalt.ts`):

- each sub mints a random 32-byte secret on first use, stored under
  `secret:hive-fp:<sub>` (nx). the secret never leaves redis.
- publisher-local audit hashes are salted with `<secret>:<epoch>:` before
  hashing, where `epoch` is the iso week string.
- the public feed also includes `fingerprint.matchableV1`, an unsalted but
  content-free deterministic sketch. subscribers compare their own v1
  sketch against it; without this field, cross-sub matching cannot work.
- the secret rotates implicitly each week via the epoch, so a leaked
  secret only re-identifies one week of publisher-local hashes.

## trust model

peers are assumed to act in good faith. three structural guardrails:

- `pollPeer` rejects any feed whose declared `publisher` does not match
  the sub we asked (h-1, blocks trivial impersonation)
- `parseRawThreat` allowlists `category` before it reaches mod-note text
  (h-3, blocks markdown / control-char injection)
- the modnote builder strips `[]()<>` from every peer-supplied field

what we do **not** have yet: cryptographic mod-team identity. anyone with
wiki-write on `r/<theirSub>/wiki/hive-threats` is implicitly trusted to
publish honestly. signed records + webfinger-style identity proofs are
tracked as v2.

## known limitations

- **matchable hashes are correlation tokens.** v1 matching uses deterministic
  opaque behavioral hashes so a subscriber can recognize equivalent behavior
  from a trusted peer. they do not include usernames, raw text, or URL lists,
  but they should not be described as unlinkable anonymity tokens.
- **simhash collisions at small input sizes.** below ~400 tokens we refuse
  to publish a cadence hash; above that, hamming-distance ≤ 20 / 128
  occasionally co-locates similar but unrelated writers.
- **replay window.** ttl is 30 days; a stale wiki page can serve old
  records to a new subscriber for that long. subscribers de-dupe by
  `alertId` so re-publishing is a no-op.

## auto-action safety

shadow mode is on by default. auto-action is off by default. the
modqueue badge will not remove / ban anything until a mod explicitly
turns both off in the dashboard, and even then only when the composite
score meets the configured `flagThreshold`.

## reporting a vulnerability

email `<maintainer-email-placeholder>` with subject `hive: security`. do
not file public github issues for vulnerabilities — give us a chance to
patch. sla: triage within 7 days for high / critical.
