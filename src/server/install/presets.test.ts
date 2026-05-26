/**
 * Tests for src/server/install/presets.ts
 *
 * Pure logic — no Devvit SDK dependencies.
 */
import { describe, it, expect } from 'vitest';
import { PRESETS, getPreset } from './presets';
import type { PresetName } from './presets';

const VALID_PEER_PATTERN = /^[a-z0-9_]{3,21}$/;

// ---------------------------------------------------------------------------
// PRESETS constant
// ---------------------------------------------------------------------------
describe('PRESETS', () => {
  it('defines exactly three presets (starter, midsize, large)', () => {
    expect(PRESETS).toHaveLength(3);
    const names = PRESETS.map((p) => p.name);
    expect(names).toContain('starter');
    expect(names).toContain('midsize');
    expect(names).toContain('large');
  });

  it('starter has exactly 3 peers', () => {
    const starter = PRESETS.find((p) => p.name === 'starter');
    expect(starter?.peers).toHaveLength(3);
  });

  it('midsize has exactly 10 peers', () => {
    const midsize = PRESETS.find((p) => p.name === 'midsize');
    expect(midsize?.peers).toHaveLength(10);
  });

  it('large has exactly 20 peers', () => {
    const large = PRESETS.find((p) => p.name === 'large');
    expect(large?.peers).toHaveLength(20);
  });

  it('all peer names are lowercase with no r/ prefix and pass the valid-name pattern', () => {
    for (const preset of PRESETS) {
      for (const peer of preset.peers) {
        expect(peer, `${preset.name}: "${peer}" should have no r/ prefix`).not.toMatch(/^r\//i);
        expect(peer, `${preset.name}: "${peer}" must be lowercase`).toBe(peer.toLowerCase());
        expect(
          peer,
          `${preset.name}: "${peer}" must match /^[a-z0-9_]{3,21}$/`,
        ).toMatch(VALID_PEER_PATTERN);
      }
    }
  });

  it('each preset has no duplicate peer names', () => {
    for (const preset of PRESETS) {
      const unique = new Set(preset.peers);
      expect(unique.size, `${preset.name} has duplicate peers`).toBe(preset.peers.length);
    }
  });
});

// ---------------------------------------------------------------------------
// getPreset
// ---------------------------------------------------------------------------
describe('getPreset', () => {
  it('returns the starter preset', () => {
    const p = getPreset('starter');
    expect(p.name).toBe('starter');
    expect(p.peers).toHaveLength(3);
  });

  it('returns the midsize preset', () => {
    const p = getPreset('midsize');
    expect(p.name).toBe('midsize');
    expect(p.peers).toHaveLength(10);
  });

  it('returns the large preset', () => {
    const p = getPreset('large');
    expect(p.name).toBe('large');
    expect(p.peers).toHaveLength(20);
  });

  it('throws on an unrecognised preset name', () => {
    expect(() => getPreset('unknown' as PresetName)).toThrow(/unknown preset/i);
  });
});
