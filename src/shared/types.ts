/**
 * src/types.ts
 *
 * Canonical shared TypeScript interfaces for the hive-restored federated
 * moderation system. All modules import from here — never define domain
 * types inline. Keep this file free of runtime code; types only.
 */

// ---------------------------------------------------------------------------
// Opaque / branded primitives
// ---------------------------------------------------------------------------

/** A Reddit subreddit name, e.g. "r/programming". */
export type SubredditId = string & { readonly __brand: "SubredditId" };

/** A Reddit account's t2_ fullname, e.g. "t2_abc123". */
export type UserId = string & { readonly __brand: "UserId" };

/** An ISO-8601 UTC timestamp string, e.g. "2026-05-18T14:30:00Z". */
export type ISOTimestamp = string & { readonly __brand: "ISOTimestamp" };

/**
 * An opaque content hash string. The exact algorithm (SimHash, MinHash, etc.)
 * is an implementation detail of the producing module; consumers treat this
 * as a comparable byte-string only.
 */
export type OpaqueHash = string & { readonly __brand: "OpaqueHash" };

// ---------------------------------------------------------------------------
// Fingerprint signals — tagged union so consumers can discriminate
// ---------------------------------------------------------------------------

/** Time-entropy signal derived from a user's hour-of-day posting histogram. */
export interface TimeEntropySignal {
  readonly kind: "time_entropy";
  /** KL divergence from the subreddit baseline distribution (nats). */
  readonly klDivergence: number;
  /** Histogram of post counts bucketed into 24 UTC hours. */
  readonly hourHistogram: readonly [
    number, number, number, number, number, number,
    number, number, number, number, number, number,
    number, number, number, number, number, number,
    number, number, number, number, number, number,
  ];
}

/** N-gram cadence signal derived from SimHash over function-word n-grams. */
export interface NgramCadenceSignal {
  readonly kind: "ngram_cadence";
  /** SimHash fingerprint of the user's function-word 3-gram distribution. */
  readonly simHash: OpaqueHash;
  /** Number of tokens sampled to produce this hash. */
  readonly sampleSize: number;
}

/** Domain-history signal derived from MinHash over external URLs shared. */
export interface DomainHistorySignal {
  readonly kind: "domain_history";
  /** MinHash sketch of the set of registered domains shared. */
  readonly minHash: OpaqueHash;
  /** Count of distinct domains observed. */
  readonly domainCount: number;
}

/** Discriminated union of all supported fingerprint signals. */
export type FingerprintSignal =
  | TimeEntropySignal
  | NgramCadenceSignal
  | DomainHistorySignal;

/**
 * A fully computed fingerprint for one Reddit account.
 * The `signals` map is keyed by `FingerprintSignal["kind"]` for O(1) lookup.
 */
export interface Fingerprint {
  readonly userId: UserId;
  readonly computedAt: ISOTimestamp;
  /** Composite risk score in the range [0, 100]. Higher = more suspicious. */
  readonly compositeScore: number;
  /** Individual signal outputs, keyed by signal kind. */
  readonly signals: Readonly<{
    [K in FingerprintSignal["kind"]]?: Extract<FingerprintSignal, { kind: K }>;
  }>;
  /**
   * Version of the fingerprinting algorithm that produced this result.
   * Increment when signal weights or algorithms change to allow cache
   * invalidation of stale fingerprints.
   */
  readonly algorithmVersion: number;
}

// ---------------------------------------------------------------------------
// Federation & trust graph
// ---------------------------------------------------------------------------

/**
 * A directed trust relationship from one subreddit to another.
 * "source trusts target" means source will act on threat intel from target.
 */
export interface TrustEdge {
  readonly source: SubredditId;
  readonly target: SubredditId;
  /**
   * Trust weight in [0, 1]. At 1.0 the source auto-applies actions;
   * below a configurable threshold actions are advisory only.
   */
  readonly weight: number;
  readonly establishedAt: ISOTimestamp;
  /** Optional human-readable reason for the trust relationship. */
  readonly note?: string;
}

// ---------------------------------------------------------------------------
// Moderation action taxonomy
// ---------------------------------------------------------------------------

export type ModActionCategory =
  | "spam"
  | "harassment"
  | "vote_manipulation"
  | "ban_evasion"
  | "coordinated_inauthentic"
  | "misinformation"
  | "other";

// ---------------------------------------------------------------------------
// Threat alerts — what peers exchange
// ---------------------------------------------------------------------------

/**
 * The severity level of a threat alert as assessed by the originating
 * subreddit's moderation team.
 */
export type ThreatSeverity = "low" | "medium" | "high" | "critical";

/**
 * A threat alert emitted by one subreddit and consumed by its trusted peers.
 * Designed to be flexible: implementations may add signal kinds without
 * breaking consumers that discriminate only on known kinds.
 */
export interface ThreatAlert {
  /** Stable UUID (v4) assigned at creation and preserved across hops. */
  readonly alertId: string;
  readonly targetUser: UserId;
  readonly originSubreddit: SubredditId;
  readonly issuedAt: ISOTimestamp;
  readonly severity: ThreatSeverity;
  readonly categories: readonly [ModActionCategory, ...ModActionCategory[]];
  /**
   * The fingerprint snapshot that triggered this alert. Receivers may
   * compare against their own computed fingerprint to validate similarity.
   */
  readonly fingerprint: Fingerprint;
  /**
   * Human-readable summary written by the issuing mod team.
   * Must not contain PII beyond the Reddit username.
   */
  readonly summary: string;
  /**
   * Optional evidence links (mod log entries, removed posts, etc.).
   * URLs only — no raw content.
   */
  readonly evidenceUrls?: readonly string[];
  /**
   * Reserved: legacy Ed25519 signature field from the pre-pivot coordinator
   * transport. Production now uses the wiki transport (see
   * src/server/federation/), which authenticates via subreddit-scoped wiki
   * permissions rather than a per-alert signature. Retained for back-compat
   * with any historical payloads still in storage.
   */
  readonly coordinatorSignature?: string;
}

// ---------------------------------------------------------------------------
// Federation wire types (wiki transport)
// ---------------------------------------------------------------------------

/**
 * The JSON payload a subreddit writes to its federation wiki page when
 * publishing a new threat alert or an update to an existing one. Peers
 * read these payloads by polling the publisher's wiki.
 */
export interface FederationPayload {
  /** Protocol version for forward-compatibility. Current: 1. */
  readonly version: 1;
  readonly publisherSubreddit: SubredditId;
  /**
   * Epoch-seconds timestamp of when the publisher generated this payload.
   * Used for replay-attack detection; subscribers reject payloads older
   * than 5 minutes.
   */
  readonly publishedAt: number;
  readonly alert: ThreatAlert;
  /**
   * HMAC-SHA256 over the canonical JSON serialisation of the
   * FederationPayload with the `publisherHmac` field omitted, sorted by key
   * at every nesting level. Keyed with the subreddit's shared secret
   * registered at peer-enrolment time. This binds the signature to every
   * other field of the payload (version, publisherSubreddit, publishedAt,
   * and the full alert body), so a captured signature cannot be replayed
   * with a rewritten alert.
   */
  readonly publisherHmac: string;
}

/**
 * A single item in a publisher's wiki poll response feed.
 * Peers receive an array of these when polling a publisher for new alerts.
 */
export interface FederationPollItem {
  readonly receivedAt: ISOTimestamp;
  readonly payload: FederationPayload;
}

// ---------------------------------------------------------------------------
// Storage envelope
// ---------------------------------------------------------------------------

/**
 * Metadata wrapper stored alongside every cached Fingerprint in Redis.
 * Allows cache invalidation without re-fetching the fingerprint itself.
 */
export interface StoredFingerprintEnvelope {
  readonly fingerprint: Fingerprint;
  readonly storedAt: ISOTimestamp;
  /** TTL hint in seconds, set by the storage layer at write time. */
  readonly ttlSeconds: number;
}

// ---------------------------------------------------------------------------
// Helper: brand constructors (no runtime overhead beyond identity cast)
// ---------------------------------------------------------------------------

/** Unsafely cast a plain string to SubredditId. Validate input before use. */
export const asSubredditId = (s: string): SubredditId => s as SubredditId;

/** Unsafely cast a plain string to UserId. Validate input before use. */
export const asUserId = (s: string): UserId => s as UserId;

/** Unsafely cast a plain string to ISOTimestamp. Validate input before use. */
export const asISOTimestamp = (s: string): ISOTimestamp => s as ISOTimestamp;

/** Unsafely cast a plain string to OpaqueHash. Validate input before use. */
export const asOpaqueHash = (s: string): OpaqueHash => s as OpaqueHash;
