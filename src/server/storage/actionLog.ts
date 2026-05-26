import { redis } from '@devvit/web/server';
import { addTrustedPeer, removeTrustedPeer } from './trustGraph';
import { validatePeerName } from '../routes/forms';

const ACTION_LOG_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_ACTIONS = 1000;
const DEFAULT_LIMIT = 30;

export type ActionLogTone = 'neutral' | 'success' | 'warning';

export type UndoAction =
  | { kind: 'addPeer'; peer: string }
  | { kind: 'removePeer'; peer: string };

export type ActionLogEntry = {
  id: string;
  ts: string;
  type: 'peer' | 'poll' | 'publish' | 'match' | 'system';
  title: string;
  detail: string;
  tone: ActionLogTone;
  undo?: UndoAction;
  undoneAt?: string;
};

function actionLogKey(sub: string): string {
  return `action-log:${sub}`;
}

function actionEntryKey(sub: string, id: string): string {
  return `${actionLogKey(sub)}:entry:${id}`;
}

function newEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function pruneActionLog(sub: string): Promise<void> {
  const key = actionLogKey(sub);
  const cutoff = Date.now() - ACTION_LOG_TTL_SECONDS * 1000;
  await redis.zRemRangeByScore(key, 0, cutoff);
  const count = await redis.zCard(key);
  if (count > MAX_ACTIONS) {
    await redis.zRemRangeByRank(key, 0, count - MAX_ACTIONS - 1);
  }
  await redis.expire(key, ACTION_LOG_TTL_SECONDS);
}

function isActionLogEntry(value: unknown): value is ActionLogEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.ts === 'string' &&
    typeof value.type === 'string' &&
    typeof value.title === 'string' &&
    typeof value.detail === 'string' &&
    typeof value.tone === 'string' &&
    (value.undo === undefined || isUndoAction(value.undo)) &&
    (value.undoneAt === undefined || typeof value.undoneAt === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUndoAction(value: unknown): value is UndoAction {
  if (!isRecord(value)) return false;
  if (value.kind !== 'addPeer' && value.kind !== 'removePeer') return false;
  return typeof value.peer === 'string';
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function isRedisSetOk(result: string | undefined): boolean {
  return result === 'OK';
}

export async function getActionLog(sub: string): Promise<ActionLogEntry[]> {
  return await readActionLog(sub, DEFAULT_LIMIT);
}

export async function readActionLog(
  sub: string,
  limit = DEFAULT_LIMIT,
): Promise<ActionLogEntry[]> {
  await pruneActionLog(sub);
  const safeLimit = Math.max(1, Math.min(limit, MAX_ACTIONS));
  const ids = await redis.zRange(actionLogKey(sub), 0, safeLimit - 1, {
    by: 'rank',
    reverse: true,
  });

  const rawEntries = await redis.mGet(ids.map((item) => actionEntryKey(sub, item.member)));
  return rawEntries
    .map((raw) => {
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        return isActionLogEntry(parsed) ? parsed : null;
      } catch {
        return null;
      }
    })
    .filter(isPresent);
}

export async function appendAction(
  sub: string,
  entry: Omit<ActionLogEntry, 'id' | 'ts'>,
): Promise<ActionLogEntry> {
  await pruneActionLog(sub);

  const now = Date.now();
  const next: ActionLogEntry = {
    ...entry,
    id: newEntryId(),
    ts: new Date(now).toISOString(),
  };

  await redis.set(actionEntryKey(sub, next.id), JSON.stringify(next), {
    expiration: new Date(now + ACTION_LOG_TTL_SECONDS * 1000),
  });
  await redis.zAdd(actionLogKey(sub), { member: next.id, score: now });
  await redis.expire(actionLogKey(sub), ACTION_LOG_TTL_SECONDS);

  return next;
}

export async function appendActionLog(
  sub: string,
  entry: Omit<ActionLogEntry, 'id' | 'ts'>,
): Promise<ActionLogEntry> {
  return await appendAction(sub, entry);
}

export async function undoAction(sub: string, entryId: string): Promise<string> {
  const raw = await redis.get(actionEntryKey(sub, entryId));
  if (!raw) {
    throw new Error('Action log entry not found');
  }

  let entry: ActionLogEntry;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isActionLogEntry(parsed)) throw new Error('invalid action log entry');
    entry = parsed;
  } catch {
    throw new Error('Action log entry is corrupted');
  }

  if (entry.undoneAt) {
    throw new Error('This action was already undone');
  }

  if (!entry.undo) {
    throw new Error('This action cannot be undone');
  }

  const peerValidation = validatePeerName(entry.undo.peer);
  if (!peerValidation.ok) {
    throw new Error(peerValidation.error);
  }

  const claimed = await redis.set(`action-undo:${sub}:${entryId}`, '1', {
    nx: true,
    expiration: new Date(Date.now() + ACTION_LOG_TTL_SECONDS * 1000),
  });
  if (!isRedisSetOk(claimed)) {
    throw new Error('This action was already undone');
  }

  const cleared: ActionLogEntry = {
    ...entry,
    undo: undefined,
    undoneAt: new Date().toISOString(),
  };
  await redis.set(actionEntryKey(sub, entryId), JSON.stringify(cleared), {
    expiration: new Date(Date.now() + ACTION_LOG_TTL_SECONDS * 1000),
  });

  let detail: string;
  if (entry.undo.kind === 'addPeer') {
    const changed = await addTrustedPeer(sub, peerValidation.peer);
    detail = changed
      ? `Restored r/${peerValidation.peer} to the trust graph.`
      : `r/${peerValidation.peer} was already in the trust graph.`;
  } else {
    const changed = await removeTrustedPeer(sub, peerValidation.peer);
    detail = changed
      ? `Removed r/${peerValidation.peer} from the trust graph.`
      : `r/${peerValidation.peer} was not in the trust graph.`;
  }

  await appendAction(sub, {
    type: 'system',
    title: `Undid: ${entry.title}`,
    detail,
    tone: 'neutral',
  });

  return detail;
}
