/**
 * src/server/federation/wikiPublisher.ts
 *
 * Concrete wiki publisher: when a mod bans a user, look up the cached
 * fingerprint and append a (no-PII) threat record to this sub's own
 * r/<sub>/wiki/hive-threats page.
 *
 * Subscribe side comes in Day 5 (wikiSubscriber.ts polling peer wikis).
 */

import { redis, reddit } from '@devvit/web/server';
import { randomUUID, createHash } from 'node:crypto';

import { HIVE_WIKI_PAGE, WIKI_PAGE_MAX_CHARS } from './wikiBroker';
import { appendActionLog } from '../storage/actionLog';
import { weekOf } from './publisherSalt';

/**
 * Hash a moderator's username with a per-sub salt so peers can attribute
 * the action to a stable "mod identity" without learning who. Salting by
 * sub means the same mod has different hashes in different subs they mod.
 */
function hashedModerator(sub: string, moderator: string): string {
  return createHash('sha256')
    .update(`hive-mod:${sub}:${moderator.toLowerCase()}`)
    .digest('hex')
    .slice(0, 16);
}

/** Default time-to-live for a published threat record. */
const DEFAULT_TTL_DAYS = 30;

/** Minimum gap (ms) between writes to the wiki — Reddit rate-limits ~1/min. */
const WRITE_COOLDOWN_MS = 60_000;

type MatchableFingerprintV1 = {
  readonly version: 1;
  readonly cadenceHash?: string;
  readonly domainHash?: string;
};

interface PublishedThreat {
  readonly alertId: string;
  readonly publishedAt: string;
  readonly ttlAt: string;
  readonly category: string;
  /**
   * ISO week (`YYYY-Www`) the publisher-local hashes were salted with. The
   * salt itself stays private; peers use `fingerprint.matchableV1` for
   * cross-sub matching. See SECURITY.md "Per-publisher salt + weekly rotation".
   */
  readonly epoch: string;
  /**
   * Opaque hashed moderator identity (sha256(sub:moderator), 16 hex chars).
   * Lets the publishing sub track which mod issued the alert internally
   * without exposing the moderator's reddit username to the public wiki.
   */
  readonly modHash: string;
  readonly fingerprint: {
    readonly timeKL?: number;
    readonly timeAnomaly?: number;
    /** Publisher-scoped salted cadence hash; useful for publisher-local audit only. */
    readonly cadenceHash?: string;
    readonly cadenceAnomaly?: number;
    /** Publisher-scoped salted domain hash; useful for publisher-local audit only. */
    readonly domainHash?: string;
    readonly domainAnomaly?: number;
    readonly composite?: number;
    /** Deterministic opaque sketch peers can recompute for v1 cross-sub matching. */
    readonly matchableV1?: MatchableFingerprintV1;
  };
}

interface WikiFeed {
  readonly version: 1;
  readonly publisher: string;
  readonly lastUpdated: string;
  readonly alerts: readonly PublishedThreat[];
}

export interface PublishBanArgs {
  readonly sub: string;
  readonly targetUser: string;
  readonly category: string;
  readonly moderator: string;
}

interface StoredFingerprintShape {
  username: string;
  computedAt: string;
  /** ISO week the cached hashes were salted with; falls back to current week. */
  epoch?: string;
  timeEntropy?: { kl: number; anomaly: number };
  cadence?: { simHash: string; sampleSize: number; anomaly: number };
  domain?: { minHash: string; domainCount: number; anomaly: number };
  matchableV1?: { cadenceHash?: string; domainHash?: string };
  composite?: { score: number; band: string; presentSignals: number };
}

function buildMatchableV1(fp: StoredFingerprintShape): MatchableFingerprintV1 | undefined {
  const cadenceHash = fp.matchableV1?.cadenceHash;
  const domainHash = fp.matchableV1?.domainHash;
  if (!cadenceHash && !domainHash) return undefined;
  return {
    version: 1,
    cadenceHash,
    domainHash,
  };
}

/**
 * Append a threat record to the publishing sub's wiki feed.
 *
 * Idempotency: keyed by (sub, targetUser, category, day) — re-publishes
 * for the same combination within 24h are skipped.
 */
export async function publishBanToWiki(args: PublishBanArgs): Promise<void> {
  const { sub, targetUser, category, moderator } = args;

  // Idempotency check
  const dedupeKey = `pub:${sub}:${targetUser}:${category}:${new Date().toISOString().slice(0, 10)}`;
  const already = await redis.get(dedupeKey);
  if (already) {
    console.log(`[hive] publish skipped (deduped) target=${targetUser} category=${category}`);
    return;
  }

  // Look up the cached fingerprint
  const fpRaw = await redis.get(`fp:${targetUser}`);
  if (!fpRaw) {
    console.warn(
      `[hive] publish skipped: no fingerprint for u/${targetUser} (account never commented in this sub)`
    );
    return;
  }
  let fp: StoredFingerprintShape;
  try {
    fp = JSON.parse(fpRaw) as StoredFingerprintShape;
  } catch {
    console.warn(`[hive] publish skipped: corrupted fingerprint for u/${targetUser}`);
    return;
  }

  // Cooldown — avoid burning the wiki rate limit
  const cooldownKey = `cooldown:wiki:${sub}`;
  const cooldownVal = await redis.get(cooldownKey);
  if (cooldownVal) {
    const ts = parseInt(cooldownVal, 10);
    if (Date.now() - ts < WRITE_COOLDOWN_MS) {
      console.warn(`[hive] publish deferred for u/${targetUser} (cooldown active)`);
      // Could enqueue here; v1 just drops. Mod can re-ban or use a manual menu action.
      return;
    }
  }

  const matchableV1 = buildMatchableV1(fp);
  if (!matchableV1) {
    console.warn(
      `[hive] publish skipped: no matchable cadence/domain fingerprint for u/${targetUser}`,
    );
    return;
  }

  // Build the new threat record
  const now = new Date();
  const ttl = new Date(now.getTime() + DEFAULT_TTL_DAYS * 24 * 3600 * 1000);
  // Prefer the epoch the cached fingerprint was actually salted with; the
  // current-week fallback only matters for legacy records written before
  // the per-publisher-salt rollout.
  const epoch = fp.epoch ?? weekOf(now);
  const record: PublishedThreat = {
    alertId: randomUUID(),
    publishedAt: now.toISOString(),
    ttlAt: ttl.toISOString(),
    category,
    epoch,
    modHash: hashedModerator(sub, moderator),
    fingerprint: {
      timeKL: fp.timeEntropy?.kl,
      timeAnomaly: fp.timeEntropy?.anomaly,
      cadenceHash: fp.cadence?.simHash,
      cadenceAnomaly: fp.cadence?.anomaly,
      domainHash: fp.domain?.minHash,
      domainAnomaly: fp.domain?.anomaly,
      composite: fp.composite?.score,
      matchableV1,
    },
  };

  // Read existing wiki page (or start fresh)
  let feed: WikiFeed = {
    version: 1,
    publisher: sub,
    lastUpdated: now.toISOString(),
    alerts: [],
  };
  try {
    const page = await reddit.getWikiPage(sub, HIVE_WIKI_PAGE);
    const content = page?.content ?? '';
    if (content.trim().length > 0) {
      const parsed = JSON.parse(content) as WikiFeed;
      if (parsed && parsed.version === 1) feed = parsed;
    }
  } catch (err) {
    console.log(`[hive] wiki page not found, creating fresh: ${err}`);
  }

  // Prune expired records, append new one
  const stillValid = feed.alerts.filter((a) => new Date(a.ttlAt).getTime() > now.getTime());
  const nextFeed: WikiFeed = {
    version: 1,
    publisher: sub,
    lastUpdated: now.toISOString(),
    alerts: [...stillValid, record],
  };

  let serialised = JSON.stringify(nextFeed, null, 2);
  if (serialised.length > WIKI_PAGE_MAX_CHARS) {
    // Trim oldest until we fit
    const trimmed = [...nextFeed.alerts];
    while (serialised.length > WIKI_PAGE_MAX_CHARS && trimmed.length > 1) {
      trimmed.shift();
      serialised = JSON.stringify(
        { ...nextFeed, alerts: trimmed } satisfies WikiFeed,
        null,
        2,
      );
    }
  }

  // Write it back
  try {
    await reddit.updateWikiPage({
      subredditName: sub,
      page: HIVE_WIKI_PAGE,
      content: serialised,
      reason: `hive-restored: published ${category} threat ${record.alertId}`,
    });
    console.log(
      `[hive] published threat target=${targetUser} category=${category} alertId=${record.alertId}`
    );

    // Mark cooldown + dedupe keys
    const expireSecs = 24 * 3600;
    await redis.set(cooldownKey, Date.now().toString(), {
      expiration: new Date(Date.now() + WRITE_COOLDOWN_MS * 2),
    });
    await redis.set(dedupeKey, '1', {
      expiration: new Date(Date.now() + expireSecs * 1000),
    });
    await appendActionLog(sub, {
      type: 'publish',
      title: 'Published peer alert',
      detail: `${category} fingerprint appended to r/${sub}/wiki/${HIVE_WIKI_PAGE}.`,
      tone: 'warning',
    });
  } catch (err) {
    console.error(`[hive] wiki publish failed for ${sub}: ${err}`);
  }
}
