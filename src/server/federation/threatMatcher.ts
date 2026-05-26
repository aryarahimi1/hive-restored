/**
 * src/server/federation/threatMatcher.ts
 *
 * Given a local user's fingerprint hashes, scan the indexed peer threat
 * records and return similarity matches above threshold.
 *
 * Matching strategy:
 *   - Cadence (SimHash): Hamming distance ≤ 28 out of 128 bits
 *     → similarity = 1 - dist/128
 *   - Domain (MinHash): Jaccard ≥ 0.55
 *     → similarity = jaccard value
 *
 * Uses prefix index (`idx:cadence:<first4hex>`) for cadence candidates and
 * full scan of `idx:domain:active` for domain candidates.
 *
 * We intentionally do not cache no-match results. During the demo path, a user
 * can be fingerprinted before a peer poll indexes new alerts; the next check
 * must see the fresh index immediately.
 */

import { hammingDistance } from '../fingerprint/ngramCadence';
import { jaccardSimilarity, decodeSignature } from '../fingerprint/domainHistory';
import { isMarkedFalsePositive } from '../storage/peerReputation';
import {
  getCadenceIdxForPrefix,
  getDomainActiveIdx,
  getThreatRecord,
} from './wikiSubscriber';

/**
 * Hamming distance threshold for a cadence hit (out of 128 bits).
 * 20/128 ≈ 15.6% bit difference = ~84% similarity. Below this we
 * accept too many stylistically-distant English writers as matches
 * (per code review); above this we miss legitimate ring members who
 * tweaked their templates. 20 is the tight-but-not-strict middle.
 */
const CADENCE_HAMMING_THRESHOLD = 20;

/** Jaccard similarity threshold for a domain hit. */
const DOMAIN_JACCARD_THRESHOLD = 0.55;

/** Maximum matches to return. */
const TOP_K = 3;

/** A single match result. */
export interface ThreatMatch {
  alertId: string;
  publisherSub: string;
  category: string;
  /** Similarity in [0,1]. Higher = more similar. */
  similarity: number;
  matchedSignal: 'cadence' | 'domain';
}

/**
 * Check a local user's fingerprint against all indexed peer threats.
 *
 * @param input.cadenceHash - The user's 32-hex-char SimHash (optional).
 * @param input.domainHash  - The user's base64-encoded MinHash signature (optional).
 * @param input.currentSub  - When supplied, alerts marked false-positive by this
 *                            sub are excluded from the returned matches. Skip the
 *                            param in pure-fingerprint tests that don't need
 *                            per-sub state.
 * @returns Top 3 matches sorted by similarity descending. Empty if none.
 */
export async function matchAgainstThreats(input: {
  cadenceHash?: string;
  domainHash?: string;
  currentSub?: string;
}): Promise<ThreatMatch[]> {
  const { cadenceHash, domainHash, currentSub } = input;

  if (!cadenceHash && !domainHash) return [];

  const matches: ThreatMatch[] = [];

  // ---------------------------------------------------------------------------
  // Cadence matching via prefix index
  // ---------------------------------------------------------------------------
  if (cadenceHash && /^[0-9a-f]{32}$/i.test(cadenceHash)) {
    const normalised = cadenceHash.toLowerCase();
    const prefix = normalised.slice(0, 4);

    // We bucket by the first 4 hex chars of the SimHash. NOTE: integer
    // ±1 on the prefix is NOT a Hamming neighbour (0x1000 ↔ 0x0fff differ
    // by 4 bits, not 1), so the previous adjacency expansion was noise.
    // We only look up the exact prefix; ring members with prefix collisions
    // > 16 bits apart in the first nibble are an acceptable miss for v1.
    // Future work: replace with proper LSH banding for high recall.
    const candidateIds = await getCadenceIdxForPrefix(prefix);

    for (const alertId of candidateIds) {
      const record = await getThreatRecord(alertId);
      if (!record?.fingerprint.cadenceHash) continue;

      let dist: number;
      try {
        dist = hammingDistance(normalised, record.fingerprint.cadenceHash);
      } catch {
        continue;
      }

      if (dist <= CADENCE_HAMMING_THRESHOLD) {
        matches.push({
          alertId,
          publisherSub: record.publisherSub,
          category: record.category,
          similarity: 1 - dist / 128,
          matchedSignal: 'cadence',
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Domain matching via full scan of active index
  // ---------------------------------------------------------------------------
  if (domainHash) {
    let localSig: number[];
    try {
      localSig = decodeSignature(domainHash);
    } catch {
      localSig = [];
    }

    if (localSig.length > 0) {
      const domainIds = await getDomainActiveIdx();
      for (const alertId of domainIds) {
        // Skip if we already matched this alert via cadence
        if (matches.some((m) => m.alertId === alertId)) continue;

        const record = await getThreatRecord(alertId);
        if (!record?.fingerprint.domainHash) continue;

        let peerSig: number[];
        try {
          peerSig = decodeSignature(record.fingerprint.domainHash);
        } catch {
          continue;
        }

        if (peerSig.length !== localSig.length) continue;

        const jaccard = jaccardSimilarity(localSig, peerSig);
        if (jaccard >= DOMAIN_JACCARD_THRESHOLD) {
          matches.push({
            alertId,
            publisherSub: record.publisherSub,
            category: record.category,
            similarity: jaccard,
            matchedSignal: 'domain',
          });
        }
      }
    }
  }

  // Suppress alerts a moderator on this sub already marked as false-positive.
  // Filter before sort + slice so we don't surface an FP'd alert just because
  // we truncated the higher-similarity good matches.
  let viable = matches;
  if (currentSub && matches.length > 0) {
    const fpFlags = await Promise.all(
      matches.map((m) => isMarkedFalsePositive(currentSub, m.alertId)),
    );
    viable = matches.filter((_, i) => !fpFlags[i]);
  }

  // Sort by similarity descending; take top 3
  viable.sort((a, b) => b.similarity - a.similarity);
  return viable.slice(0, TOP_K);
}
