/**
 * Tests for src/server/routes/forms.ts (validatePeerName) and
 * the relativeTime / saveLastPoll / loadLastPoll helpers in menu.ts.
 *
 * No HTTP layer is tested here — the Hono handler is trivially thin and
 * the interesting logic lives in pure helpers that are easy to unit-test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory Redis mock (shared across modules that import @devvit/web/server)
// ---------------------------------------------------------------------------
const store = new Map<string, string>();

const { appendActionLog } = vi.hoisted(() => ({
  appendActionLog: vi.fn(async () => ({ id: '1', ts: 'now' })),
}));

vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(async (key: string) => store.get(key) ?? undefined),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
  reddit: {},
  context: { subredditName: 'testsub' },
  scheduler: {},
}));

// Also mock trustGraph and wikiSubscriber so forms.ts can import cleanly
vi.mock('../storage/trustGraph', () => ({
  addTrustedPeer: vi.fn(async () => undefined),
  getTrustedPeers: vi.fn(async () => []),
  removeTrustedPeer: vi.fn(async () => undefined),
}));

vi.mock('../storage/actionLog', () => ({
  appendActionLog,
}));

vi.mock('../federation/wikiSubscriber', () => ({
  pollPeer: vi.fn(async () => ({ added: 0, skipped: 0 })),
  pollAllPeers: vi.fn(async () => undefined),
  getCadenceIdxForPrefix: vi.fn(async () => []),
  getDomainActiveIdx: vi.fn(async () => []),
  getThreatRecord: vi.fn(async () => null),
}));

vi.mock('../core/post', () => ({
  createPost: vi.fn(async () => ({ id: 'abc123' })),
}));

// Bypass moderator auth for these handler-shape tests. The check itself is
// exercised in src/server/moderator.test.ts.
vi.mock('../moderator', () => ({
  requireSubredditName: vi.fn(() => 'testsub'),
  assertCurrentUserIsModerator: vi.fn(async () => 'modUser'),
  withModeratorAccess: vi.fn(async (fn: (s: string, u: string) => unknown) =>
    fn('testsub', 'modUser'),
  ),
}));

import { forms, normalisePresetName, validatePeerName } from './forms';
import { addTrustedPeer } from '../storage/trustGraph';
import { relativeTime, saveLastPoll, loadLastPoll } from './menu';

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  appendActionLog.mockResolvedValue({ id: '1', ts: 'now' });
});

// ---------------------------------------------------------------------------
// validatePeerName
// ---------------------------------------------------------------------------
describe('validatePeerName', () => {
  it('accepts a plain subreddit name', () => {
    const result = validatePeerName('ModSupport');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.peer).toBe('modsupport');
  });

  it('strips the r/ prefix (case-insensitive)', () => {
    const result = validatePeerName('r/ModSupport');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.peer).toBe('modsupport');
  });

  it('strips surrounding whitespace', () => {
    const result = validatePeerName('  pics  ');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.peer).toBe('pics');
  });

  it('accepts underscores', () => {
    const result = validatePeerName('mod_news');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.peer).toBe('mod_news');
  });

  it('rejects empty string', () => {
    const result = validatePeerName('');
    expect(result.ok).toBe(false);
  });

  it('rejects non-string values', () => {
    const result = validatePeerName(undefined);
    expect(result.ok).toBe(false);
  });

  it('rejects names shorter than 3 characters', () => {
    const result = validatePeerName('ab');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/3/);
  });

  it('rejects names longer than 21 characters', () => {
    const result = validatePeerName('a'.repeat(22));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/21/);
  });

  it('rejects names with internal spaces', () => {
    const result = validatePeerName('mod news');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/space/i);
  });

  it('rejects names with special characters', () => {
    const result = validatePeerName('mod-news!');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/letters/i);
  });

  it('accepts exactly 3-character name', () => {
    const result = validatePeerName('abc');
    expect(result.ok).toBe(true);
  });

  it('accepts exactly 21-character name', () => {
    const result = validatePeerName('a'.repeat(21));
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalisePresetName / applyPreset form
// ---------------------------------------------------------------------------
describe('normalisePresetName', () => {
  it('accepts a direct preset string', () => {
    expect(normalisePresetName('midsize')).toBe('midsize');
  });

  it('accepts Devvit select payloads as a one-item array', () => {
    expect(normalisePresetName(['midsize'])).toBe('midsize');
  });

  it('rejects unknown or multi-value payloads', () => {
    expect(normalisePresetName('tiny')).toBeNull();
    expect(normalisePresetName(['starter', 'large'])).toBeNull();
  });
});

type FormJson = {
  showToast?: { text: string; appearance: string };
};

async function submitApplyPreset(preset: unknown): Promise<{ status: number; json: FormJson }> {
  const res = await forms.request('/apply-preset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preset }),
  });
  const json: FormJson = await res.json();
  return { status: res.status, json };
}

describe('forms /apply-preset', () => {
  it('accepts Devvit select string[] payload and adds all 10 midsize peers', async () => {
    vi.mocked(addTrustedPeer).mockResolvedValue(true);

    const { status, json } = await submitApplyPreset(['midsize']);

    expect(status).toBe(200);
    expect(addTrustedPeer).toHaveBeenCalledTimes(10);
    expect(addTrustedPeer).toHaveBeenNthCalledWith(1, 'testsub', 'modsupport');
    expect(addTrustedPeer).toHaveBeenNthCalledWith(10, 'testsub', 'nostupidquestions');
    expect(appendActionLog).toHaveBeenCalledOnce();
    expect(json.showToast?.text).toContain('10 added');
    expect(json.showToast?.appearance).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// relativeTime
// ---------------------------------------------------------------------------
describe('relativeTime', () => {
  it('shows seconds for durations under 60s', () => {
    expect(relativeTime(30_000)).toBe('30s ago');
    expect(relativeTime(0)).toBe('0s ago');
    expect(relativeTime(59_999)).toBe('59s ago');
  });

  it('shows minutes for durations 60s–3599s', () => {
    expect(relativeTime(60_000)).toBe('1m ago');
    expect(relativeTime(90_000)).toBe('1m ago');
    expect(relativeTime(120_000)).toBe('2m ago');
    expect(relativeTime(3_599_000)).toBe('59m ago');
  });

  it('shows hours for durations 1h–23h', () => {
    expect(relativeTime(3_600_000)).toBe('1h ago');
    expect(relativeTime(7_200_000)).toBe('2h ago');
    expect(relativeTime(23 * 3_600_000)).toBe('23h ago');
  });

  it('shows days for durations >= 24h', () => {
    expect(relativeTime(24 * 3_600_000)).toBe('1d ago');
    expect(relativeTime(48 * 3_600_000)).toBe('2d ago');
  });
});

// ---------------------------------------------------------------------------
// saveLastPoll / loadLastPoll
// ---------------------------------------------------------------------------
describe('saveLastPoll / loadLastPoll', () => {
  it('round-trips a LastPollRecord through Redis', async () => {
    const record = { ts: Date.now(), peers: 3, added: 5, skipped: 2 };
    await saveLastPoll('testsub', record);
    const loaded = await loadLastPoll('testsub');
    expect(loaded).toEqual(record);
  });

  it('returns null when nothing has been stored', async () => {
    const loaded = await loadLastPoll('nosub');
    expect(loaded).toBeNull();
  });

  it('stores per-sub — different subs do not share records', async () => {
    const recordA = { ts: 1000, peers: 1, added: 1, skipped: 0 };
    const recordB = { ts: 2000, peers: 2, added: 0, skipped: 1 };
    await saveLastPoll('subA', recordA);
    await saveLastPoll('subB', recordB);
    expect(await loadLastPoll('subA')).toEqual(recordA);
    expect(await loadLastPoll('subB')).toEqual(recordB);
  });
});
