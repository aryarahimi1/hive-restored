/**
 * Tests for the pure auto-action gate exported from triggers.ts.
 *
 * The trigger handler itself is hard to unit-test (Devvit SDK side effects),
 * so we extract and test only the gate's truth table here.
 */
import { describe, it, expect, vi } from 'vitest';

// Stub Devvit imports so triggers.ts can load in the test runtime.
vi.mock('@devvit/web/server', () => ({
  context: { subredditName: 'testsub' },
  redis: {},
  reddit: {},
}));

import {
  shouldAutoRemove,
  shouldAutoWritePeerMatchModNote,
  isExpectedTargetPrefix,
} from './triggers';

const baseSettings = {
  shadowMode: false,
  autoAction: true,
  flagThreshold: 75,
};

describe('shouldAutoRemove', () => {
  it('returns false when shadowMode is on, even with autoAction and score above', () => {
    expect(shouldAutoRemove({ ...baseSettings, shadowMode: true }, 90)).toBe(false);
  });

  it('returns false when autoAction is off, even with shadow off and score above', () => {
    expect(shouldAutoRemove({ ...baseSettings, autoAction: false }, 90)).toBe(false);
  });

  it('returns false when score is below flagThreshold', () => {
    expect(shouldAutoRemove(baseSettings, 74)).toBe(false);
  });

  it('returns true when score equals flagThreshold (>= boundary)', () => {
    expect(shouldAutoRemove(baseSettings, 75)).toBe(true);
  });

  it('returns true when score is above flagThreshold and gates pass', () => {
    expect(shouldAutoRemove(baseSettings, 90)).toBe(true);
  });

  it('returns false when both shadowMode on and autoAction off', () => {
    expect(
      shouldAutoRemove({ ...baseSettings, shadowMode: true, autoAction: false }, 99),
    ).toBe(false);
  });
});

describe('shouldAutoWritePeerMatchModNote', () => {
  it('returns false in shadow mode', () => {
    expect(
      shouldAutoWritePeerMatchModNote({ shadowMode: true, autoAction: true }),
    ).toBe(false);
  });

  it('returns false when autoAction is off, even outside shadow mode', () => {
    expect(
      shouldAutoWritePeerMatchModNote({ shadowMode: false, autoAction: false }),
    ).toBe(false);
  });

  it('returns true only when shadow mode is off and autoAction is on', () => {
    expect(
      shouldAutoWritePeerMatchModNote({ shadowMode: false, autoAction: true }),
    ).toBe(true);
  });
});

describe('isExpectedTargetPrefix', () => {
  it('accepts a comment id with t1_ prefix', () => {
    expect(isExpectedTargetPrefix({ id: 't1_abc123', kind: 'comment' })).toBe(true);
  });

  it('accepts a post id with t3_ prefix', () => {
    expect(isExpectedTargetPrefix({ id: 't3_xyz789', kind: 'post' })).toBe(true);
  });

  it('rejects a bare or mismatched id', () => {
    expect(isExpectedTargetPrefix({ id: 'abc123', kind: 'comment' })).toBe(false);
    expect(isExpectedTargetPrefix({ id: 't3_abc', kind: 'comment' })).toBe(false);
    expect(isExpectedTargetPrefix({ id: 't1_abc', kind: 'post' })).toBe(false);
  });
});
