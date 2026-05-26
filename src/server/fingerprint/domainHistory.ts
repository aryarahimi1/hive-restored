/**
 * src/server/fingerprint/domainHistory.ts
 *
 * Domain-history signal. Scam rings post the same set of domains across
 * rotating accounts; co-occurring domain sets are a strong cross-account
 * signal that survives username changes. We extract eTLD+1 domains from
 * each user's recent activity, build a MinHash signature, and compare
 * by Jaccard estimate.
 *
 * MVP uses simple last-two-labels eTLD+1 extraction (good for .com/.org/
 * single-TLD domains; misses .co.uk-style two-part TLDs). Phase 5 can
 * swap to `tldts` for full Public Suffix List coverage.
 *
 * See docs/FINGERPRINT_SPEC.md section 3.
 */

import { createHash } from 'node:crypto';

import type { DomainHistorySignal, OpaqueHash } from '../../shared/types.js';
import { asOpaqueHash } from '../../shared/types.js';

/** Minimum distinct domains required before the signature stabilises. */
export const MIN_DOMAINS = 3;

/** Number of independent hash functions in the MinHash signature. */
export const MINHASH_K = 64;

/** Hard-coded set of domains to ignore (these aren't ring-discriminative). */
export const COMMON_DOMAIN_DENYLIST: ReadonlySet<string> = new Set([
  'reddit.com',
  'redd.it',
  'i.redd.it',
  'v.redd.it',
  'imgur.com',
  'i.imgur.com',
  'youtube.com',
  'youtu.be',
  'twitter.com',
  'x.com',
  't.co',
  'instagram.com',
  'tiktok.com',
  'wikipedia.org',
  'en.wikipedia.org',
  'github.com',
]);

/** URL pattern that catches both raw and markdown-linked URLs. */
const URL_RE = /https?:\/\/[^\s)\]>]+/gi;

/**
 * Extract the registrable domain (eTLD+1, approximated as the last two
 * labels) from a URL string. Returns null on parse failure.
 */
export function extractDomain(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost') return null;
    const parts = host.split('.');
    if (parts.length < 2) return null;
    return parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

/** Pull all unique registrable domains from a body of text. */
export function extractDomainsFromCorpus(corpus: string): string[] {
  const matches = corpus.match(URL_RE) ?? [];
  const seen = new Set<string>();
  for (const m of matches) {
    const d = extractDomain(m);
    if (d && !COMMON_DOMAIN_DENYLIST.has(d)) seen.add(d);
  }
  return [...seen];
}

/**
 * Optional salt parameters for `minHashSignature` /
 * `computeDomainHistorySignal`. When `salt` + `epoch` are both supplied,
 * `<salt>:<epoch>:` is prepended to every domain before hashing so the
 * MinHash signature is unique per (publisher, week) — see
 * `src/server/federation/publisherSalt.ts`.
 *
 * Leaving `opts` undefined preserves the raw MinHash behaviour used by
 * lower-level unit tests.
 */
export interface HashOpts {
  readonly salt?: string;
  readonly epoch?: string;
}

function makeSaltPrefix(opts?: HashOpts): string {
  if (!opts?.salt || !opts.epoch) return '';
  return `${opts.salt}:${opts.epoch}:`;
}

/**
 * Hash a string + seed pair to a 32-bit unsigned integer. SHA-256-based
 * to keep collision rate negligibly low; only the high 4 bytes are used.
 * When a salt prefix is provided it is folded into the digest input so
 * the resulting MinHash position is publisher- and epoch-scoped.
 */
function hashWithSeed(value: string, seed: number, saltPrefix: string): number {
  const digest = createHash('sha256')
    .update(`${saltPrefix}${seed}:${value}`)
    .digest();
  // High 4 bytes as unsigned 32-bit
  return (
    ((digest[0] ?? 0) << 24) |
    ((digest[1] ?? 0) << 16) |
    ((digest[2] ?? 0) << 8) |
    (digest[3] ?? 0)
  ) >>> 0;
}

/**
 * Build a MinHash signature for a set of domains. Returns an array of
 * MINHASH_K unsigned 32-bit integers. Two signatures' Jaccard similarity
 * can be estimated as the fraction of positions where they agree.
 */
export function minHashSignature(
  domains: readonly string[],
  opts?: HashOpts,
): number[] {
  const prefix = makeSaltPrefix(opts);
  const sig = new Array<number>(MINHASH_K).fill(0xffffffff);
  for (const d of domains) {
    for (let k = 0; k < MINHASH_K; k++) {
      const h = hashWithSeed(d, k, prefix);
      const current = sig[k] ?? 0xffffffff;
      if (h < current) sig[k] = h;
    }
  }
  return sig;
}

/** Jaccard similarity estimate from two MinHash signatures. Range [0,1]. */
export function jaccardSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== b.length) {
    throw new Error(`jaccardSimilarity: length mismatch (${a.length} vs ${b.length})`);
  }
  let agree = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) agree++;
  }
  return agree / a.length;
}

/** Encode a number[] signature as a compact base64 string for transport/storage. */
export function encodeSignature(sig: readonly number[]): string {
  const buf = Buffer.alloc(sig.length * 4);
  for (let i = 0; i < sig.length; i++) {
    buf.writeUInt32BE(sig[i] ?? 0, i * 4);
  }
  return buf.toString('base64');
}

/** Decode a base64-encoded MinHash signature back to a number[]. */
export function decodeSignature(b64: string): number[] {
  const buf = Buffer.from(b64, 'base64');
  const out: number[] = [];
  for (let i = 0; i < buf.length; i += 4) {
    out.push(buf.readUInt32BE(i));
  }
  return out;
}

/**
 * Compute the domain-history signal for a user. Returns null when the
 * user hasn't posted enough distinct domains for the signature to mean
 * anything.
 *
 * Pass `opts` (with `salt` and `epoch`) to produce a publisher-scoped
 * MinHash that cannot be replayed externally; omit it to get the raw
 * signature used by lower-level tests.
 */
export function computeDomainHistorySignal(
  corpus: string,
  opts?: HashOpts,
): DomainHistorySignal | null {
  const domains = extractDomainsFromCorpus(corpus);
  if (domains.length < MIN_DOMAINS) return null;
  const sig = minHashSignature(domains, opts);
  return {
    kind: 'domain_history',
    minHash: asOpaqueHash(encodeSignature(sig)),
    domainCount: domains.length,
  };
}

/**
 * Single-sub anomaly classifier. Without a peer signature to compare,
 * we have no real "ring" evidence — so this is intentionally conservative
 * and stays near 0 for almost everyone. The signal's real power emerges
 * during federated peer matching.
 *
 * The one heuristic we apply: if more than 80% of the user's URLs are
 * to a single domain (and that domain isn't a normal big-platform host),
 * flag mild suspicion. This catches accounts that exist solely to spam
 * one site.
 */
export function domainHistoryAnomaly(corpus: string): number {
  const matches = corpus.match(URL_RE) ?? [];
  if (matches.length < 5) return 0;

  const counts = new Map<string, number>();
  let total = 0;
  for (const m of matches) {
    const d = extractDomain(m);
    if (!d || COMMON_DOMAIN_DENYLIST.has(d)) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
    total++;
  }
  if (total < 5) return 0;

  const maxCount = Math.max(0, ...counts.values());
  const concentration = maxCount / total;
  // Linearly ramp 0..1 between 0.8 and 1.0 concentration
  return Math.max(0, Math.min(1, (concentration - 0.8) * 5));
}

/** Re-export OpaqueHash for ergonomic test imports. */
export type { OpaqueHash };
