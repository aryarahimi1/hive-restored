/**
 * src/server/federation/publisherSalt.ts
 *
 * Per-publisher secret salt + weekly epoch helpers for the hashed-fingerprint
 * privacy model (see SECURITY.md "Per-publisher salt + weekly rotation").
 *
 * Threat addressed: without a salt, the SimHash/MinHash functions in
 * `fingerprint/` are public and deterministic. Any peer can replay them
 * over our public Reddit activity stream, recompute our published hashes,
 * and link a u/username to one of our threat records — defeating the
 * "no PII, no user-association" claim.
 *
 * Mitigation: each sub mints a random 32-byte secret at first use (stored
 * under `secret:hive-fp:<sub>`, NX). The publishing pipeline prepends
 * `<secret>:<epoch>:` to every feature before hashing. The epoch is the
 * ISO-week string (e.g. `2026-W21`), so hashes rotate weekly even for
 * users whose behaviour is static.
 *
 * Tradeoff: publisher-local hashes remain salted, but the wiki feed also
 * carries a `matchableV1` opaque behavioral sketch that trusted peers can
 * recompute so cross-sub matching actually works. That matchable sketch is
 * not an anonymity proof against a public observer with full Reddit activity;
 * the honest public claim is narrower: peers exchange no usernames, no raw
 * post/comment text, and no URL lists — only opaque behavioral hashes.
 */

import { redis } from '@devvit/web/server';
import { randomBytes } from 'node:crypto';

/** Redis key holding the per-sub secret used to salt published fingerprints. */
export function publisherSaltKey(sub: string): string {
  return `secret:hive-fp:${sub.toLowerCase()}`;
}

/**
 * Return the per-sub secret salt, minting one on first use. Stored NX so
 * concurrent installs cannot clobber an existing secret. The secret is
 * never returned over a public surface — only used internally as a hash
 * input.
 */
export async function getOrCreatePublisherSalt(sub: string): Promise<string> {
  const key = publisherSaltKey(sub);
  const existing = await redis.get(key);
  if (existing && existing.length >= 32) return existing;

  const fresh = randomBytes(32).toString('hex');
  const claimed = await redis.set(key, fresh, { nx: true });
  if (claimed === 'OK') return fresh;

  // Lost the race — another caller wrote first. Re-read.
  const after = await redis.get(key);
  return after && after.length >= 32 ? after : fresh;
}

/**
 * Read the salt without minting one. Returns null when no secret exists yet.
 * Used by tests and by the publisher when it does not want to bootstrap.
 */
export async function readPublisherSalt(sub: string): Promise<string | null> {
  const key = publisherSaltKey(sub);
  const raw = await redis.get(key);
  return raw && raw.length >= 32 ? raw : null;
}

/**
 * ISO 8601 week-of-year string (e.g. `2026-W21`). Used as the rotation
 * epoch so published hashes change weekly even when behaviour is static.
 *
 * Implementation matches the ISO 8601 definition: weeks start Monday,
 * and the week containing the first Thursday of the year is week 1.
 */
export function weekOf(date: Date = new Date()): string {
  // Copy in UTC to avoid timezone drift between server restarts.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Shift to nearest Thursday: current date + 4 - current day number
  // (Sunday is 0 in JS — ISO treats Sunday as 7.)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  // Year's first Thursday
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Compose a salt prefix that gets prepended to every feature before
 * hashing. Kept as a single string so the cost is exactly one
 * concatenation per feature inside the SimHash/MinHash loops.
 */
export function saltPrefix(salt: string, epoch: string): string {
  return `${salt}:${epoch}:`;
}
