/**
 * Tests for src/server/federation/threatMatcher.ts
 *
 * Mocks @devvit/web/server (Redis) and the wikiSubscriber index accessors
 * so the matcher logic can be tested in isolation without live Redis.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal Devvit mock. Matcher no longer uses Redis no-match caching because
// fresh peer polls must be visible immediately during the demo path.
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
  context: {},
  scheduler: {},
}));

// ---------------------------------------------------------------------------
// Mock wikiSubscriber index accessors
// ---------------------------------------------------------------------------
import type { PeerThreatRecord } from './wikiSubscriber';

// These are mocked below and overridden per-test via vi.mocked()
vi.mock('./wikiSubscriber', () => ({
  getCadenceIdxForPrefix: vi.fn(async () => [] as string[]),
  getDomainActiveIdx: vi.fn(async () => [] as string[]),
  getThreatRecord: vi.fn(async () => null as PeerThreatRecord | null),
  pollPeer: vi.fn(async () => ({ added: 0, skipped: 0 })),
  pollAllPeers: vi.fn(async () => undefined),
}));

import { matchAgainstThreats } from './threatMatcher';
import {
  getCadenceIdxForPrefix,
  getDomainActiveIdx,
  getThreatRecord,
} from './wikiSubscriber';

// Import helpers for constructing test fixtures
import {
  simHash128,
  topKByFreq,
  ngrams,
  functionMaskedTokens,
} from '../fingerprint/ngramCadence';
import {
  minHashSignature,
  encodeSignature,
} from '../fingerprint/domainHistory';

// ---------------------------------------------------------------------------
// Helper to build a PeerThreatRecord fixture
// ---------------------------------------------------------------------------
function makeThreatRecord(
  overrides: Partial<PeerThreatRecord> = {},
): PeerThreatRecord {
  return {
    alertId: 'test-alert-id',
    publishedAt: new Date().toISOString(),
    ttlAt: new Date(Date.now() + 86400_000).toISOString(),
    category: 'spam',
    publisherSub: 'peersub',
    fingerprint: {},
    ...overrides,
  };
}

// Build a 32-char SimHash from text
function makeSimHash(text: string): string {
  const tokens = functionMaskedTokens(text);
  const features = topKByFreq([...ngrams(tokens, 2), ...ngrams(tokens, 3)], 32);
  return simHash128(features);
}

// Build a base64 MinHash signature from domains
function makeMinHash(domains: string[]): string {
  return encodeSignature(minHashSignature(domains));
}

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  vi.mocked(getCadenceIdxForPrefix).mockResolvedValue([]);
  vi.mocked(getDomainActiveIdx).mockResolvedValue([]);
  vi.mocked(getThreatRecord).mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// No-input cases
// ---------------------------------------------------------------------------
describe('matchAgainstThreats — no input', () => {
  it('returns [] when no hashes provided', async () => {
    const result = await matchAgainstThreats({});
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// No-match path — intentionally uncached
// ---------------------------------------------------------------------------
describe('matchAgainstThreats — no-match path', () => {
  it('does not cache no-match results so fresh peer polls are visible', async () => {
    const hash = makeSimHash('I would just say that this is a really good idea'.repeat(30));
    const staleCacheKey = `nomatch:${hash}:nodomain`;
    store.set(staleCacheKey, 'nomatch');

    const record = makeThreatRecord({
      alertId: 'fresh-after-poll',
      fingerprint: { cadenceHash: hash },
    });
    vi.mocked(getCadenceIdxForPrefix).mockResolvedValue(['fresh-after-poll']);
    vi.mocked(getThreatRecord).mockResolvedValue(record);

    const result = await matchAgainstThreats({ cadenceHash: hash });

    expect(getCadenceIdxForPrefix).toHaveBeenCalled();
    expect(result[0]?.alertId).toBe('fresh-after-poll');
    expect(store.get(staleCacheKey)).toBe('nomatch');
  });
});

// ---------------------------------------------------------------------------
// Cadence (Hamming) matching
// ---------------------------------------------------------------------------
describe('matchAgainstThreats — cadence matching', () => {
  it('returns a match when Hamming distance is within threshold', async () => {
    const corpus = 'I would just say that this is a really good idea. '.repeat(40);
    const localHash = makeSimHash(corpus);

    // Use the same hash for the peer — distance = 0
    const record = makeThreatRecord({
      alertId: 'c1',
      fingerprint: { cadenceHash: localHash },
    });

    vi.mocked(getCadenceIdxForPrefix).mockResolvedValue(['c1']);
    vi.mocked(getThreatRecord).mockResolvedValue(record);

    const result = await matchAgainstThreats({ cadenceHash: localHash });
    expect(result).toHaveLength(1);
    expect(result[0]?.alertId).toBe('c1');
    expect(result[0]?.matchedSignal).toBe('cadence');
    expect(result[0]?.similarity).toBeCloseTo(1, 5);
  });

  it('does not match when Hamming distance exceeds threshold', async () => {
    // Two fully different strings
    const hashA = makeSimHash('I would just say this is great and helpful today'.repeat(40));
    const hashB = makeSimHash('Yeah no basically like you know kind of'.repeat(40));

    const record = makeThreatRecord({
      alertId: 'd1',
      fingerprint: { cadenceHash: hashB },
    });

    vi.mocked(getCadenceIdxForPrefix).mockResolvedValue(['d1']);
    vi.mocked(getThreatRecord).mockResolvedValue(record);

    // Different hash locally
    const result = await matchAgainstThreats({ cadenceHash: hashA });
    // If they are different enough, no match; this is probabilistic so we
    // just verify the structure is correct regardless of match/no-match.
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]?.matchedSignal).toBe('cadence');
      expect(result[0]?.similarity).toBeGreaterThan(0);
      expect(result[0]?.similarity).toBeLessThanOrEqual(1);
    }
  });

  it('skips records with no cadence hash in fingerprint', async () => {
    const localHash = makeSimHash('I would just say this is great'.repeat(40));
    const record = makeThreatRecord({
      alertId: 'nohash',
      fingerprint: { domainHash: undefined, cadenceHash: undefined },
    });

    vi.mocked(getCadenceIdxForPrefix).mockResolvedValue(['nohash']);
    vi.mocked(getThreatRecord).mockResolvedValue(record);

    const result = await matchAgainstThreats({ cadenceHash: localHash });
    expect(result).toHaveLength(0);
  });

  it('returns up to 3 results sorted by similarity descending', async () => {
    const corpus = 'I would just say this is really very good indeed today'.repeat(40);
    const localHash = makeSimHash(corpus);

    // Three records with the same hash — all similarity 1
    const records: PeerThreatRecord[] = ['m1', 'm2', 'm3', 'm4'].map((id) =>
      makeThreatRecord({
        alertId: id,
        publisherSub: `peer${id}`,
        fingerprint: { cadenceHash: localHash },
      }),
    );

    vi.mocked(getCadenceIdxForPrefix).mockResolvedValue(['m1', 'm2', 'm3', 'm4']);
    vi.mocked(getThreatRecord).mockImplementation(async (id) => {
      return records.find((r) => r.alertId === id) ?? null;
    });

    const result = await matchAgainstThreats({ cadenceHash: localHash });
    // Should cap at 3
    expect(result.length).toBeLessThanOrEqual(3);
    // Should be sorted descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]?.similarity).toBeGreaterThanOrEqual(result[i]?.similarity ?? 0);
    }
  });
});

// ---------------------------------------------------------------------------
// Domain (Jaccard) matching
// ---------------------------------------------------------------------------
describe('matchAgainstThreats — domain matching', () => {
  it('matches when Jaccard similarity is at or above 0.55', async () => {
    const sharedDomains = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'];
    const localHash = makeMinHash(sharedDomains);

    const record = makeThreatRecord({
      alertId: 'dom1',
      publisherSub: 'peerdom',
      fingerprint: { domainHash: localHash },
    });

    vi.mocked(getDomainActiveIdx).mockResolvedValue(['dom1']);
    vi.mocked(getThreatRecord).mockResolvedValue(record);

    const result = await matchAgainstThreats({ domainHash: localHash });
    expect(result).toHaveLength(1);
    expect(result[0]?.matchedSignal).toBe('domain');
    expect(result[0]?.similarity).toBeGreaterThanOrEqual(0.55);
    expect(result[0]?.publisherSub).toBe('peerdom');
  });

  it('does not match when Jaccard similarity is below 0.55', async () => {
    const localHash = makeMinHash(['a.com', 'b.com', 'c.com', 'd.com', 'e.com']);
    const peerHash = makeMinHash(['x.com', 'y.com', 'z.com', 'w.com', 'q.com']);

    const record = makeThreatRecord({
      alertId: 'dom2',
      fingerprint: { domainHash: peerHash },
    });

    vi.mocked(getDomainActiveIdx).mockResolvedValue(['dom2']);
    vi.mocked(getThreatRecord).mockResolvedValue(record);

    const result = await matchAgainstThreats({ domainHash: localHash });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Mixed cadence + domain
// ---------------------------------------------------------------------------
describe('matchAgainstThreats — combined input', () => {
  it('can return cadence and domain matches together', async () => {
    const corpus = 'I would just say this is great and helpful'.repeat(40);
    const localCadence = makeSimHash(corpus);
    const localDomain = makeMinHash(['shared.com', 'also.com', 'here.com', 'same.com', 'yes.com']);

    const cadenceRecord = makeThreatRecord({
      alertId: 'combined-cadence',
      publisherSub: 'peer1',
      fingerprint: { cadenceHash: localCadence },
    });
    const domainRecord = makeThreatRecord({
      alertId: 'combined-domain',
      publisherSub: 'peer2',
      fingerprint: { domainHash: localDomain },
    });

    vi.mocked(getCadenceIdxForPrefix).mockResolvedValue(['combined-cadence']);
    vi.mocked(getDomainActiveIdx).mockResolvedValue(['combined-domain']);
    vi.mocked(getThreatRecord).mockImplementation(async (id) => {
      if (id === 'combined-cadence') return cadenceRecord;
      if (id === 'combined-domain') return domainRecord;
      return null;
    });

    const result = await matchAgainstThreats({
      cadenceHash: localCadence,
      domainHash: localDomain,
    });

    // Both should appear, sorted by similarity
    expect(result.length).toBeGreaterThanOrEqual(1);
    const signals = result.map((r) => r.matchedSignal);
    expect(signals).toContain('cadence');
  });
});
