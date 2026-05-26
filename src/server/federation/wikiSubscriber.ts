/**
 * src/server/federation/wikiSubscriber.ts
 *
 * Subscribe side of federation. Polls peer subreddits' hive-threats wiki pages,
 * parses the JSON feed that wikiPublisher.ts writes, indexes new threats in
 * local Redis so threatMatcher.ts can do fast hash lookups.
 *
 * Redis key conventions used here (emulated as JSON arrays under plain keys
 * because the Devvit redis client only exposes get/set/del for v1):
 *   threat:<alertId>              — JSON PeerThreatRecord, TTL = ttlAt
 *   cursor:peer:<peerSub>         — last alertId seen from this peer (de-dupe)
 *   idx:threats:active            — JSON string[] of active alertIds
 *   idx:cadence:<first4hex>       — JSON string[] of alertIds sharing that prefix
 *   idx:domain:active             — JSON string[] of alertIds with a domain hash
 */

import { redis, reddit } from '@devvit/web/server';

import { HIVE_WIKI_PAGE } from './wikiBroker';
import { getTrustedPeers } from '../storage/trustGraph';
import { incrementThreatCount } from '../storage/peerReputation';
import { incFederationAlert } from '../storage/metrics';

/** Max parallel peer polls to avoid overwhelming Reddit's API. */
/**
 * Polls run sequentially so the JSON-array index keys
 * (`appendToIdx` is read-modify-write on `idx:threats:active` etc.) do not
 * race and lose alertIds. Trust circles are bounded at ~30 peers and each
 * poll is ~150ms, so the full sweep finishes inside one 2-min scheduler tick.
 */
const CONCURRENCY_LIMIT = 1;

/** Minimal shape the publisher writes for each alert. */
interface RawPublishedThreat {
  alertId?: unknown;
  publishedAt?: unknown;
  ttlAt?: unknown;
  category?: unknown;
  epoch?: unknown;
  fingerprint?: {
    cadenceHash?: unknown;
    domainHash?: unknown;
    timeKL?: unknown;
    composite?: unknown;
    /** Deterministic opaque sketch peers can recompute for cross-sub v1 matching. */
    matchableV1?: {
      version?: unknown;
      cadenceHash?: unknown;
      domainHash?: unknown;
    };
    // wikiPublisher uses these field names:
    cadenceHash2?: unknown;
    domainHash2?: unknown;
  };
}

/**
 * Allowed category values for peer threat records. Anything else is
 * coerced to `'unknown'` — `category` flows into mod-note text, so this
 * is the trust boundary that keeps a malicious peer from injecting
 * markdown / control characters into the moderator UI.
 *
 * Keep in sync with `categoriseModAction` in routes/triggers.ts.
 */
export const ALLOWED_CATEGORIES = new Set<string>([
  'ban_evasion',
  'spam',
  'harassment',
  'unknown',
]);

/** Normalised peer threat record stored locally in Redis. */
export interface PeerThreatRecord {
  alertId: string;
  publishedAt: string;
  ttlAt: string;
  category: string;
  /** Set at poll time to the peer sub we read this from. */
  publisherSub: string;
  /** ISO week the publisher salted its hashes with (`YYYY-Www`). Optional for legacy records. */
  epoch?: string;
  fingerprint: {
    /** Matchable v1 32-hex-char SimHash (legacy feeds may store salted publisher hash here). */
    cadenceHash?: string;
    /** Matchable v1 base64 MinHash signature (legacy feeds may store salted publisher hash here). */
    domainHash?: string;
    timeKL?: number;
    composite?: number;
  };
}

/** Raw wiki feed written by wikiPublisher.ts. */
interface WikiFeed {
  version?: unknown;
  publisher?: unknown;
  alerts?: unknown[];
}

/** Result of polling a single peer. */
export interface PollResult {
  added: number;
  skipped: number;
  /** True only when transient-error retries were exhausted. Absent on success. */
  failed?: boolean;
}

/** Backoff delays (ms) between transient-error retries. Length = max retries. */
const RETRY_DELAYS_MS = [500, 1500];

/** Sleep helper for retry backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classify an error thrown by `reddit.getWikiPage` as transient (worth
 * retrying) or permanent (the page doesn't exist / we're not allowed in).
 *
 * Devvit doesn't strongly type these errors, so we sniff common shape clues:
 *   - numeric `status` / `statusCode` (HTTP code if present)
 *   - string `code` (node-style error code, e.g. ETIMEDOUT)
 *   - message substring match as a last resort
 *
 * Per the task spec: when we can't reliably tell, treat as transient.
 */
function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return true;
  const e = err as { status?: unknown; statusCode?: unknown; code?: unknown; message?: unknown };

  const status =
    typeof e.status === 'number' ? e.status :
    typeof e.statusCode === 'number' ? e.statusCode :
    undefined;
  if (status !== undefined) {
    if (status === 404 || status === 403 || status === 401) return false;
    if (status === 429 || status >= 500) return true;
    // Other 4xx — treat as permanent (won't get better by retrying).
    if (status >= 400 && status < 500) return false;
  }

  const code = typeof e.code === 'string' ? e.code.toUpperCase() : '';
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return true;
  }

  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  if (msg.includes('not found') || msg.includes('forbidden') ||
      msg.includes("doesn't exist") || msg.includes('does not exist') ||
      msg.includes('no wiki') || msg.includes('private')) {
    return false;
  }
  if (msg.includes('rate') || msg.includes('timeout') || msg.includes('timed out') ||
      msg.includes('network') || msg.includes('econn')) {
    return true;
  }

  // Unknown shape — be conservative and retry (capped).
  return true;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function threatKey(alertId: string): string {
  return `threat:${alertId}`;
}

function cadenceIdxKey(first4: string): string {
  return `idx:cadence:${first4}`;
}

const DOMAIN_IDX_KEY = 'idx:domain:active';
const ACTIVE_THREATS_IDX_KEY = 'idx:threats:active';

/** Read a JSON string-array index key (returns [] on missing/corrupt). */
async function readIdxList(key: string): Promise<string[]> {
  const raw = await redis.get(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/** Append an alertId to a JSON string-array index key (deduped). */
async function appendToIdx(key: string, alertId: string): Promise<void> {
  const list = await readIdxList(key);
  if (list.includes(alertId)) return;
  list.push(alertId);
  await redis.set(key, JSON.stringify(list));
}

/**
 * Extract cadence/domain hashes from a raw alert's fingerprint.
 * The publisher (`wikiPublisher.ts`) stores them under `cadenceHash` and
 * `domainHash` inside the `fingerprint` sub-object.
 */
function extractFingerprint(raw: RawPublishedThreat): PeerThreatRecord['fingerprint'] {
  const fp = raw.fingerprint ?? {};
  const result: PeerThreatRecord['fingerprint'] = {};

  const matchable = fp.matchableV1?.version === 1 ? fp.matchableV1 : undefined;

  // Prefer matchableV1: publisher/subscriber both recompute this deterministic
  // opaque sketch, while cadenceHash/domainHash remain salted publisher-local
  // fields for newer feeds. Legacy feeds fall back to the old fields.
  const ch = typeof matchable?.cadenceHash === 'string' ? matchable.cadenceHash :
             typeof fp.cadenceHash === 'string' ? fp.cadenceHash :
             typeof fp.cadenceHash2 === 'string' ? fp.cadenceHash2 :
             undefined;
  if (ch && /^[0-9a-f]{32}$/i.test(ch)) result.cadenceHash = ch.toLowerCase();

  const dh = typeof matchable?.domainHash === 'string' ? matchable.domainHash :
             typeof fp.domainHash === 'string' ? fp.domainHash :
             typeof fp.domainHash2 === 'string' ? fp.domainHash2 :
             undefined;
  if (dh && dh.length > 0) result.domainHash = dh;

  if (typeof fp.timeKL === 'number') result.timeKL = fp.timeKL;
  if (typeof fp.composite === 'number') result.composite = fp.composite;

  return result;
}

/**
 * Parse raw publisher threat to PeerThreatRecord; returns null if invalid.
 *
 * H-3: `category` is allowlisted against `ALLOWED_CATEGORIES`. Any
 * unrecognised value (including markdown / HTML payloads from a
 * malicious peer) is coerced to `'unknown'` so it cannot reach the
 * mod-note UI as live text.
 */
export function parseRawThreat(raw: unknown, publisherSub: string): PeerThreatRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as RawPublishedThreat;
  if (typeof r.alertId !== 'string' || !r.alertId) return null;
  if (typeof r.publishedAt !== 'string' || !r.publishedAt) return null;
  if (typeof r.ttlAt !== 'string' || !r.ttlAt) return null;

  const rawCategory = typeof r.category === 'string' ? r.category.toLowerCase() : '';
  const category = ALLOWED_CATEGORIES.has(rawCategory) ? rawCategory : 'unknown';

  const epoch = typeof r.epoch === 'string' && /^\d{4}-W\d{2}$/.test(r.epoch)
    ? r.epoch
    : undefined;

  const record: PeerThreatRecord = {
    alertId: r.alertId,
    publishedAt: r.publishedAt,
    ttlAt: r.ttlAt,
    category,
    publisherSub,
    fingerprint: extractFingerprint(r),
  };
  if (epoch) record.epoch = epoch;
  return record;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Poll one peer sub's hive-threats wiki, parse the JSON feed, and index
 * any new threat records not yet seen locally.
 *
 * @param peerSub - The subreddit name (without r/) to poll.
 * @returns Count of alerts added vs skipped.
 */
export async function pollPeer(peerSub: string): Promise<PollResult> {
  let pageContent: string;
  // Try once, then retry up to RETRY_DELAYS_MS.length times on transient errors.
  // Permanent errors (404, 403, "not found", "forbidden") return silently as before.
  let attempt = 0;
  while (true) {
    try {
      const page = await reddit.getWikiPage(peerSub, HIVE_WIKI_PAGE);
      pageContent = page?.content ?? '';
      break;
    } catch (err) {
      if (!isTransientError(err)) {
        // Permanent — page missing or access denied; expected, stay silent.
        return { added: 0, skipped: 0 };
      }
      if (attempt >= RETRY_DELAYS_MS.length) {
        // Transient retries exhausted — surface as a structured failure.
        console.warn(
          `[hive] pollPeer r/${peerSub}: transient error after ${attempt + 1} attempts: ${String(err)}`,
        );
        return { added: 0, skipped: 0, failed: true };
      }
      await sleep(RETRY_DELAYS_MS[attempt]!);
      attempt++;
    }
  }

  if (!pageContent.trim()) return { added: 0, skipped: 0 };

  let feed: WikiFeed;
  try {
    feed = JSON.parse(pageContent) as WikiFeed;
  } catch {
    console.warn(`[hive] pollPeer r/${peerSub}: invalid JSON in wiki feed`);
    return { added: 0, skipped: 0 };
  }

  if (!Array.isArray(feed.alerts)) return { added: 0, skipped: 0 };

  // Strict version check — refuse unknown schema versions
  const version = (feed as { version?: unknown }).version;
  if (version !== 1) {
    console.warn(`[hive] pollPeer r/${peerSub}: unsupported feed version ${String(version)}`);
    return { added: 0, skipped: 0 };
  }

  // H-1: Refuse feeds where the declared publisher does not match the sub
  // we asked. Devvit returns whatever JSON is at r/<peerSub>/wiki/hive-threats,
  // so without this check a malicious peer could impersonate another sub by
  // copying its records verbatim. Reject the whole feed — partial-trust on
  // a forged feed has no safe semantics.
  const declared = typeof feed.publisher === 'string' ? feed.publisher.toLowerCase() : '';
  if (declared && declared !== peerSub.toLowerCase()) {
    console.warn(
      `[hive] pollPeer r/${peerSub}: publisher mismatch (feed claims "${String(feed.publisher)}") — refusing feed`,
    );
    return { added: 0, skipped: 0 };
  }

  const now = Date.now();
  let added = 0;
  let skipped = 0;

  for (const rawAlert of feed.alerts) {
    const record = parseRawThreat(rawAlert, peerSub);
    if (!record) {
      skipped++;
      continue;
    }

    // Skip invalid or expired records before passing expiration to Redis.
    const ttlMs = Date.parse(record.ttlAt);
    if (!Number.isFinite(ttlMs) || ttlMs <= now) {
      skipped++;
      continue;
    }

    // De-dupe: skip if already indexed (alertId is the source of truth — cursor was redundant)
    const existing = await redis.get(threatKey(record.alertId));
    if (existing) {
      skipped++;
      continue;
    }

    // Store the threat record with TTL
    await redis.set(threatKey(record.alertId), JSON.stringify(record), {
      expiration: new Date(ttlMs),
    });

    // Update active threat index used by the webview dashboard.
    await appendToIdx(ACTIVE_THREATS_IDX_KEY, record.alertId);

    // Update cadence index
    if (record.fingerprint.cadenceHash) {
      const prefix = record.fingerprint.cadenceHash.slice(0, 4);
      await appendToIdx(cadenceIdxKey(prefix), record.alertId);
    }

    // Update domain index
    if (record.fingerprint.domainHash) {
      await appendToIdx(DOMAIN_IDX_KEY, record.alertId);
    }

    // Increment the running threats-indexed counter used by the status view.
    // This drifts upward over time (TTL prunes the actual records, not this
    // counter) — acceptable for a demo-quality signal.
    const rawCount = await redis.get('stats:threats_indexed');
    const count = rawCount ? parseInt(rawCount, 10) : 0;
    await redis.set('stats:threats_indexed', String(isNaN(count) ? 1 : count + 1));

    // Increment the per-publisher threat count for reputation tracking.
    await incrementThreatCount(peerSub);
    await incFederationAlert();

    added++;
  }

  return { added, skipped };
}

/**
 * Poll all peers in the trust graph in parallel (bounded at CONCURRENCY_LIMIT).
 *
 * @param currentSub - The subreddit whose trust graph to read.
 */
export async function pollAllPeers(currentSub: string): Promise<void> {
  const peers = await getTrustedPeers(currentSub);
  if (peers.length === 0) return;

  // Process in chunks of CONCURRENCY_LIMIT
  let failedCount = 0;
  for (let i = 0; i < peers.length; i += CONCURRENCY_LIMIT) {
    const chunk = peers.slice(i, i + CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(
      chunk.map(async (entry) => {
        const result = await pollPeer(entry.peer);
        console.log(
          `[hive] poll r/${entry.peer}: added=${result.added} skipped=${result.skipped}${result.failed ? ' FAILED' : ''}`,
        );
        return result;
      }),
    );

    for (const r of results) {
      if (r.status === 'rejected') {
        console.error(`[hive] pollPeer error: ${r.reason}`);
        failedCount++;
      } else if (r.value.failed) {
        failedCount++;
      }
    }
  }

  if (failedCount > 0) {
    console.warn(`[hive] pollAllPeers: ${failedCount} peer(s) failed after retries`);
  }
}

// ---------------------------------------------------------------------------
// Index accessor (used by threatMatcher.ts)
// ---------------------------------------------------------------------------

/** Read the cadence prefix index for a given 4-char hex prefix. */
export async function getCadenceIdxForPrefix(prefix: string): Promise<string[]> {
  return readIdxList(cadenceIdxKey(prefix));
}

/** Read all alertIds in the domain-active index. */
export async function getDomainActiveIdx(): Promise<string[]> {
  return readIdxList(DOMAIN_IDX_KEY);
}

/** Read all alertIds in the dashboard active-threat index. */
export async function getActiveThreatIds(): Promise<string[]> {
  return readIdxList(ACTIVE_THREATS_IDX_KEY);
}

/** Read a stored threat record by alertId. Returns null if not found/expired. */
export async function getThreatRecord(alertId: string): Promise<PeerThreatRecord | null> {
  const raw = await redis.get(threatKey(alertId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PeerThreatRecord;
  } catch {
    return null;
  }
}
