/**
 * Tests for src/server/storage/peerReputation.ts
 *
 * Mocks @devvit/web/server with an in-memory Redis that supports:
 * get / set (with nx + expiration opts) / incrBy
 *
 * Covers: INCR roundtrip, getReputation math, markFalsePositive dedup,
 * isMarkedFalsePositive true/false paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory Redis mock
// ---------------------------------------------------------------------------
const store = new Map<string, string>();

vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(async (key: string) => store.get(key) ?? undefined),
    set: vi.fn(
      async (
        key: string,
        value: string,
        opts?: { nx?: boolean; expiration?: Date },
      ) => {
        if (opts?.nx && store.has(key)) return undefined;
        store.set(key, value);
        return 'OK';
      },
    ),
    incrBy: vi.fn(async (key: string, amount: number) => {
      const current = parseInt(store.get(key) ?? '0', 10);
      const next = current + amount;
      store.set(key, String(next));
      return next;
    }),
  },
  reddit: {},
  context: { subredditName: 'testsub' },
  scheduler: {},
}));

import {
  incrementThreatCount,
  incrementFpCount,
  getReputation,
  markFalsePositive,
  isMarkedFalsePositive,
} from './peerReputation';

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// incrementThreatCount
// ---------------------------------------------------------------------------
describe('incrementThreatCount', () => {
  it('returns 1 on first increment', async () => {
    const result = await incrementThreatCount('peersub');
    expect(result).toBe(1);
  });

  it('accumulates across multiple calls', async () => {
    await incrementThreatCount('peersub');
    await incrementThreatCount('peersub');
    const result = await incrementThreatCount('peersub');
    expect(result).toBe(3);
  });

  it('keeps subs isolated', async () => {
    await incrementThreatCount('peerA');
    await incrementThreatCount('peerA');
    await incrementThreatCount('peerB');
    expect(await incrementThreatCount('peerA')).toBe(3);
    expect(await incrementThreatCount('peerB')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// incrementFpCount
// ---------------------------------------------------------------------------
describe('incrementFpCount', () => {
  it('returns 1 on first increment', async () => {
    const result = await incrementFpCount('peersub');
    expect(result).toBe(1);
  });

  it('increments independently from threat count', async () => {
    await incrementThreatCount('peersub');
    await incrementThreatCount('peersub');
    await incrementFpCount('peersub');
    const rep = await getReputation('peersub');
    expect(rep.threats).toBe(2);
    expect(rep.fp).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getReputation
// ---------------------------------------------------------------------------
describe('getReputation', () => {
  it('returns zeros and zero fpRate when no data exists', async () => {
    const rep = await getReputation('unknown');
    expect(rep).toEqual({ threats: 0, fp: 0, fpRate: 0 });
  });

  it('computes fpRate correctly', async () => {
    // 3 FP out of 47 threats = 6.38%
    for (let i = 0; i < 47; i++) await incrementThreatCount('peersub');
    for (let i = 0; i < 3; i++) await incrementFpCount('peersub');
    const rep = await getReputation('peersub');
    expect(rep.threats).toBe(47);
    expect(rep.fp).toBe(3);
    expect(rep.fpRate).toBe(6.38);
  });

  it('returns fpRate 0 when threats is 0 (no divide-by-zero)', async () => {
    await incrementFpCount('peersub'); // FP without any threats indexed
    const rep = await getReputation('peersub');
    expect(rep.threats).toBe(0);
    expect(rep.fpRate).toBe(0);
  });

  it('returns fpRate 100 when all threats are marked FP', async () => {
    await incrementThreatCount('peersub');
    await incrementFpCount('peersub');
    const rep = await getReputation('peersub');
    expect(rep.fpRate).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// markFalsePositive
// ---------------------------------------------------------------------------
describe('markFalsePositive', () => {
  it('returns firstMark:true on first call', async () => {
    const result = await markFalsePositive('mysub', 'alert-001', 'peersub');
    expect(result.firstMark).toBe(true);
  });

  it('returns firstMark:false on subsequent calls for the same alert', async () => {
    await markFalsePositive('mysub', 'alert-002', 'peersub');
    const second = await markFalsePositive('mysub', 'alert-002', 'peersub');
    expect(second.firstMark).toBe(false);
  });

  it('increments fp counter only on first mark', async () => {
    await markFalsePositive('mysub', 'alert-003', 'peersub');
    await markFalsePositive('mysub', 'alert-003', 'peersub');
    await markFalsePositive('mysub', 'alert-003', 'peersub');
    const rep = await getReputation('peersub');
    expect(rep.fp).toBe(1);
  });

  it('dedup is scoped per currentSub — different subs can each mark once', async () => {
    const r1 = await markFalsePositive('subA', 'alert-004', 'peersub');
    const r2 = await markFalsePositive('subB', 'alert-004', 'peersub');
    expect(r1.firstMark).toBe(true);
    expect(r2.firstMark).toBe(true);
    const rep = await getReputation('peersub');
    expect(rep.fp).toBe(2);
  });

  it('different alertIds on the same sub are tracked independently', async () => {
    const r1 = await markFalsePositive('mysub', 'alert-005', 'peersub');
    const r2 = await markFalsePositive('mysub', 'alert-006', 'peersub');
    expect(r1.firstMark).toBe(true);
    expect(r2.firstMark).toBe(true);
    const rep = await getReputation('peersub');
    expect(rep.fp).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isMarkedFalsePositive
// ---------------------------------------------------------------------------
describe('isMarkedFalsePositive', () => {
  it('returns false when the alert has not been marked', async () => {
    const marked = await isMarkedFalsePositive('mysub', 'alert-notmarked');
    expect(marked).toBe(false);
  });

  it('returns true after markFalsePositive is called', async () => {
    await markFalsePositive('mysub', 'alert-007', 'peersub');
    const marked = await isMarkedFalsePositive('mysub', 'alert-007');
    expect(marked).toBe(true);
  });

  it('is scoped per currentSub', async () => {
    await markFalsePositive('subA', 'alert-008', 'peersub');
    expect(await isMarkedFalsePositive('subA', 'alert-008')).toBe(true);
    expect(await isMarkedFalsePositive('subB', 'alert-008')).toBe(false);
  });
});
