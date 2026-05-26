/**
 * Tests for src/server/storage/settings.ts
 *
 * Mocks @devvit/web/server with an in-memory Redis. Covers default fallback,
 * the parse path, malformed-JSON resilience, shape-validation rejection, and
 * the saveSettings round-trip.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory Redis mock
// ---------------------------------------------------------------------------
const store = new Map<string, string>();

vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(async (key: string) => store.get(key) ?? undefined),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
  reddit: {},
  context: { subredditName: 'testsub' },
  scheduler: {},
}));

import { getSettings, saveSettings, DEFAULT_SETTINGS } from './settings';

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getSettings
// ---------------------------------------------------------------------------
describe('getSettings', () => {
  it('returns DEFAULT_SETTINGS when Redis is empty', async () => {
    const result = await getSettings('mysub');
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the parsed value when a valid blob is stored', async () => {
    store.set(
      'settings:mysub',
      JSON.stringify({
        shadowMode: false,
        autoAction: true,
        reviewThreshold: 40,
        flagThreshold: 80,
      }),
    );
    const result = await getSettings('mysub');
    expect(result).toEqual({
      shadowMode: false,
      autoAction: true,
      reviewThreshold: 40,
      flagThreshold: 80,
    });
  });

  it('falls back to defaults when the stored blob is malformed JSON', async () => {
    store.set('settings:mysub', '{not json');
    const result = await getSettings('mysub');
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults when the stored value has the wrong shape', async () => {
    store.set('settings:mysub', JSON.stringify({ shadowMode: 'yes please' }));
    const result = await getSettings('mysub');
    expect(result).toEqual(DEFAULT_SETTINGS);
  });
});

// ---------------------------------------------------------------------------
// saveSettings
// ---------------------------------------------------------------------------
describe('saveSettings', () => {
  it('round-trips through Redis', async () => {
    const next = {
      shadowMode: false,
      autoAction: true,
      reviewThreshold: 50,
      flagThreshold: 85,
    };
    await saveSettings('mysub', next);
    const loaded = await getSettings('mysub');
    expect(loaded).toEqual(next);
  });

  it('keeps subs isolated', async () => {
    const a = {
      shadowMode: true,
      autoAction: false,
      reviewThreshold: 10,
      flagThreshold: 20,
    };
    const b = {
      shadowMode: false,
      autoAction: true,
      reviewThreshold: 30,
      flagThreshold: 40,
    };
    await saveSettings('subA', a);
    await saveSettings('subB', b);
    expect(await getSettings('subA')).toEqual(a);
    expect(await getSettings('subB')).toEqual(b);
  });
});
