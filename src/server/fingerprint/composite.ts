/**
 * src/server/fingerprint/composite.ts
 *
 * Combines the three signal anomaly scores into a single 0..100 suspicion
 * score per user, plus a coarse severity band for mod UI. Weights come
 * from docs/FINGERPRINT_SPEC.md section 5: n-gram cadence is the hardest
 * to game, so it carries the most weight.
 */

export interface SignalWeights {
  readonly time: number;
  readonly ngram: number;
  readonly domain: number;
}

export const DEFAULT_SIGNAL_WEIGHTS: SignalWeights = {
  time: 0.2,
  ngram: 0.45,
  domain: 0.35,
};

export type SeverityBand = 'clean' | 'watch' | 'review' | 'flag';

export interface CompositeInput {
  readonly timeAnomaly?: number;
  readonly cadenceAnomaly?: number;
  readonly domainAnomaly?: number;
}

export interface CompositeResult {
  readonly score: number; // 0..100
  readonly band: SeverityBand;
  readonly presentSignals: number;
}

/** Lookup table for severity band. */
export function severityBand(score: number): SeverityBand {
  if (score < 35) return 'clean';
  if (score < 55) return 'watch';
  if (score < 75) return 'review';
  return 'flag';
}

/**
 * Combine present signals into a weighted composite. Missing signals
 * are skipped (no penalty / no bonus). Multi-signal agreement gets a
 * small bonus to reflect that bot rings tend to trip multiple signals.
 *
 * Returns null only when ALL signals are absent — in that case the user
 * has so little history we can't say anything useful.
 */
export function computeComposite(
  input: CompositeInput,
  weights: SignalWeights = DEFAULT_SIGNAL_WEIGHTS,
): CompositeResult | null {
  const triples: Array<readonly [number, number]> = [];
  if (input.timeAnomaly !== undefined) triples.push([weights.time, input.timeAnomaly]);
  if (input.cadenceAnomaly !== undefined) triples.push([weights.ngram, input.cadenceAnomaly]);
  if (input.domainAnomaly !== undefined) triples.push([weights.domain, input.domainAnomaly]);

  if (triples.length === 0) return null;

  let num = 0;
  let den = 0;
  for (const [w, a] of triples) {
    num += w * a;
    den += w;
  }
  let base = (num / den) * 100;

  // Multi-signal agreement bonus
  if (triples.length === 3) {
    const min = Math.min(...triples.map(([, a]) => a));
    if (min > 0.4) base = Math.min(100, base + 8);
  } else if (triples.length === 2) {
    const both = triples.every(([, a]) => a > 0.5);
    if (both) base = Math.min(100, base + 4);
  }

  const score = Math.round(base);
  return {
    score,
    band: severityBand(score),
    presentSignals: triples.length,
  };
}

/** Emoji glyph for a severity band — used in mod-facing toasts. */
export function bandGlyph(band: SeverityBand): string {
  switch (band) {
    case 'clean':
      return '🟢';
    case 'watch':
      return '🟡';
    case 'review':
      return '🟠';
    case 'flag':
      return '🔴';
  }
}
