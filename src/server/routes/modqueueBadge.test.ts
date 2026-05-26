/**
 * Tests for src/server/routes/modqueueBadge.ts — submit handler.
 *
 * Exercises the Hono router via app.request(). The badgeContext, action log,
 * and reddit SDK are all mocked at the module top so each test can dial the
 * canRemove/canBan gates and observe which side-effects fire.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type SubmitJson = {
  showToast: { text: string; appearance: string };
  showForm: { form: { description: string } };
};

// ---------------------------------------------------------------------------
// Mocks for @devvit/web/server — reddit functions are spied on per-test.
// ---------------------------------------------------------------------------
const { addModNote, removeFn, banUser, getCommentById, getPostById } = vi.hoisted(() => ({
  addModNote: vi.fn(async () => undefined),
  removeFn: vi.fn(async () => undefined),
  banUser: vi.fn(async () => undefined),
  getCommentById: vi.fn(async () => ({ authorName: 'alice' })),
  getPostById: vi.fn(async () => ({ authorName: 'alice' })),
}));

vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => undefined),
    incrBy: vi.fn(async () => 1),
  },
  reddit: {
    addModNote,
    remove: removeFn,
    banUser,
    getCommentById,
    getPostById,
  },
  context: { subredditName: 'testsub' },
  scheduler: {},
}));

// ---------------------------------------------------------------------------
// Mock badgeContext so we control canRemove / canBan per test.
// ---------------------------------------------------------------------------
type BadgeCtxOverrides = {
  canRemove?: boolean;
  canBan?: boolean;
  fingerprintScore?: number;
  matches?: Array<{
    alertId: string;
    publisherSub: string;
    category: string;
    similarity: number;
    matchedSignal: 'cadence' | 'domain';
  }>;
};

let badgeOverrides: BadgeCtxOverrides = {};

vi.mock('../modqueue/badgeContext', () => ({
  buildModqueueBadgeContext: vi.fn(async (input: { username: string; targetId: string; location: string }) => ({
    username: input.username,
    targetId: input.targetId,
    location: input.location,
    fingerprint:
      badgeOverrides.fingerprintScore !== undefined
        ? {
            username: input.username,
            computedAt: '2026-01-01T00:00:00Z',
            sampleSize: 10,
            corpusChars: 200,
            composite: {
              score: badgeOverrides.fingerprintScore,
              band: 'flag',
              presentSignals: 2,
            },
          }
        : null,
    matches: badgeOverrides.matches ?? [],
    settings: {
      shadowMode: false,
      autoAction: true,
      reviewThreshold: 55,
      flagThreshold: 75,
    },
    scoreLine: 'score line',
    signalsLine: 'signals line',
    evidenceSummary: 'evidence summary',
    evidenceDetail: 'evidence detail',
    shadowHint: 'shadow hint',
    canRemove: badgeOverrides.canRemove ?? false,
    canBan: badgeOverrides.canBan ?? false,
  })),
}));

// Mock the action log so we can assert it was called on success.
const { appendActionLog } = vi.hoisted(() => ({
  appendActionLog: vi.fn(async () => ({ id: '1', ts: 'now' })),
}));
vi.mock('../storage/actionLog', () => ({
  appendActionLog,
}));

import { modqueueBadgeForms } from './modqueueBadge';

beforeEach(() => {
  badgeOverrides = {};
  addModNote.mockReset();
  removeFn.mockReset();
  banUser.mockReset();
  getCommentById.mockReset();
  getPostById.mockReset();
  appendActionLog.mockReset();
  addModNote.mockResolvedValue(undefined);
  removeFn.mockResolvedValue(undefined);
  banUser.mockResolvedValue(undefined);
  getCommentById.mockResolvedValue({ authorName: 'alice' });
  getPostById.mockResolvedValue({ authorName: 'alice' });
  appendActionLog.mockResolvedValue({ id: '1', ts: 'now' });
});

async function submit(body: unknown): Promise<{ status: number; json: SubmitJson }> {
  const res = await modqueueBadgeForms.request('/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const json = (await res.json()) as SubmitJson;
  return { status: res.status, json };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('modqueueBadgeForms /submit', () => {
  it('rejects when targetId is missing', async () => {
    const { status, json } = await submit({ location: 'post', username: 'alice' });
    expect(status).toBe(200);
    expect(json.showToast.text).toMatch(/missing target context/);
    expect(addModNote).not.toHaveBeenCalled();
  });

  it('rejects when location is not post or comment', async () => {
    const { json } = await submit({
      targetId: 't3_x',
      location: 'modmail',
      username: 'alice',
    });
    expect(json.showToast.text).toMatch(/missing target context/);
  });

  it('re-renders the form with evidence when showEvidence is the only flag', async () => {
    const { json } = await submit({
      targetId: 't3_x',
      location: 'post',
      username: 'alice',
      showEvidence: true,
    });
    expect(json.showForm).toBeDefined();
    expect(json.showForm.form.description).toMatch(/Peer evidence expanded/);
    expect(addModNote).not.toHaveBeenCalled();
    expect(removeFn).not.toHaveBeenCalled();
    expect(banUser).not.toHaveBeenCalled();
  });

  it('showEvidence only expands evidence and does not run selected actions in the same submit', async () => {
    const { json } = await submit({
      targetId: 't3_x',
      location: 'post',
      username: 'alice',
      showEvidence: true,
      actionModNote: true,
    });
    expect(json.showForm).toBeDefined();
    expect(addModNote).not.toHaveBeenCalled();
    expect(removeFn).not.toHaveBeenCalled();
    expect(banUser).not.toHaveBeenCalled();
  });

  it('runs addModNote when actionModNote is true', async () => {
    const { json } = await submit({
      targetId: 't3_x',
      location: 'post',
      username: 'alice',
      actionModNote: true,
    });
    expect(addModNote).toHaveBeenCalledOnce();
    expect(json.showToast.appearance).toBe('success');
    expect(json.showToast.text).toMatch(/mod note/);
    expect(appendActionLog).toHaveBeenCalledOnce();
  });

  it('does NOT remove when actionRemove is true but canRemove is false', async () => {
    badgeOverrides = { canRemove: false };
    const { json } = await submit({
      targetId: 't3_x',
      location: 'post',
      username: 'alice',
      actionRemove: true,
    });
    expect(removeFn).not.toHaveBeenCalled();
    expect(json.showToast.appearance).toBe('neutral');
  });

  it('removes when actionRemove is true and canRemove is true', async () => {
    badgeOverrides = { canRemove: true };
    const { json } = await submit({
      targetId: 't3_x',
      location: 'post',
      username: 'alice',
      actionRemove: true,
    });
    expect(removeFn).toHaveBeenCalledOnce();
    expect(json.showToast.text).toMatch(/removed post/);
    expect(json.showToast.appearance).toBe('success');
  });

  it('does NOT ban when actionBan is true but canBan is false', async () => {
    badgeOverrides = { canBan: false };
    const { json } = await submit({
      targetId: 't3_x',
      location: 'post',
      username: 'alice',
      actionBan: true,
    });
    expect(banUser).not.toHaveBeenCalled();
    expect(json.showToast.appearance).toBe('neutral');
  });

  it('bans when actionBan is true and canBan is true', async () => {
    badgeOverrides = { canBan: true };
    const { json } = await submit({
      targetId: 't3_x',
      location: 'post',
      username: 'alice',
      actionBan: true,
    });
    expect(banUser).toHaveBeenCalledOnce();
    expect(json.showToast.text).toMatch(/ban/);
    expect(json.showToast.appearance).toBe('success');
  });

  it('returns a neutral toast when no actions fired', async () => {
    const { json } = await submit({
      targetId: 't3_x',
      location: 'post',
      username: 'alice',
    });
    expect(json.showToast.appearance).toBe('neutral');
    expect(json.showToast.text).toMatch(/no actions selected/);
    expect(appendActionLog).not.toHaveBeenCalled();
  });

  it('returns invalid-form toast when body is not JSON', async () => {
    const { json } = await submit('not-json');
    expect(json.showToast.text).toMatch(/invalid form submission/);
  });

  it('rejects when client-supplied username does not match resolved author', async () => {
    getPostById.mockResolvedValue({ authorName: 'real-author' });
    const { json } = await submit({
      targetId: 't3_x',
      location: 'post',
      username: 'attacker-supplied',
      actionBan: true,
    });
    expect(json.showToast.text).toMatch(/author mismatch/);
    expect(addModNote).not.toHaveBeenCalled();
    expect(removeFn).not.toHaveBeenCalled();
    expect(banUser).not.toHaveBeenCalled();
  });
});
