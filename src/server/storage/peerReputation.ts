/**
 * src/server/storage/peerReputation.ts
 *
 * Per-publisher reputation counters for the federation trust graph.
 * Tracks how many threats we have indexed from each peer and how many
 * of those were marked false-positive by a moderator on this sub.
 *
 * Redis key conventions:
 *   peer-stats:<publisherSub>:threats   — INCR counter of indexed threats
 *   peer-stats:<publisherSub>:fp        — INCR counter of FP marks received
 *   fp:<currentSub>:<alertId>           — NX sentinel, TTL 90 days (dedup key)
 */

import { redis } from '@devvit/web/server';

/** TTL for false-positive dedup sentinels: 90 days. */
const FP_DEDUP_TTL_SECONDS = 60 * 60 * 24 * 90;

function threatCountKey(publisherSub: string): string {
  return `peer-stats:${publisherSub}:threats`;
}

function fpCountKey(publisherSub: string): string {
  return `peer-stats:${publisherSub}:fp`;
}

function fpDedupKey(currentSub: string, alertId: string): string {
  return `fp:${currentSub}:${alertId}`;
}

/**
 * Increment the threats-indexed counter for a publisher sub.
 * Called once per newly indexed threat (first-time-seen only).
 * Returns the new counter value.
 */
export async function incrementThreatCount(publisherSub: string): Promise<number> {
  return await redis.incrBy(threatCountKey(publisherSub), 1);
}

/**
 * Increment the false-positive counter for a publisher sub.
 * Should only be called after confirming this is a first mark (NX guard).
 * Returns the new counter value.
 */
export async function incrementFpCount(publisherSub: string): Promise<number> {
  return await redis.incrBy(fpCountKey(publisherSub), 1);
}

/**
 * Read the reputation summary for a publisher sub.
 * fpRate is fp/threats rounded to 2 decimal places; 0 when threats === 0.
 */
export async function getReputation(
  publisherSub: string,
): Promise<{ threats: number; fp: number; fpRate: number }> {
  const [rawThreats, rawFp] = await Promise.all([
    redis.get(threatCountKey(publisherSub)),
    redis.get(fpCountKey(publisherSub)),
  ]);

  const threats = rawThreats ? parseInt(rawThreats, 10) : 0;
  const fp = rawFp ? parseInt(rawFp, 10) : 0;

  const safeThreats = Number.isNaN(threats) ? 0 : threats;
  const safeFp = Number.isNaN(fp) ? 0 : fp;

  const fpRate = safeThreats > 0 ? Math.round((safeFp / safeThreats) * 10000) / 100 : 0;

  return { threats: safeThreats, fp: safeFp, fpRate };
}

/**
 * Attempt to mark an alert from publisherSub as false-positive for currentSub.
 *
 * Uses NX semantics on the dedup key so the same viewer cannot spam-mark.
 * On first mark, also increments the publisher's FP counter.
 *
 * Returns `{ firstMark: true }` if this was a new mark, `{ firstMark: false }`
 * if the alert was already marked by this sub.
 */
export async function markFalsePositive(
  currentSub: string,
  alertId: string,
  publisherSub: string,
): Promise<{ firstMark: boolean }> {
  const key = fpDedupKey(currentSub, alertId);
  const expirationDate = new Date(Date.now() + FP_DEDUP_TTL_SECONDS * 1000);

  const result = await redis.set(key, '1', {
    nx: true,
    expiration: expirationDate,
  });

  // redis.set with nx returns 'OK' on success, undefined when key already exists
  const firstMark = result === 'OK';

  if (firstMark) {
    await incrementFpCount(publisherSub);
  }

  return { firstMark };
}

/**
 * Check whether currentSub has already marked the given alert as false-positive.
 */
export async function isMarkedFalsePositive(
  currentSub: string,
  alertId: string,
): Promise<boolean> {
  const raw = await redis.get(fpDedupKey(currentSub, alertId));
  return raw !== undefined && raw !== null;
}
