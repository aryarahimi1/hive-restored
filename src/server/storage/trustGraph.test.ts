/**
 * Tests for src/server/storage/trustGraph.ts
 *
 * Mocks @devvit/web/server so we can run in a plain Node/vitest environment
 * without the Devvit runtime. The in-memory Map simulates Redis get/set.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory Redis mock
// ---------------------------------------------------------------------------
const store = new Map<string, string>();

vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(async (key: string) => store.get(key) ?? undefined),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
  reddit: {},
  context: { subredditName: 'testsub' },
  scheduler: {},
}));

import {
  getTrustedPeers,
  addTrustedPeer,
  removeTrustedPeer,
} from './trustGraph';

beforeEach(() => {
  store.clear();
});

// ---------------------------------------------------------------------------
// getTrustedPeers
// ---------------------------------------------------------------------------
describe('getTrustedPeers', () => {
  it('returns empty array when no peers stored', async () => {
    const peers = await getTrustedPeers('mysub');
    expect(peers).toEqual([]);
  });

  it('returns stored peers after adding', async () => {
    await addTrustedPeer('mysub', 'peersub');
    const peers = await getTrustedPeers('mysub');
    expect(peers).toHaveLength(1);
    expect(peers[0]?.peer).toBe('peersub');
    expect(peers[0]?.addedAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// addTrustedPeer
// ---------------------------------------------------------------------------
describe('addTrustedPeer', () => {
  it('adds a peer and records addedAt timestamp', async () => {
    await addTrustedPeer('mysub', 'alpha');
    const peers = await getTrustedPeers('mysub');
    expect(peers).toHaveLength(1);
    expect(peers[0]?.peer).toBe('alpha');
    expect(new Date(peers[0]?.addedAt ?? '').getFullYear()).toBeGreaterThan(2020);
  });

  it('is idempotent — adding the same peer twice results in one entry', async () => {
    await addTrustedPeer('mysub', 'alpha');
    const duplicate = await addTrustedPeer('mysub', 'alpha');
    expect(duplicate).toBe(false);
    const peers = await getTrustedPeers('mysub');
    expect(peers).toHaveLength(1);
  });

  it('is case-insensitive for duplicate detection', async () => {
    await addTrustedPeer('mysub', 'Alpha');
    await addTrustedPeer('mysub', 'alpha');
    const peers = await getTrustedPeers('mysub');
    expect(peers).toHaveLength(1);
  });

  it('rejects self-adds', async () => {
    await expect(addTrustedPeer('mysub', 'mysub')).rejects.toThrow();
  });

  it('rejects self-adds case-insensitively', async () => {
    await expect(addTrustedPeer('MySub', 'mysub')).rejects.toThrow();
  });

  it('accepts multiple different peers', async () => {
    await addTrustedPeer('mysub', 'peer1');
    await addTrustedPeer('mysub', 'peer2');
    await addTrustedPeer('mysub', 'peer3');
    const peers = await getTrustedPeers('mysub');
    expect(peers).toHaveLength(3);
    expect(peers.map((p) => p.peer)).toContain('peer1');
    expect(peers.map((p) => p.peer)).toContain('peer3');
  });

  it('enforces the 30-peer cap', async () => {
    for (let i = 0; i < 30; i++) {
      await addTrustedPeer('mysub', `peer${i}`);
    }
    await expect(addTrustedPeer('mysub', 'overflow')).rejects.toThrow(/maximum/i);
  });

  it('does not throw when at exactly 29 peers, then 30 is allowed', async () => {
    for (let i = 0; i < 29; i++) {
      await addTrustedPeer('mysub', `peer${i}`);
    }
    // 30th add should succeed
    await expect(addTrustedPeer('mysub', 'peer29')).resolves.toBe(true);
    // 31st add should fail
    await expect(addTrustedPeer('mysub', 'peer30')).rejects.toThrow(/maximum/i);
  });
});

// ---------------------------------------------------------------------------
// removeTrustedPeer
// ---------------------------------------------------------------------------
describe('removeTrustedPeer', () => {
  it('removes an existing peer', async () => {
    await addTrustedPeer('mysub', 'alpha');
    await addTrustedPeer('mysub', 'beta');
    await removeTrustedPeer('mysub', 'alpha');
    const peers = await getTrustedPeers('mysub');
    expect(peers).toHaveLength(1);
    expect(peers[0]?.peer).toBe('beta');
  });

  it('is a no-op for a peer that does not exist', async () => {
    await addTrustedPeer('mysub', 'alpha');
    await removeTrustedPeer('mysub', 'nonexistent');
    const peers = await getTrustedPeers('mysub');
    expect(peers).toHaveLength(1);
  });

  it('is case-insensitive when removing', async () => {
    await addTrustedPeer('mysub', 'Alpha');
    await removeTrustedPeer('mysub', 'alpha');
    const peers = await getTrustedPeers('mysub');
    expect(peers).toHaveLength(0);
  });
});
