import { describe, it, expect } from 'vitest';
import {
  tokenize,
  functionMaskedTokens,
  ngrams,
  topKByFreq,
  hash128,
  simHash128,
  hammingDistance,
  computeNgramCadenceSignal,
  ngramCadenceAnomaly,
  CONTENT_TAG,
  MIN_TOKENS,
} from './ngramCadence';

describe('tokenize', () => {
  it('lowercases and extracts word tokens', () => {
    expect(tokenize("Hello, World! It's a test.")).toEqual([
      'hello', 'world', "it's", 'a', 'test',
    ]);
  });
});

describe('functionMaskedTokens', () => {
  it('keeps function words and masks content words', () => {
    const out = functionMaskedTokens('I would love to see this rocket launch tomorrow');
    expect(out[0]).toBe('i');
    expect(out[1]).toBe('would');
    expect(out).toContain(CONTENT_TAG); // rocket/launch/tomorrow → masked
  });
});

describe('ngrams', () => {
  it('returns empty array if input too short', () => {
    expect(ngrams(['a'], 2)).toEqual([]);
  });
  it('extracts adjacent token pairs', () => {
    expect(ngrams(['a', 'b', 'c', 'd'], 2)).toEqual(['a b', 'b c', 'c d']);
  });
  it('extracts trigrams', () => {
    expect(ngrams(['a', 'b', 'c', 'd'], 3)).toEqual(['a b c', 'b c d']);
  });
});

describe('topKByFreq', () => {
  it('returns most frequent first', () => {
    const result = topKByFreq(['x', 'x', 'x', 'y', 'y', 'z'], 2);
    expect(result).toEqual(['x', 'y']);
  });
});

describe('hash128 + simHash128', () => {
  it('hash128 is deterministic', () => {
    expect(hash128('hello')).toBe(hash128('hello'));
    expect(hash128('hello') !== hash128('world')).toBe(true);
  });

  it('simHash128 produces 32-hex-char output', () => {
    const h = simHash128(['the cat', 'cat sat', 'sat on']);
    expect(h).toHaveLength(32);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it('identical input → identical SimHash', () => {
    const features = ['i would', 'would just', 'just want'];
    expect(simHash128(features)).toBe(simHash128(features));
  });

  it('different inputs → different SimHashes', () => {
    expect(simHash128(['a b', 'b c'])).not.toBe(simHash128(['x y', 'y z']));
  });
});

describe('hammingDistance', () => {
  it('zero distance for identical hashes', () => {
    expect(hammingDistance('ff'.repeat(16), 'ff'.repeat(16))).toBe(0);
  });
  it('max distance for inverted hashes', () => {
    expect(hammingDistance('00'.repeat(16), 'ff'.repeat(16))).toBe(128);
  });
  it('rejects length mismatch', () => {
    expect(() => hammingDistance('ff', 'ffff')).toThrow();
  });
});

describe('computeNgramCadenceSignal', () => {
  it('returns null below MIN_TOKENS', () => {
    expect(computeNgramCadenceSignal('hi there')).toBeNull();
  });

  it('returns a signal above MIN_TOKENS', () => {
    // Generate 500+ tokens of varied English
    const sentence = 'The quick brown fox jumps over the lazy dog. ' +
      'I would just love to see this happen again. ';
    const corpus = sentence.repeat(40);
    const sig = computeNgramCadenceSignal(corpus);
    expect(sig).not.toBeNull();
    expect(sig!.kind).toBe('ngram_cadence');
    expect(sig!.simHash).toHaveLength(32);
    expect(sig!.sampleSize).toBeGreaterThanOrEqual(MIN_TOKENS);
  });

  it('similar cadence corpora produce SimHashes with small Hamming distance', () => {
    const a = 'I would just say that this is a really good idea. '.repeat(50);
    const b = 'I would just say that this is a really nice idea. '.repeat(50);
    const sigA = computeNgramCadenceSignal(a)!;
    const sigB = computeNgramCadenceSignal(b)!;
    // Same cadence except one masked content word → small Hamming distance
    expect(hammingDistance(sigA.simHash, sigB.simHash)).toBeLessThan(20);
  });

  it('very different cadence corpora produce SimHashes with larger distance', () => {
    const a = 'Yeah, no, like, you know, just, really, basically, kind of. '.repeat(50);
    const b = 'I would highly recommend that you consider this thoroughly. '.repeat(50);
    const sigA = computeNgramCadenceSignal(a)!;
    const sigB = computeNgramCadenceSignal(b)!;
    expect(hammingDistance(sigA.simHash, sigB.simHash)).toBeGreaterThan(20);
  });
});

describe('ngramCadenceAnomaly', () => {
  it('returns 0 for tiny corpora', () => {
    expect(ngramCadenceAnomaly('hi')).toBe(0);
  });

  it('flags terse-content (very high content-word ratio)', () => {
    // Generated stream of mostly content words (gibberish nouns)
    const corpus = (
      'rocket banana terminal printer satellite garbage zenith hashbrown ' +
      'rocket banana terminal printer satellite garbage zenith hashbrown '
    ).repeat(40);
    expect(ngramCadenceAnomaly(corpus)).toBeGreaterThan(0.2);
  });

  it('does NOT flag natural varied human-style text', () => {
    // Realistic varied corpus — multiple distinct sentences, no repetition
    const corpus = [
      'I would say that this is one of the best things that I have seen in a while.',
      'It really does feel like we are getting somewhere with this approach.',
      'Honestly I am not sure what to make of all this, but it seems interesting.',
      'My take is that we should probably try the simpler version first and see what happens.',
      'You know, I have been thinking about this for a few days now and I keep coming back to the same conclusion.',
      'There is something about the way they framed the problem that really resonated with me.',
      'I cannot believe how much progress has been made on this in such a short period.',
      'Some of those points are pretty fair, even if I do not agree with the broader argument.',
      'It might be worth asking around in a few other communities to see if anyone else has run into this.',
      'For what it is worth, my own experience has been very different from what you described.',
      'I had a similar issue last year and the fix turned out to be something really minor.',
      'Just wanted to share my perspective in case it is useful to anyone reading this.',
      'Anyway, thanks for taking the time to write up such a detailed explanation.',
      'I think the next step is probably to check whether the same pattern holds elsewhere.',
      'Honestly speaking, I have been on the fence about this for quite a while now.',
    ].join(' ').repeat(3); // mild repetition for token volume; n-grams still varied
    expect(ngramCadenceAnomaly(corpus)).toBeLessThan(0.4);
  });
});
