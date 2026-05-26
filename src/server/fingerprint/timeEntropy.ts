/**
 * src/server/fingerprint/timeEntropy.ts
 *
 * Posting-time entropy signal. Humans cluster posts in their waking hours;
 * karma-farm bots either post uniformly across 24h (high entropy) or on
 * rigid schedules. We capture both deviations with a 24-bin UTC hour
 * histogram, Shannon entropy, and KL divergence vs a human baseline.
 *
 * See docs/FINGERPRINT_SPEC.md section 1.
 */

import type { TimeEntropySignal } from '../../shared/types.js';

/** Minimum timestamps required for the histogram to be meaningful. */
export const MIN_TIMESTAMPS = 20;

/** log2(24) ≈ 4.585 — maximum possible Shannon entropy on 24 bins. */
export const MAX_ENTROPY = Math.log2(24);

/**
 * Approximate human baseline distribution. Peaks roughly 13:00–04:00 UTC
 * (covering Americas waking hours; weights all hours non-zero to keep KL
 * finite). Per-sub baselines come in a later phase; this hardcoded prior
 * gets us separation of obvious bots vs humans in the meantime.
 */
export const HUMAN_BASELINE_UTC: readonly number[] = (() => {
  const raw = [
    0.015, 0.012, 0.010, 0.009, 0.009, 0.010, 0.012, 0.018,
    0.025, 0.032, 0.038, 0.042, 0.044, 0.046, 0.048, 0.050,
    0.052, 0.055, 0.060, 0.065, 0.070, 0.062, 0.045, 0.025,
  ];
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / sum);
})();

/** Build a 24-bin UTC hour-of-day histogram from a list of Date timestamps. */
export function buildHourHistogram(timestamps: readonly Date[]): number[] {
  const bins = new Array<number>(24).fill(0);
  for (const ts of timestamps) {
    const hour = ts.getUTCHours();
    bins[hour] = (bins[hour] ?? 0) + 1;
  }
  return bins;
}

/** Normalise a histogram to a probability distribution summing to 1. */
export function normaliseHistogram(hist: readonly number[]): number[] {
  const total = hist.reduce((a, b) => a + b, 0);
  if (total === 0) return hist.map(() => 0);
  return hist.map((c) => c / total);
}

/** Shannon entropy in bits. Returns a value in [0, log2(24)]. */
export function shannonEntropy(p: readonly number[]): number {
  const EPS = 1e-12;
  let h = 0;
  for (const pi of p) {
    if (pi > 0) h -= pi * Math.log2(pi + EPS);
  }
  return h;
}

/** KL divergence D(p || q) in bits. */
export function klDivergence(p: readonly number[], q: readonly number[]): number {
  const EPS = 1e-9;
  let kl = 0;
  for (let i = 0; i < p.length; i++) {
    const pi = p[i] ?? 0;
    const qi = q[i] ?? 0;
    if (pi > 0) kl += pi * Math.log2((pi + EPS) / Math.max(qi, EPS));
  }
  return kl;
}

/**
 * Compute the time-entropy signal for a user given their post/comment
 * timestamps. Returns null if there is insufficient history.
 */
export function computeTimeEntropySignal(
  timestamps: readonly Date[],
): TimeEntropySignal | null {
  if (timestamps.length < MIN_TIMESTAMPS) return null;

  const hist = buildHourHistogram(timestamps);
  const p = normaliseHistogram(hist);
  const kl = klDivergence(p, HUMAN_BASELINE_UTC);

  // Cast to the fixed 24-tuple required by the discriminated-union type.
  const hourHistogram = hist as unknown as TimeEntropySignal['hourHistogram'];

  return {
    kind: 'time_entropy',
    klDivergence: kl,
    hourHistogram,
  };
}

/**
 * Quick anomaly classifier — coarse 0..1 suspicion score from this signal
 * alone (no peer comparison yet). Used for single-sub MVP UI before the
 * full peer-match composite lands.
 */
export function timeEntropyAnomaly(signal: TimeEntropySignal): number {
  const p = normaliseHistogram(signal.hourHistogram);
  const h = shannonEntropy(p);
  // Uniformity regime: H close to log2(24) → likely uniform bot
  const uniformity = Math.max(0, (h - 3.8) / (MAX_ENTROPY - 3.8));
  // Divergence regime: high KL = posting in non-human hours / rigid
  const klFlag = Math.min(1, signal.klDivergence / 2.0);
  return Math.min(1, Math.max(uniformity, klFlag));
}
