/**
 * Tests for src/server/storage/actionLog.ts
 *
 * Mocks @devvit/web/server so we can run the redis-backed log under vitest.
 * The in-memory store simulates the subset of redis ops the module uses:
 * get/set/del, zAdd/zRange/zCard/zRemRangeByScore/zRemRangeByRank, mGet, expire.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory Redis mock
// ---------------------------------------------------------------------------
const kv = new Map<string, string>();
const zsets = new Map<string, Array<{ member: string; score: number }>>();

function getZ(key: string): Array<{ member: string; score: number }> {
  let z = zsets.get(key);
  if (!z) {
    z = [];
    zsets.set(key, z);
  }
  return z;
}

vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(async (key: string) => kv.get(key) ?? undefined),
    set: vi.fn(
      async (
        key: string,
        value: string,
        opts?: { nx?: boolean; expiration?: Date },
      ) => {
        if (opts?.nx && kv.has(key)) return undefined;
        kv.set(key, value);
        return 'OK';
      },
    ),
    del: vi.fn(async (key: string) => {
      kv.delete(key);
    }),
    expire: vi.fn(async () => undefined),
    mGet: vi.fn(async (keys: string[]) => keys.map((k) => kv.get(k) ?? null)),
    zAdd: vi.fn(async (key: string, entry: { member: string; score: number }) => {
      const z = getZ(key);
      const existing = z.findIndex((e) => e.member === entry.member);
      if (existing >= 0) z[existing] = entry;
      else z.push(entry);
      z.sort((a, b) => a.score - b.score);
    }),
    zCard: vi.fn(async (key: string) => getZ(key).length),
    zRange: vi.fn(
      async (
        key: string,
        start: number,
        stop: number,
        opts?: { by?: string; reverse?: boolean },
      ) => {
        const z = [...getZ(key)];
        if (opts?.reverse) z.reverse();
        return z.slice(start, stop + 1);
      },
    ),
    zRemRangeByScore: vi.fn(async (key: string, min: number, max: number) => {
      const z = getZ(key);
      const filtered = z.filter((e) => e.score < min || e.score > max);
      zsets.set(key, filtered);
    }),
    zRemRangeByRank: vi.fn(async (key: string, start: number, stop: number) => {
      const z = getZ(key);
      z.splice(start, stop - start + 1);
    }),
  },
  reddit: {},
  context: { subredditName: 'testsub' },
  scheduler: {},
}));

// trustGraph is exercised indirectly via undoAction. Use real in-memory mock.
vi.mock('./trustGraph', () => ({
  addTrustedPeer: vi.fn(async () => true),
  removeTrustedPeer: vi.fn(async () => true),
}));

import {
  appendAction,
  appendActionLog,
  readActionLog,
  undoAction,
} from './actionLog';
import { addTrustedPeer, removeTrustedPeer } from './trustGraph';

beforeEach(() => {
  kv.clear();
  zsets.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// appendAction
// ---------------------------------------------------------------------------
describe('appendAction', () => {
  it('writes a structured entry with generated id and ISO timestamp', async () => {
    const entry = await appendAction('mysub', {
      type: 'peer',
      title: 'Added r/foo',
      detail: 'detail',
      tone: 'success',
    });
    expect(entry.id).toMatch(/^\d+-[a-z0-9]+$/);
    expect(new Date(entry.ts).toISOString()).toBe(entry.ts);
    expect(entry.title).toBe('Added r/foo');
  });

  it('persists the entry so it can be read back', async () => {
    await appendAction('mysub', {
      type: 'system',
      title: 't',
      detail: 'd',
      tone: 'neutral',
    });
    const list = await readActionLog('mysub');
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('t');
  });

  it('preserves optional undo payload', async () => {
    const entry = await appendAction('mysub', {
      type: 'peer',
      title: 'Added r/peer1',
      detail: 'd',
      tone: 'success',
      undo: { kind: 'removePeer', peer: 'peer1' },
    });
    expect(entry.undo).toEqual({ kind: 'removePeer', peer: 'peer1' });
  });
});

// ---------------------------------------------------------------------------
// appendActionLog (alias)
// ---------------------------------------------------------------------------
describe('appendActionLog alias', () => {
  it('is a working alias of appendAction', async () => {
    const entry = await appendActionLog('mysub', {
      type: 'poll',
      title: 'Poll',
      detail: 'd',
      tone: 'neutral',
    });
    expect(entry.title).toBe('Poll');
    const list = await readActionLog('mysub');
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(entry.id);
  });
});

// ---------------------------------------------------------------------------
// readActionLog
// ---------------------------------------------------------------------------
describe('readActionLog', () => {
  it('returns empty array when no entries exist', async () => {
    const list = await readActionLog('mysub');
    expect(list).toEqual([]);
  });

  it('returns entries most-recent-first', async () => {
    await appendAction('mysub', { type: 'system', title: 'one', detail: 'd', tone: 'neutral' });
    // Ensure distinct timestamps so the zset ordering is deterministic.
    await new Promise((r) => setTimeout(r, 2));
    await appendAction('mysub', { type: 'system', title: 'two', detail: 'd', tone: 'neutral' });
    await new Promise((r) => setTimeout(r, 2));
    await appendAction('mysub', { type: 'system', title: 'three', detail: 'd', tone: 'neutral' });
    const list = await readActionLog('mysub');
    expect(list.map((e) => e.title)).toEqual(['three', 'two', 'one']);
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await appendAction('mysub', {
        type: 'system',
        title: `t${i}`,
        detail: 'd',
        tone: 'neutral',
      });
      await new Promise((r) => setTimeout(r, 1));
    }
    const list = await readActionLog('mysub', 2);
    expect(list).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// undoAction
// ---------------------------------------------------------------------------
describe('undoAction', () => {
  it('reverses an addPeer undo by calling addTrustedPeer', async () => {
    const entry = await appendAction('mysub', {
      type: 'peer',
      title: 'Removed r/peer1',
      detail: 'd',
      tone: 'warning',
      undo: { kind: 'addPeer', peer: 'peer1' },
    });
    const detail = await undoAction('mysub', entry.id);
    expect(addTrustedPeer).toHaveBeenCalledWith('mysub', 'peer1');
    expect(detail).toMatch(/peer1/);
  });

  it('reverses a removePeer undo by calling removeTrustedPeer', async () => {
    const entry = await appendAction('mysub', {
      type: 'peer',
      title: 'Added r/peer2',
      detail: 'd',
      tone: 'success',
      undo: { kind: 'removePeer', peer: 'peer2' },
    });
    const detail = await undoAction('mysub', entry.id);
    expect(removeTrustedPeer).toHaveBeenCalledWith('mysub', 'peer2');
    expect(detail).toMatch(/peer2/);
  });

  it('throws when the entry id does not exist', async () => {
    await expect(undoAction('mysub', 'nope')).rejects.toThrow(/not found/);
  });

  it('throws when the entry has no undo payload', async () => {
    const entry = await appendAction('mysub', {
      type: 'system',
      title: 't',
      detail: 'd',
      tone: 'neutral',
    });
    await expect(undoAction('mysub', entry.id)).rejects.toThrow(/cannot be undone/);
  });

  it('refuses to undo the same entry twice', async () => {
    const entry = await appendAction('mysub', {
      type: 'peer',
      title: 'Removed r/peer3',
      detail: 'd',
      tone: 'warning',
      undo: { kind: 'addPeer', peer: 'peer3' },
    });
    await undoAction('mysub', entry.id);
    await expect(undoAction('mysub', entry.id)).rejects.toThrow(/already undone/);
  });
});
