import { describe, it, expect } from 'vitest';
import {
  computeComposite,
  severityBand,
  bandGlyph,
  DEFAULT_SIGNAL_WEIGHTS,
} from './composite';

describe('severityBand', () => {
  it('maps scores to bands per spec', () => {
    expect(severityBand(0)).toBe('clean');
    expect(severityBand(34)).toBe('clean');
    expect(severityBand(35)).toBe('watch');
    expect(severityBand(54)).toBe('watch');
    expect(severityBand(55)).toBe('review');
    expect(severityBand(74)).toBe('review');
    expect(severityBand(75)).toBe('flag');
    expect(severityBand(100)).toBe('flag');
  });
});

describe('computeComposite', () => {
  it('returns null when all signals are absent', () => {
    expect(computeComposite({})).toBeNull();
  });

  it('clean signals → clean band', () => {
    const r = computeComposite({ timeAnomaly: 0.1, cadenceAnomaly: 0.05, domainAnomaly: 0 });
    expect(r).not.toBeNull();
    expect(r!.band).toBe('clean');
    expect(r!.score).toBeLessThan(35);
  });

  it('all three high signals → flag band with bonus', () => {
    const r = computeComposite({ timeAnomaly: 0.7, cadenceAnomaly: 0.8, domainAnomaly: 0.6 });
    expect(r!.band).toBe('flag');
    expect(r!.score).toBeGreaterThanOrEqual(75);
  });

  it('cadence-dominant weighting', () => {
    const a = computeComposite({ timeAnomaly: 1, cadenceAnomaly: 0, domainAnomaly: 0 });
    const b = computeComposite({ timeAnomaly: 0, cadenceAnomaly: 1, domainAnomaly: 0 });
    expect(b!.score).toBeGreaterThan(a!.score);
  });

  it('respects custom weights', () => {
    const weights = { time: 1, ngram: 0, domain: 0 };
    const r = computeComposite({ timeAnomaly: 1, cadenceAnomaly: 0, domainAnomaly: 0 }, weights);
    expect(r!.score).toBe(100);
  });

  it('handles single signal (no bonus path)', () => {
    const r = computeComposite({ cadenceAnomaly: 0.5 });
    expect(r!.presentSignals).toBe(1);
    expect(r!.score).toBe(50);
  });

  it('two-signal bonus applies when both > 0.5', () => {
    const noBoBonus = computeComposite({ timeAnomaly: 0.4, cadenceAnomaly: 0.6 });
    const withBonus = computeComposite({ timeAnomaly: 0.6, cadenceAnomaly: 0.6 });
    expect(withBonus!.score).toBeGreaterThan(noBoBonus!.score);
  });
});

describe('bandGlyph', () => {
  it('returns an emoji per band', () => {
    expect(bandGlyph('clean')).toBe('🟢');
    expect(bandGlyph('watch')).toBe('🟡');
    expect(bandGlyph('review')).toBe('🟠');
    expect(bandGlyph('flag')).toBe('🔴');
  });
});

describe('weight sanity', () => {
  it('default weights sum to 1', () => {
    const { time, ngram, domain } = DEFAULT_SIGNAL_WEIGHTS;
    expect(time + ngram + domain).toBeCloseTo(1, 5);
  });
});
