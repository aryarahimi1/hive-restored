/**
 * Tests for src/server/modqueue/badgeContext.ts
 *
 * Covers the canRemove / canBan truth table exposed by buildModqueueBadgeContext
 * across settings × fingerprint.composite × matches corners. Devvit redis is
 * mocked; getThreatRecord is mocked so the evidence detail formatter doesn't
 * try to hit the wiki subscriber.
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
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
  reddit: {},
  context: { subredditName: 'testsub' },
  scheduler: {},
}));

vi.mock('../federation/wikiSubscriber', () => ({
  getThreatRecord: vi.fn(async () => null),
}));

import { buildModqueueBadgeContext } from './badgeContext';

function writeSettings(
  sub: string,
  partial: Partial<{
    shadowMode: boolean;
    autoAction: boolean;
    reviewThreshold: number;
    flagThreshold: number;
  }>,
): void {
  const full = {
    shadowMode: true,
    autoAction: false,
    reviewThreshold: 55,
    flagThreshold: 75,
    ...partial,
  };
  store.set(`settings:${sub}`, JSON.stringify(full));
}

function writeFingerprint(username: string, compositeScore: number | null): void {
  if (compositeScore === null) {
    store.set(
      `fp:${username}`,
      JSON.stringify({
        username,
        computedAt: '2026-01-01T00:00:00Z',
        sampleSize: 10,
        corpusChars: 200,
      }),
    );
    return;
  }
  store.set(
    `fp:${username}`,
    JSON.stringify({
      username,
      computedAt: '2026-01-01T00:00:00Z',
      sampleSize: 10,
      corpusChars: 200,
      composite: {
        score: compositeScore,
        band: compositeScore >= 75 ? 'flag' : compositeScore >= 55 ? 'review' : 'clean',
        presentSignals: 2,
      },
    }),
  );
}

function writeMatches(username: string, count: number): void {
  const matches = Array.from({ length: count }, (_, i) => ({
    alertId: `alert${i}`,
    publisherSub: `peer${i}`,
    category: 'spam',
    similarity: 0.9,
    matchedSignal: 'cadence' as const,
  }));
  store.set(`match:${username}`, JSON.stringify(matches));
}

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// buildModqueueBadgeContext — gate truth table
// ---------------------------------------------------------------------------
describe('buildModqueueBadgeContext gates', () => {
  it('returns no fingerprint and no matches when nothing is stored', async () => {
    const ctx = await buildModqueueBadgeContext({
      sub: 'mysub',
      username: 'alice',
      targetId: 't3_abc',
      location: 'post',
    });
    expect(ctx.fingerprint).toBeNull();
    expect(ctx.matches).toEqual([]);
    expect(ctx.canRemove).toBe(false);
    expect(ctx.canBan).toBe(false);
    expect(ctx.scoreLine).toMatch(/no composite score yet/);
  });

  it('keeps actions disabled when score is low and no matches', async () => {
    writeSettings('mysub', { shadowMode: false, autoAction: true });
    writeFingerprint('alice', 30);
    const ctx = await buildModqueueBadgeContext({
      sub: 'mysub',
      username: 'alice',
      targetId: 't3_abc',
      location: 'post',
    });
    expect(ctx.canRemove).toBe(false);
    expect(ctx.canBan).toBe(false);
  });

  it('keeps actions disabled when shadowMode is on, even at high score', async () => {
    writeSettings('mysub', { shadowMode: true, autoAction: true });
    writeFingerprint('alice', 90);
    const ctx = await buildModqueueBadgeContext({
      sub: 'mysub',
      username: 'alice',
      targetId: 't3_abc',
      location: 'post',
    });
    expect(ctx.canRemove).toBe(false);
    expect(ctx.canBan).toBe(false);
    expect(ctx.shadowHint).toMatch(/Shadow mode is on/);
  });

  it('keeps actions disabled when autoAction is off, even at high score', async () => {
    writeSettings('mysub', { shadowMode: false, autoAction: false });
    writeFingerprint('alice', 90);
    const ctx = await buildModqueueBadgeContext({
      sub: 'mysub',
      username: 'alice',
      targetId: 't3_abc',
      location: 'post',
    });
    expect(ctx.canRemove).toBe(false);
    expect(ctx.canBan).toBe(false);
    expect(ctx.shadowHint).toMatch(/Auto-action is off/);
  });

  it('enables remove and ban when shadow off, auto on, and score >= flagThreshold', async () => {
    writeSettings('mysub', { shadowMode: false, autoAction: true });
    writeFingerprint('alice', 90);
    const ctx = await buildModqueueBadgeContext({
      sub: 'mysub',
      username: 'alice',
      targetId: 't3_abc',
      location: 'post',
    });
    expect(ctx.canRemove).toBe(true);
    expect(ctx.canBan).toBe(true);
    expect(ctx.shadowHint).toMatch(/Auto-action is enabled/);
  });

  it('enables remove but not ban when only peer matches exist (no high score)', async () => {
    writeSettings('mysub', { shadowMode: false, autoAction: true });
    writeFingerprint('alice', 40);
    writeMatches('alice', 2);
    const ctx = await buildModqueueBadgeContext({
      sub: 'mysub',
      username: 'alice',
      targetId: 't3_abc',
      location: 'post',
    });
    expect(ctx.canRemove).toBe(true);
    expect(ctx.canBan).toBe(false);
    expect(ctx.evidenceSummary).toMatch(/2 peer matches/);
  });

  it('treats score exactly at flagThreshold as enabling ban', async () => {
    writeSettings('mysub', {
      shadowMode: false,
      autoAction: true,
      flagThreshold: 75,
    });
    writeFingerprint('alice', 75);
    const ctx = await buildModqueueBadgeContext({
      sub: 'mysub',
      username: 'alice',
      targetId: 't3_abc',
      location: 'post',
    });
    expect(ctx.canBan).toBe(true);
  });

  it('falls back to defaults when settings blob is missing and disables actions', async () => {
    // No settings stored: defaults are shadowMode:true, autoAction:false.
    writeFingerprint('alice', 99);
    writeMatches('alice', 5);
    const ctx = await buildModqueueBadgeContext({
      sub: 'mysub',
      username: 'alice',
      targetId: 't3_abc',
      location: 'post',
    });
    expect(ctx.canRemove).toBe(false);
    expect(ctx.canBan).toBe(false);
    expect(ctx.settings.shadowMode).toBe(true);
    expect(ctx.settings.autoAction).toBe(false);
  });
});
