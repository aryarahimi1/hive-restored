/**
 * src/server/fingerprint/ngramCadence.ts
 *
 * N-gram cadence signal. Bot rings sharing an LLM base produce similar
 * function-word rhythms ("just want to say", "I would highly recommend").
 * We tokenize, mask out content words to `CONTENT_TAG`, extract 2- and
 * 3-grams, take the top-K by frequency, and SimHash them to a 128-bit
 * fingerprint. Peers compare via Hamming distance.
 *
 * Content masking is deliberate: matching on rare named entities would
 * link innocent users by topic rather than by style.
 *
 * See docs/FINGERPRINT_SPEC.md section 2.
 */

import { createHash } from 'node:crypto';

import type { NgramCadenceSignal, OpaqueHash } from '../../shared/types.js';
import { asOpaqueHash } from '../../shared/types.js';

/** Minimum token volume below which the SimHash is unreliable. */
export const MIN_TOKENS = 400;

/** How many top-frequency n-grams contribute to the SimHash. */
export const TOP_K = 32;

/** Width of the SimHash in bits. */
export const HASH_BITS = 128;

/** Token used to mask non-function words so we match on style, not topic. */
export const CONTENT_TAG = '␡CONTENT␡';

/**
 * High-frequency English function words. Includes pronouns, auxiliaries,
 * articles, prepositions, conjunctions, common intensifiers/qualifiers.
 * Bot rings tend to over- or under-use specific combinations of these,
 * which is what makes the cadence fingerprint discriminative.
 */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  'a','an','the','this','that','these','those',
  'and','but','or','so','yet','if','then','because','as','than','when','while','where','though','although','since','unless','until',
  'i','me','my','mine','myself','you','your','yours','yourself','he','him','his','himself','she','her','hers','herself','it','its','itself','we','us','our','ours','ourselves','they','them','their','theirs','themselves',
  'is','am','are','was','were','be','been','being',
  'have','has','had','having',
  'do','does','did','doing','done',
  'will','would','shall','should','can','could','may','might','must','ought',
  'of','to','in','on','at','by','for','with','from','about','against','between','into','through','during','before','after','above','below','up','down','over','under','out','off','onto','upon','without','within','along','across','toward','towards',
  'not','no','nor','only','just','very','really','quite','rather','too','also','either','neither','both','few','many','some','any','all','every','each','most','more','less','much','such',
  'here','there','where','why','how','what','which','who','whom','whose','when',
  'like','about','say','said','says','get','got','gets','make','made','makes','take','took','takes','go','goes','went','come','came','comes','see','saw','sees','seen','know','knew','knows','known','think','thought','thinks','want','wants','wanted','need','needs','needed','feel','feels','felt','tell','told','tells',
  'one','two','three','first','second','last','next','other','another','same','different','new','old',
  'oh','ah','um','uh','yeah','yes','no','okay','ok',
]);

/** Lowercase + extract word tokens; punctuation is dropped. */
export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g);
  return matches ?? [];
}

/** Map non-function tokens to CONTENT_TAG, leaving function words intact. */
export function functionMaskedTokens(text: string): string[] {
  return tokenize(text).map((tok) =>
    FUNCTION_WORDS.has(tok) ? tok : CONTENT_TAG,
  );
}

/** Extract n-grams from a token stream as joined strings. */
export function ngrams(tokens: readonly string[], n: number): string[] {
  if (n < 1 || tokens.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i + n).join(' '));
  }
  return out;
}

/** Top-K features ranked by frequency. Returns the feature strings themselves. */
export function topKByFreq(grams: readonly string[], k: number): string[] {
  const counts = new Map<string, number>();
  for (const g of grams) counts.set(g, (counts.get(g) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, k).map(([feature]) => feature);
}

/**
 * Optional salt parameters for `hash128` / `simHash128` /
 * `computeNgramCadenceSignal`. When provided, `<salt>:<epoch>:` is
 * prepended to every feature before hashing — see
 * `src/server/federation/publisherSalt.ts` for the privacy rationale.
 *
 * Leaving `opts` undefined preserves pre-salt behaviour, which is what
 * the lower-level unit tests rely on. The publisher and the per-sub
 * local fingerprint pipeline both pass a salt; only naked SimHash unit
 * tests do not.
 */
export interface HashOpts {
  readonly salt?: string;
  readonly epoch?: string;
}

function makeSaltPrefix(opts?: HashOpts): string {
  if (!opts?.salt || !opts.epoch) return '';
  return `${opts.salt}:${opts.epoch}:`;
}

/**
 * Hash a feature string to a 128-bit unsigned BigInt using SHA-256
 * truncated to the high 128 bits. When `opts.salt` + `opts.epoch` are
 * supplied the salt prefix is prepended so output is unique per
 * (publisher, week).
 */
export function hash128(feature: string, opts?: HashOpts): bigint {
  const prefix = makeSaltPrefix(opts);
  const digest = createHash('sha256').update(prefix + feature).digest();
  let out = 0n;
  for (let i = 0; i < 16; i++) {
    out = (out << 8n) | BigInt(digest[i] ?? 0);
  }
  return out;
}

/**
 * SimHash a list of features to a 128-bit fingerprint, returned as a
 * 32-character lowercase hex string. Order independent, frequency-weighted
 * implicitly through repetition in the features list (but we already
 * dedupe to top-K, so each contributes equally).
 *
 * When `opts.salt` + `opts.epoch` are supplied the per-feature hash is
 * salted, which makes the resulting SimHash unique per (publisher, week)
 * — see `src/server/federation/publisherSalt.ts`.
 */
export function simHash128(features: readonly string[], opts?: HashOpts): string {
  const accumulator = new Array<number>(HASH_BITS).fill(0);
  for (const f of features) {
    const h = hash128(f, opts);
    for (let bit = 0; bit < HASH_BITS; bit++) {
      const set = ((h >> BigInt(bit)) & 1n) === 1n;
      accumulator[bit] = (accumulator[bit] ?? 0) + (set ? 1 : -1);
    }
  }
  let out = 0n;
  for (let bit = 0; bit < HASH_BITS; bit++) {
    if ((accumulator[bit] ?? 0) > 0) out |= 1n << BigInt(bit);
  }
  return out.toString(16).padStart(32, '0');
}

/** Hamming distance between two equal-length lowercase-hex strings. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error(`hammingDistance: length mismatch (${a.length} vs ${b.length})`);
  }
  const big = (s: string): bigint => BigInt('0x' + s);
  let x = big(a) ^ big(b);
  let count = 0;
  while (x > 0n) {
    if ((x & 1n) === 1n) count++;
    x >>= 1n;
  }
  return count;
}

/**
 * Compute the n-gram cadence signal for a user given the concatenated text
 * of their recent posts and comments. Returns null when there isn't enough
 * material for a stable SimHash.
 *
 * Pass `opts` (with `salt` and `epoch`) to produce a publisher-scoped
 * fingerprint that cannot be replayed by external observers; omit it for
 * raw SimHash output (used by lower-level tests).
 */
export function computeNgramCadenceSignal(
  corpus: string,
  opts?: HashOpts,
): NgramCadenceSignal | null {
  const tokens = functionMaskedTokens(corpus);
  if (tokens.length < MIN_TOKENS) return null;

  const features = topKByFreq(
    [...ngrams(tokens, 2), ...ngrams(tokens, 3)],
    TOP_K,
  );
  if (features.length === 0) return null;

  const hashHex = simHash128(features, opts);
  return {
    kind: 'ngram_cadence',
    simHash: asOpaqueHash(hashHex),
    sampleSize: tokens.length,
  };
}

/**
 * Single-sub anomaly classifier for the cadence signal. Without a peer
 * fingerprint to compare against, we approximate suspicion via two signals:
 *   - content-word ratio anomaly: humans intersperse function words; bots
 *     producing terse template responses have very high CONTENT_TAG ratios
 *   - n-gram distribution entropy: highly repetitive cadences score low
 * Returns a 0..1 score.
 */
export function ngramCadenceAnomaly(corpus: string): number {
  const tokens = functionMaskedTokens(corpus);
  if (tokens.length < MIN_TOKENS / 4) return 0;

  const contentCount = tokens.filter((t) => t === CONTENT_TAG).length;
  const contentRatio = contentCount / tokens.length;
  // Most humans: 0.55–0.75 content. < 0.4 = too many function words (template);
  // > 0.9 = almost no function words (terse bot).
  const contentAnomaly = Math.max(
    contentRatio > 0.9 ? (contentRatio - 0.9) * 10 : 0,
    contentRatio < 0.35 ? (0.35 - contentRatio) * 5 : 0,
  );

  const grams = ngrams(tokens, 3);
  const counts = new Map<string, number>();
  for (const g of grams) counts.set(g, (counts.get(g) ?? 0) + 1);
  const total = grams.length || 1;
  let entropy = 0;
  for (const c of counts.values()) {
    const p = c / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(counts.size || 1);
  const normalized = maxEntropy > 0 ? entropy / maxEntropy : 0;
  // Low normalized entropy = repetitive
  const repetitionAnomaly = Math.max(0, 0.4 - normalized) * 2;

  return Math.min(1, Math.max(contentAnomaly, repetitionAnomaly));
}

/** Re-export the OpaqueHash brand for ergonomic test imports. */
export type { OpaqueHash };
