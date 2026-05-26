/**
 * Tests for src/server/federation/publisherSalt.ts and the salted
 * SimHash / MinHash behaviour that depends on it (C-1).
 *
 * Goal: lock in the privacy invariant — same (sub, epoch) reproduces
 * the same hash; changing either input changes the hash. This is what
 * makes hash-replay by external observers infeasible.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory Redis mock so the NX semantics in getOrCreatePublisherSalt
// behave the same way they do at runtime.
const store = new Map<string, string>();

vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(async (key: string) => store.get(key) ?? undefined),
    set: vi.fn(async (key: string, value: string, opts?: { nx?: boolean }) => {
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
  reddit: {},
  context: {},
  scheduler: {},
}));

import {
  getOrCreatePublisherSalt,
  readPublisherSalt,
  weekOf,
  publisherSaltKey,
  saltPrefix,
} from './publisherSalt';
import { simHash128 } from '../fingerprint/ngramCadence';
import { minHashSignature, jaccardSimilarity } from '../fingerprint/domainHistory';

beforeEach(() => {
  store.clear();
});

// ---------------------------------------------------------------------------
// publisherSalt — minting + read-after-write
// ---------------------------------------------------------------------------
describe('getOrCreatePublisherSalt', () => {
  it('mints a 64-hex-char secret on first use and stores it under the canonical key', async () => {
    const salt = await getOrCreatePublisherSalt('alphaSub');
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
    expect(store.get(publisherSaltKey('alphasub'))).toBe(salt);
  });

  it('returns the same secret on subsequent calls', async () => {
    const a = await getOrCreatePublisherSalt('beta');
    const b = await getOrCreatePublisherSalt('beta');
    expect(a).toBe(b);
  });

  it('mints distinct secrets per sub', async () => {
    const a = await getOrCreatePublisherSalt('one');
    const b = await getOrCreatePublisherSalt('two');
    expect(a).not.toBe(b);
  });

  it('readPublisherSalt returns null before the first mint', async () => {
    expect(await readPublisherSalt('never-seen')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// weekOf — ISO 8601 epoch string
// ---------------------------------------------------------------------------
describe('weekOf', () => {
  it('returns YYYY-Www format', () => {
    expect(weekOf(new Date('2026-05-20T12:00:00Z'))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('returns the same epoch for two dates in the same ISO week', () => {
    // Monday 2026-05-18 and Friday 2026-05-22 are both in ISO week 21
    expect(weekOf(new Date('2026-05-18T00:00:00Z'))).toBe(
      weekOf(new Date('2026-05-22T23:59:59Z')),
    );
  });

  it('returns a different epoch when crossing a week boundary', () => {
    // Sunday 2026-05-17 = W20; Monday 2026-05-18 = W21
    expect(weekOf(new Date('2026-05-17T23:00:00Z'))).not.toBe(
      weekOf(new Date('2026-05-18T01:00:00Z')),
    );
  });
});

// ---------------------------------------------------------------------------
// C-1 invariants — salted SimHash is deterministic but unguessable
// without the secret.
// ---------------------------------------------------------------------------
describe('simHash128 with publisher salt', () => {
  const features = ['the cat', 'cat sat', 'sat on', 'i would', 'would just'];

  it('is deterministic for the same (salt, epoch)', async () => {
    const salt = await getOrCreatePublisherSalt('alpha');
    const epoch = weekOf(new Date('2026-05-20T00:00:00Z'));
    const opts = { salt, epoch };
    expect(simHash128(features, opts)).toBe(simHash128(features, opts));
  });

  it('produces different output for different subs (same input + epoch)', async () => {
    const epoch = weekOf(new Date('2026-05-20T00:00:00Z'));
    const a = await getOrCreatePublisherSalt('alpha');
    const b = await getOrCreatePublisherSalt('bravo');
    expect(simHash128(features, { salt: a, epoch })).not.toBe(
      simHash128(features, { salt: b, epoch }),
    );
  });

  it('produces different output for different epochs (same input + sub)', async () => {
    const salt = await getOrCreatePublisherSalt('alpha');
    const e1 = weekOf(new Date('2026-05-18T00:00:00Z')); // W21
    const e2 = weekOf(new Date('2026-05-25T00:00:00Z')); // W22
    expect(e1).not.toBe(e2);
    expect(simHash128(features, { salt, epoch: e1 })).not.toBe(
      simHash128(features, { salt, epoch: e2 }),
    );
  });

  it('matches the unsalted output when opts is omitted (backward compat)', () => {
    // Lower-level unit tests rely on this — the privacy-mode salt is opt-in.
    const a = simHash128(features);
    const b = simHash128(features, {});
    expect(a).toBe(b);
  });
});

describe('minHashSignature with publisher salt', () => {
  const domains = ['evil.shop', 'scammy.io', 'phish.example', 'malware.test'];

  it('two subs salting the same domain set produce signatures with low jaccard', async () => {
    const epoch = weekOf(new Date('2026-05-20T00:00:00Z'));
    const a = await getOrCreatePublisherSalt('alpha');
    const b = await getOrCreatePublisherSalt('bravo');
    const sigA = minHashSignature(domains, { salt: a, epoch });
    const sigB = minHashSignature(domains, { salt: b, epoch });
    // Different salts permute MinHash positions independently — the
    // estimated Jaccard should collapse near zero even though the
    // underlying domain set is identical.
    expect(jaccardSimilarity(sigA, sigB)).toBeLessThan(0.15);
  });

  it('same (salt, epoch) reproduces the signature exactly', async () => {
    const salt = await getOrCreatePublisherSalt('alpha');
    const epoch = weekOf(new Date('2026-05-20T00:00:00Z'));
    expect(minHashSignature(domains, { salt, epoch })).toEqual(
      minHashSignature(domains, { salt, epoch }),
    );
  });
});

// ---------------------------------------------------------------------------
// Internal helper coverage
// ---------------------------------------------------------------------------
describe('saltPrefix', () => {
  it('joins salt and epoch with a colon', () => {
    expect(saltPrefix('abc', '2026-W21')).toBe('abc:2026-W21:');
  });
});
