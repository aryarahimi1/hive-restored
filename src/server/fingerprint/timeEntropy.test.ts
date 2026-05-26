import { describe, it, expect } from 'vitest';
import {
  buildHourHistogram,
  normaliseHistogram,
  shannonEntropy,
  klDivergence,
  computeTimeEntropySignal,
  timeEntropyAnomaly,
  HUMAN_BASELINE_UTC,
  MAX_ENTROPY,
} from './timeEntropy';

const date = (utcHour: number): Date => new Date(Date.UTC(2026, 0, 1, utcHour, 0, 0));

describe('buildHourHistogram', () => {
  it('counts each UTC hour bucket', () => {
    const hist = buildHourHistogram([date(0), date(0), date(5), date(23)]);
    expect(hist[0]).toBe(2);
    expect(hist[5]).toBe(1);
    expect(hist[23]).toBe(1);
    expect(hist[12]).toBe(0);
    expect(hist).toHaveLength(24);
  });
});

describe('normaliseHistogram', () => {
  it('sums to 1 for non-empty input', () => {
    const p = normaliseHistogram([2, 4, 4]);
    expect(p[0]).toBeCloseTo(0.2);
    expect(p[1]).toBeCloseTo(0.4);
    expect(p[2]).toBeCloseTo(0.4);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('returns all zeros for empty histogram', () => {
    expect(normaliseHistogram([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('shannonEntropy', () => {
  it('is 0 for a point mass', () => {
    const p = new Array<number>(24).fill(0);
    p[3] = 1;
    expect(shannonEntropy(p)).toBeCloseTo(0, 5);
  });

  it('is maximal for uniform distribution', () => {
    const p = new Array<number>(24).fill(1 / 24);
    expect(shannonEntropy(p)).toBeCloseTo(MAX_ENTROPY, 5);
  });
});

describe('klDivergence', () => {
  it('is 0 when p == q', () => {
    expect(klDivergence(HUMAN_BASELINE_UTC, HUMAN_BASELINE_UTC)).toBeCloseTo(0, 5);
  });

  it('is positive when p diverges from q', () => {
    const p = new Array<number>(24).fill(1 / 24); // uniform
    expect(klDivergence(p, HUMAN_BASELINE_UTC)).toBeGreaterThan(0);
  });
});

describe('computeTimeEntropySignal', () => {
  it('returns null below the minimum sample threshold', () => {
    const tsps = Array.from({ length: 10 }, () => date(12));
    expect(computeTimeEntropySignal(tsps)).toBeNull();
  });

  it('returns a signal at or above the minimum threshold', () => {
    const tsps = Array.from({ length: 30 }, (_, i) => date(i % 24));
    const sig = computeTimeEntropySignal(tsps);
    expect(sig).not.toBeNull();
    expect(sig!.kind).toBe('time_entropy');
    expect(sig!.hourHistogram).toHaveLength(24);
  });
});

describe('timeEntropyAnomaly — bot vs human separation', () => {
  it('flags a uniform-poster (bot-like) as anomalous', () => {
    const tsps: Date[] = [];
    for (let h = 0; h < 24; h++) {
      for (let i = 0; i < 5; i++) tsps.push(date(h));
    }
    const sig = computeTimeEntropySignal(tsps)!;
    expect(timeEntropyAnomaly(sig)).toBeGreaterThan(0.5);
  });

  it('does NOT flag a human-clustered poster as anomalous', () => {
    const tsps: Date[] = [];
    const humanHours = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    for (const h of humanHours) {
      for (let i = 0; i < 8; i++) tsps.push(date(h));
    }
    const sig = computeTimeEntropySignal(tsps)!;
    expect(timeEntropyAnomaly(sig)).toBeLessThan(0.5);
  });
});
