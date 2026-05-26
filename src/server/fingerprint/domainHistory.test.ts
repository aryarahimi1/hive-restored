import { describe, it, expect } from 'vitest';
import {
  extractDomain,
  extractDomainsFromCorpus,
  minHashSignature,
  jaccardSimilarity,
  encodeSignature,
  decodeSignature,
  computeDomainHistorySignal,
  domainHistoryAnomaly,
  MIN_DOMAINS,
  MINHASH_K,
} from './domainHistory';

describe('extractDomain', () => {
  it('returns eTLD+1 for normal URLs', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('example.com');
    expect(extractDomain('http://blog.foo.com/x')).toBe('foo.com');
    expect(extractDomain('https://reddit.com/r/devvit')).toBe('reddit.com');
  });

  it('returns null on garbage', () => {
    expect(extractDomain('not a url')).toBeNull();
    expect(extractDomain('http://localhost/x')).toBeNull();
  });
});

describe('extractDomainsFromCorpus', () => {
  it('finds URLs in text and dedupes', () => {
    const text =
      'check https://example.com out and also https://example.com/other ' +
      'and https://different.io maybe';
    const out = extractDomainsFromCorpus(text);
    expect(out).toContain('example.com');
    expect(out).toContain('different.io');
    expect(out.length).toBe(2);
  });

  it('filters denylisted domains', () => {
    const text = 'https://reddit.com/r/x https://imgur.com/y https://niche.shop/z';
    const out = extractDomainsFromCorpus(text);
    expect(out).toEqual(['niche.shop']);
  });
});

describe('minHashSignature + jaccardSimilarity', () => {
  it('identical sets → similarity 1', () => {
    const domains = ['a.com', 'b.com', 'c.com'];
    const sigA = minHashSignature(domains);
    const sigB = minHashSignature(domains);
    expect(jaccardSimilarity(sigA, sigB)).toBe(1);
  });

  it('disjoint sets → similarity near 0', () => {
    const sigA = minHashSignature(['a.com', 'b.com', 'c.com', 'd.com', 'e.com']);
    const sigB = minHashSignature(['x.com', 'y.com', 'z.com', 'w.com', 'q.com']);
    expect(jaccardSimilarity(sigA, sigB)).toBeLessThan(0.15);
  });

  it('overlapping sets → intermediate similarity', () => {
    const sigA = minHashSignature(['a.com', 'b.com', 'c.com', 'd.com']);
    const sigB = minHashSignature(['a.com', 'b.com', 'e.com', 'f.com']);
    const s = jaccardSimilarity(sigA, sigB);
    // True Jaccard = 2/6 = 0.33; MinHash estimate should be in 0.2..0.5
    expect(s).toBeGreaterThan(0.2);
    expect(s).toBeLessThan(0.6);
  });

  it('signature length matches MINHASH_K', () => {
    expect(minHashSignature(['a.com']).length).toBe(MINHASH_K);
  });
});

describe('encodeSignature / decodeSignature', () => {
  it('roundtrips a signature without loss', () => {
    const sig = minHashSignature(['one.com', 'two.com', 'three.com']);
    const b64 = encodeSignature(sig);
    const decoded = decodeSignature(b64);
    expect(decoded).toEqual(sig);
  });
});

describe('computeDomainHistorySignal', () => {
  it('returns null below MIN_DOMAINS', () => {
    expect(computeDomainHistorySignal('https://only.com')).toBeNull();
  });

  it('returns a signal at or above MIN_DOMAINS distinct domains', () => {
    const corpus = 'check https://a.com https://b.com https://c.com https://d.com out';
    const sig = computeDomainHistorySignal(corpus);
    expect(sig).not.toBeNull();
    expect(sig!.kind).toBe('domain_history');
    expect(sig!.domainCount).toBeGreaterThanOrEqual(MIN_DOMAINS);
  });
});

describe('domainHistoryAnomaly', () => {
  it('returns 0 for diverse linking', () => {
    const corpus = 'https://a.com https://b.com https://c.com https://d.com https://e.com';
    expect(domainHistoryAnomaly(corpus)).toBe(0);
  });

  it('flags heavily concentrated linking', () => {
    const corpus = (
      'https://scammy.shop/x https://scammy.shop/y https://scammy.shop/z ' +
      'https://scammy.shop/w https://scammy.shop/v https://other.com/a'
    );
    // 5/6 to scammy.shop = 0.833 → flagged
    expect(domainHistoryAnomaly(corpus)).toBeGreaterThan(0.1);
  });
});
