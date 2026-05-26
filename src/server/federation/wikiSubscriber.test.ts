/**
 * Tests for src/server/federation/wikiSubscriber.ts — pollPeer retry behaviour.
 *
 * Mocks @devvit/web/server's `reddit.getWikiPage` and `redis` so we can drive
 * different failure modes and verify the retry / classification logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory Redis mock (matches threatMatcher.test.ts pattern)
// ---------------------------------------------------------------------------
const store = new Map<string, string>();

const getWikiPageMock = vi.fn();

vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(async (key: string) => store.get(key) ?? undefined),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    incrBy: vi.fn(async () => 1),
  },
  reddit: {
    getWikiPage: (...args: unknown[]) => getWikiPageMock(...args),
  },
  context: {},
  scheduler: {},
}));

// Mock peerReputation to avoid pulling in its real Redis dependencies.
vi.mock('../storage/peerReputation', () => ({
  incrementThreatCount: vi.fn(async () => undefined),
}));

// Mock trustGraph for completeness (not exercised by pollPeer directly).
vi.mock('../storage/trustGraph', () => ({
  getTrustedPeers: vi.fn(async () => []),
}));

import { pollPeer, parseRawThreat, getThreatRecord } from './wikiSubscriber';
import { matchAgainstThreats } from './threatMatcher';
import { computeNgramCadenceSignal } from '../fingerprint/ngramCadence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFeedJson(
  alerts: Array<Record<string, unknown>>,
  publisher: string = 'peersub',
): string {
  return JSON.stringify({
    version: 1,
    publisher,
    alerts,
  });
}

function makeAlert(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    alertId: 'a1',
    publishedAt: new Date().toISOString(),
    ttlAt: new Date(Date.now() + 86400_000).toISOString(),
    category: 'spam',
    fingerprint: {
      cadenceHash: 'a'.repeat(32),
    },
    ...overrides,
  };
}

function makeCadenceHash(
  corpus: string,
  opts?: { salt?: string; epoch?: string },
): string {
  const signal = computeNgramCadenceSignal(corpus, opts);
  if (!signal) throw new Error('test corpus did not produce a cadence signal');
  return signal.simHash;
}

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  getWikiPageMock.mockReset();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------
describe('pollPeer — happy path', () => {
  it('indexes records when page returns valid JSON', async () => {
    getWikiPageMock.mockResolvedValueOnce({
      content: makeFeedJson([makeAlert({ alertId: 'happy-1' })]),
    });

    const result = await pollPeer('peersub');

    expect(result.added).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBeUndefined();
    expect(getWikiPageMock).toHaveBeenCalledTimes(1);
    expect(store.has('threat:happy-1')).toBe(true);
  });

  it('skips records with invalid ttlAt values', async () => {
    getWikiPageMock.mockResolvedValueOnce({
      content: makeFeedJson([
        makeAlert({
          alertId: 'bad-ttl',
          ttlAt: 'not-a-date',
        }),
      ]),
    });

    const result = await pollPeer('peersub');

    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
    expect(store.has('threat:bad-ttl')).toBe(false);
  });

  it('indexes matchableV1 so equivalent behavior matches across publisher/subscriber salts', async () => {
    const corpus = 'I would just say that this is a really good idea because it can help people who are trying to learn how this works. '.repeat(50);
    const epoch = '2026-W21';
    const publisherSalted = makeCadenceHash(corpus, { salt: 'publisher-secret', epoch });
    const subscriberSalted = makeCadenceHash(corpus, { salt: 'subscriber-secret', epoch });
    const matchable = makeCadenceHash(corpus);

    expect(publisherSalted).not.toBe(subscriberSalted);

    getWikiPageMock.mockResolvedValueOnce({
      content: makeFeedJson([
        makeAlert({
          alertId: 'matchable-1',
          fingerprint: {
            cadenceHash: publisherSalted,
            matchableV1: {
              version: 1,
              cadenceHash: matchable,
            },
          },
        }),
      ]),
    });

    const pollResult = await pollPeer('peersub');
    expect(pollResult.added).toBe(1);

    const stored = await getThreatRecord('matchable-1');
    expect(stored?.fingerprint.cadenceHash).toBe(matchable);

    const matches = await matchAgainstThreats({ cadenceHash: matchable });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.alertId).toBe('matchable-1');
    expect(matches[0]?.publisherSub).toBe('peersub');
  });
});

// ---------------------------------------------------------------------------
// Empty / missing page
// ---------------------------------------------------------------------------
describe('pollPeer — empty page', () => {
  it('returns 0 added, no failure when page content is empty', async () => {
    getWikiPageMock.mockResolvedValueOnce({ content: '' });

    const result = await pollPeer('peersub');

    expect(result).toEqual({ added: 0, skipped: 0 });
    expect(getWikiPageMock).toHaveBeenCalledTimes(1);
  });

  it('returns 0 added, no failure when page object is missing content', async () => {
    getWikiPageMock.mockResolvedValueOnce(undefined);

    const result = await pollPeer('peersub');

    expect(result).toEqual({ added: 0, skipped: 0 });
    expect(getWikiPageMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Permanent errors — no retry
// ---------------------------------------------------------------------------
describe('pollPeer — permanent errors', () => {
  it('does NOT retry on a 404-shaped error', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    getWikiPageMock.mockRejectedValueOnce(err);

    const result = await pollPeer('peersub');

    expect(result).toEqual({ added: 0, skipped: 0 });
    expect(result.failed).toBeUndefined();
    expect(getWikiPageMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on a 403-shaped error', async () => {
    const err = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    getWikiPageMock.mockRejectedValueOnce(err);

    const result = await pollPeer('peersub');

    expect(result).toEqual({ added: 0, skipped: 0 });
    expect(getWikiPageMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on a "not found" message error without a status', async () => {
    getWikiPageMock.mockRejectedValueOnce(new Error('wiki page not found'));

    const result = await pollPeer('peersub');

    expect(result).toEqual({ added: 0, skipped: 0 });
    expect(getWikiPageMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Transient errors — retry behaviour
// ---------------------------------------------------------------------------
describe('pollPeer — transient errors with retry', () => {
  it('retries and succeeds after two transient failures', async () => {
    const transient = Object.assign(new Error('rate limited'), { status: 429 });
    getWikiPageMock
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce({
        content: makeFeedJson([makeAlert({ alertId: 'retry-ok' })]),
      });

    const result = await pollPeer('peersub');

    expect(result.added).toBe(1);
    expect(result.failed).toBeUndefined();
    expect(getWikiPageMock).toHaveBeenCalledTimes(3);
    expect(store.has('threat:retry-ok')).toBe(true);
  });

  it('returns failed: true when transient errors exhaust retries (3+ attempts)', async () => {
    const transient = Object.assign(new Error('server error'), { status: 503 });
    getWikiPageMock.mockRejectedValue(transient);

    const result = await pollPeer('peersub');

    expect(result.added).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(true);
    // 1 initial attempt + 2 retries = 3 total
    expect(getWikiPageMock).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// H-1: publisher impersonation
// ---------------------------------------------------------------------------
describe('pollPeer — publisher mismatch (H-1)', () => {
  it('rejects the entire feed when feed.publisher does not match the polled sub', async () => {
    // We poll r/peersub but the wiki body claims publisher: 'attacker'.
    getWikiPageMock.mockResolvedValueOnce({
      content: makeFeedJson([makeAlert({ alertId: 'forged-1' })], 'attacker'),
    });

    const result = await pollPeer('peersub');

    expect(result).toEqual({ added: 0, skipped: 0 });
    expect(store.has('threat:forged-1')).toBe(false);
  });

  it('accepts the feed when feed.publisher matches case-insensitively', async () => {
    getWikiPageMock.mockResolvedValueOnce({
      content: makeFeedJson([makeAlert({ alertId: 'case-ok' })], 'PeerSub'),
    });

    const result = await pollPeer('peersub');

    expect(result.added).toBe(1);
    expect(store.has('threat:case-ok')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// H-3: category allowlist
// ---------------------------------------------------------------------------
describe('parseRawThreat — category allowlist (H-3)', () => {
  it('passes through allowed categories unchanged', () => {
    for (const cat of ['ban_evasion', 'spam', 'harassment', 'unknown']) {
      const record = parseRawThreat(
        {
          alertId: 'x',
          publishedAt: 'now',
          ttlAt: 'later',
          category: cat,
          fingerprint: {},
        },
        'peersub',
      );
      expect(record?.category).toBe(cat);
    }
  });

  it('coerces unknown / hostile category to "unknown"', () => {
    const hostile = '[click here](https://evil.example/grab)';
    const record = parseRawThreat(
      {
        alertId: 'x',
        publishedAt: 'now',
        ttlAt: 'later',
        category: hostile,
        fingerprint: {},
      },
      'peersub',
    );
    expect(record?.category).toBe('unknown');
  });
});
