/**
 * src/server/storage/trustGraph.ts
 *
 * Redis-backed list of trusted peer subreddit names for the current
 * installation. Simple JSON-blob storage keyed by `trust:<currentSub>`.
 *
 * See Day 5 federation subscriber spec.
 */

import { redis } from '@devvit/web/server';

/** Maximum number of trusted peers per installation. */
const MAX_PEERS = 30;

/** A single entry in the trust graph. */
export interface TrustGraphEntry {
  /** The peer subreddit name (without the r/ prefix). */
  peer: string;
  /** ISO timestamp when this peer was added. */
  addedAt: string;
}

function trustKey(currentSub: string): string {
  return `trust:${currentSub}`;
}

/**
 * Read all trusted peers for a subreddit.
 *
 * @param currentSub - The current subreddit name.
 * @returns Array of trusted peer entries, oldest-first.
 */
export async function getTrustedPeers(currentSub: string): Promise<TrustGraphEntry[]> {
  const raw = await redis.get(trustKey(currentSub));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TrustGraphEntry[];
  } catch {
    console.warn(`[hive] trustGraph: corrupted trust list for r/${currentSub}`);
    return [];
  }
}

/**
 * Add a trusted peer to the trust graph.
 *
 * - Rejects self-adds silently.
 * - Skips duplicates (idempotent).
 * - Caps at MAX_PEERS (30); throws if the cap would be exceeded.
 *
 * @param currentSub - The current subreddit name.
 * @param peer       - The peer subreddit name to trust.
 */
/** @returns true when a new peer was added, false when already trusted. */
export async function addTrustedPeer(currentSub: string, peer: string): Promise<boolean> {
  if (peer.toLowerCase() === currentSub.toLowerCase()) {
    throw new Error(`r/${currentSub} cannot add itself as a peer`);
  }

  const peers = await getTrustedPeers(currentSub);

  // Idempotent — already trusted
  if (peers.some((e) => e.peer.toLowerCase() === peer.toLowerCase())) return false;

  if (peers.length >= MAX_PEERS) {
    throw new Error(
      `r/${currentSub} has reached the maximum of ${MAX_PEERS} trusted peers`,
    );
  }

  const entry: TrustGraphEntry = {
    peer,
    addedAt: new Date().toISOString(),
  };

  await redis.set(trustKey(currentSub), JSON.stringify([...peers, entry]));
  return true;
}

/**
 * Remove a trusted peer from the trust graph.
 *
 * No-op if the peer was not present.
 *
 * @param currentSub - The current subreddit name.
 * @param peer       - The peer subreddit name to remove.
 * @returns true when a peer was removed, false when it was not in the graph.
 */
export async function removeTrustedPeer(currentSub: string, peer: string): Promise<boolean> {
  const peers = await getTrustedPeers(currentSub);
  const filtered = peers.filter((e) => e.peer.toLowerCase() !== peer.toLowerCase());
  if (filtered.length === peers.length) return false;
  await redis.set(trustKey(currentSub), JSON.stringify(filtered));
  return true;
}
