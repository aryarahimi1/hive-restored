/**
 * Tests for src/server/storage/metrics.ts
 *
 * Mocks @devvit/web/server so we can run the redis-backed counters under
 * vitest. The in-memory store simulates the subset of redis ops the module
 * uses: get and incrBy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory Redis mock
// ---------------------------------------------------------------------------
const kv = new Map<string, string>();

vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(async (key: string) => kv.get(key) ?? undefined),
    incrBy: vi.fn(async (key: string, by: number) => {
      const raw = kv.get(key);
      const current = raw ? Number.parseInt(raw, 10) : 0;
      const next = (Number.isNaN(current) ? 0 : current) + by;
      kv.set(key, String(next));
      return next;
    }),
  },
}));

import {
  getMetricsSummary,
  incFalsePositive,
  incFederationAlert,
  incFlagRaised,
  incModAction,
} from './metrics';

beforeEach(() => {
  kv.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Increment helpers
// ---------------------------------------------------------------------------
describe('increment helpers', () => {
  it('incFlagRaised bumps metrics:flags', async () => {
    await incFlagRaised();
    expect(kv.get('metrics:flags')).toBe('1');
    await incFlagRaised();
    expect(kv.get('metrics:flags')).toBe('2');
  });

  it('incFalsePositive bumps metrics:fp', async () => {
    await incFalsePositive();
    expect(kv.get('metrics:fp')).toBe('1');
  });

  it('incFederationAlert bumps metrics:fed:alerts', async () => {
    await incFederationAlert();
    await incFederationAlert();
    await incFederationAlert();
    expect(kv.get('metrics:fed:alerts')).toBe('3');
  });

  it('incModAction("ban") bumps metrics:action:ban only', async () => {
    await incModAction('ban');
    expect(kv.get('metrics:action:ban')).toBe('1');
    expect(kv.get('metrics:action:remove')).toBeUndefined();
    expect(kv.get('metrics:action:modnote')).toBeUndefined();
  });

  it('incModAction("remove") bumps metrics:action:remove only', async () => {
    await incModAction('remove');
    expect(kv.get('metrics:action:remove')).toBe('1');
    expect(kv.get('metrics:action:ban')).toBeUndefined();
    expect(kv.get('metrics:action:modnote')).toBeUndefined();
  });

  it('incModAction("modnote") bumps metrics:action:modnote only', async () => {
    await incModAction('modnote');
    expect(kv.get('metrics:action:modnote')).toBe('1');
    expect(kv.get('metrics:action:ban')).toBeUndefined();
    expect(kv.get('metrics:action:remove')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getMetricsSummary
// ---------------------------------------------------------------------------
describe('getMetricsSummary', () => {
  it('returns zeros when nothing has been incremented', async () => {
    const summary = await getMetricsSummary();
    expect(summary).toEqual({
      flagsRaised: 0,
      modActions: { ban: 0, remove: 0, modnote: 0, total: 0 },
      falsePositives: 0,
      federationAlerts: 0,
    });
  });

  it('returns correct numbers after a mix of increments', async () => {
    await incFlagRaised();
    await incFlagRaised();
    await incFlagRaised();
    await incModAction('ban');
    await incModAction('ban');
    await incModAction('remove');
    await incModAction('modnote');
    await incModAction('modnote');
    await incModAction('modnote');
    await incModAction('modnote');
    await incFalsePositive();
    await incFederationAlert();
    await incFederationAlert();

    const summary = await getMetricsSummary();
    expect(summary).toEqual({
      flagsRaised: 3,
      modActions: { ban: 2, remove: 1, modnote: 4, total: 7 },
      falsePositives: 1,
      federationAlerts: 2,
    });
  });

  it('modActions.total is the sum of the three kinds', async () => {
    await incModAction('ban');
    await incModAction('ban');
    await incModAction('ban');
    await incModAction('remove');
    await incModAction('remove');
    await incModAction('modnote');

    const summary = await getMetricsSummary();
    expect(summary.modActions.total).toBe(
      summary.modActions.ban +
        summary.modActions.remove +
        summary.modActions.modnote,
    );
    expect(summary.modActions.total).toBe(6);
  });
});
