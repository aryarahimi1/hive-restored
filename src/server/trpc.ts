import { initTRPC } from '@trpc/server';
import { transformer } from '../shared/transformer';
import { Context } from './context';
import { context, reddit, redis } from '@devvit/web/server';
import { countDecrement, countGet, countIncrement } from './core/count';
import { z } from 'zod';
import { addTrustedPeer, getTrustedPeers, removeTrustedPeer } from './storage/trustGraph';
import { appendAction, readActionLog, undoAction } from './storage/actionLog';
import { validatePeerName } from './routes/forms';
import {
  getActiveThreatIds,
  getThreatRecord,
  type PeerThreatRecord,
} from './federation/wikiSubscriber';
import { withModeratorAccess } from './moderator';
import { getSettings, saveSettings, type DashboardSettings } from './storage/settings';
import {
  getReputation,
  isMarkedFalsePositive,
  markFalsePositive,
} from './storage/peerReputation';
import { getMetricsSummary, incFalsePositive } from './storage/metrics';

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create({
  transformer,
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;

type DashboardThreat = {
  alertId: string;
  publisherSub: string;
  category: string;
  publishedAt: string;
  ttlAt: string;
  composite: number | null;
  matchedSignals: string[];
  markedFP: boolean;
};

type LastPollRecord = {
  ts: number;
  peers: number;
  added: number;
  skipped: number;
};

function lastPollKey(sub: string): string {
  return `last_poll:${sub}`;
}

function isLastPollRecord(value: unknown): value is LastPollRecord {
  if (!value || typeof value !== 'object') return false;
  return (
    'ts' in value &&
    'peers' in value &&
    'added' in value &&
    'skipped' in value &&
    typeof value.ts === 'number' &&
    typeof value.peers === 'number' &&
    typeof value.added === 'number' &&
    typeof value.skipped === 'number'
  );
}

async function getLastPoll(sub: string): Promise<LastPollRecord | null> {
  const raw = await redis.get(lastPollKey(sub));
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isLastPollRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function mapThreatRecord(record: PeerThreatRecord, markedFP = false): DashboardThreat {
  const matchedSignals: string[] = [];
  if (record.fingerprint.cadenceHash) matchedSignals.push('cadence');
  if (record.fingerprint.domainHash) matchedSignals.push('domain');
  if (typeof record.fingerprint.timeKL === 'number') matchedSignals.push('time');

  return {
    alertId: record.alertId,
    publisherSub: record.publisherSub,
    category: record.category,
    publishedAt: record.publishedAt,
    ttlAt: record.ttlAt,
    composite: record.fingerprint.composite ?? null,
    matchedSignals,
    markedFP,
  };
}

function isThreatActive(record: PeerThreatRecord | null): record is PeerThreatRecord {
  if (!record) return false;
  return new Date(record.ttlAt).getTime() > Date.now();
}

async function getDashboardThreats(sub: string, limit = 12): Promise<DashboardThreat[]> {
  const alertIds = await getActiveThreatIds();
  const threats: DashboardThreat[] = [];

  for (let i = alertIds.length - 1; i >= 0 && threats.length < limit; i -= 1) {
    const alertId = alertIds[i];
    if (!alertId) continue;
    const record = await getThreatRecord(alertId);
    if (!isThreatActive(record)) continue;
    const markedFP = await isMarkedFalsePositive(sub, alertId);
    threats.push(mapThreatRecord(record, markedFP));
  }

  return threats;
}

async function countActiveThreats(): Promise<number> {
  const alertIds = await getActiveThreatIds();
  let count = 0;
  for (const alertId of alertIds) {
    const record = await getThreatRecord(alertId);
    if (isThreatActive(record)) count += 1;
  }
  return count;
}

async function getOverviewStats(sub: string, username: string | null) {
  const [peers, lastPoll, activeThreats, threatsIndexedRaw, settings] = await Promise.all([
    getTrustedPeers(sub),
    getLastPoll(sub),
    countActiveThreats(),
    redis.get('stats:threats_indexed'),
    getSettings(sub),
  ]);

  const threatsIndexed = threatsIndexedRaw ? Number.parseInt(threatsIndexedRaw, 10) : 0;

  return {
    sub,
    username,
    lastPoll,
    settings,
    trustedPeers: peers.length,
    activeThreats,
    threatsIndexed: Number.isNaN(threatsIndexed) ? 0 : threatsIndexed,
    federationState:
      peers.length === 0
        ? 'setup_needed'
        : lastPoll
          ? 'polling'
          : 'ready',
  };
}

export const appRouter = t.router({
  init: t.router({
    get: publicProcedure.query(async () => {
      const [count, username] = await Promise.all([
        countGet(),
        reddit.getCurrentUsername(),
      ]);

      const sub = context.subredditName ?? null;
      let isModerator = false;
      if (sub && username) {
        try {
          const mods = await reddit
            .getModerators({ subredditName: sub, username })
            .all();
          isModerator = mods.length > 0;
        } catch {
          isModerator = false;
        }
      }

      return {
        count,
        postId: context.postId,
        username,
        subredditName: sub,
        isModerator,
      };
    }),
  }),
  counter: t.router({
    increment: publicProcedure
      .input(z.number().optional())
      .mutation(async ({ input }) => {
        const { postId } = context;
        return {
          count: await countIncrement(input),
          postId,
          type: 'increment',
        };
      }),
    decrement: publicProcedure
      .input(z.number().optional())
      .mutation(async ({ input }) => {
        const { postId } = context;
        return {
          count: await countDecrement(input),
          postId,
          type: 'decrement',
        };
      }),
    get: publicProcedure.query(async () => {
      return await countGet();
    }),
  }),
  dashboard: t.router({
    overview: t.router({
      stats: publicProcedure.query(async () => {
        return await withModeratorAccess(async (sub, username) => {
          return await getOverviewStats(sub, username);
        });
      }),
    }),
    trustGraph: t.router({
      list: publicProcedure.query(async () => {
        return await withModeratorAccess(async (sub) => {
          const peers = await getTrustedPeers(sub);
          return await Promise.all(
            peers.map(async (entry) => ({
              ...entry,
              reputation: await getReputation(entry.peer),
            })),
          );
        });
      }),
      add: publicProcedure.input(z.string()).mutation(async ({ input }) => {
        return await withModeratorAccess(async (sub) => {
          const validation = validatePeerName(input);
          if (!validation.ok) {
            throw new Error(validation.error);
          }

          const changed = await addTrustedPeer(sub, validation.peer);
          if (changed) {
            await appendAction(sub, {
              type: 'peer',
              title: `Trusted r/${validation.peer}`,
              detail: 'Added to the federation trust graph from the dashboard.',
              tone: 'success',
              undo: { kind: 'removePeer', peer: validation.peer },
            });
          }

          return { peer: validation.peer, changed };
        });
      }),
      remove: publicProcedure.input(z.string()).mutation(async ({ input }) => {
        return await withModeratorAccess(async (sub) => {
          const validation = validatePeerName(input);
          if (!validation.ok) {
            throw new Error(validation.error);
          }

          const changed = await removeTrustedPeer(sub, validation.peer);
          if (changed) {
            await appendAction(sub, {
              type: 'peer',
              title: `Removed r/${validation.peer}`,
              detail: 'Stopped trusting this peer for future threat polling.',
              tone: 'warning',
              undo: { kind: 'addPeer', peer: validation.peer },
            });
          }

          return { peer: validation.peer, changed };
        });
      }),
    }),
    threats: t.router({
      feed: publicProcedure.query(async () => {
        return await withModeratorAccess(async (sub) => {
          return await getDashboardThreats(sub);
        });
      }),
      markFalsePositive: publicProcedure
        .input(z.object({ alertId: z.string(), publisherSub: z.string() }))
        .mutation(async ({ input }) => {
          return await withModeratorAccess(async (sub) => {
            const { firstMark } = await markFalsePositive(sub, input.alertId, input.publisherSub);
            if (firstMark) {
              await incFalsePositive();
              await appendAction(sub, {
                type: 'system',
                title: 'Marked FP',
                detail: `Alert ${input.alertId.slice(0, 8)} from r/${input.publisherSub} marked as false-positive.`,
                tone: 'neutral',
              });
            }
            return { firstMark };
          });
        }),
    }),
    actionLog: t.router({
      list: publicProcedure
        .input(z.object({ limit: z.number().min(1).max(1000).optional() }).optional())
        .query(async ({ input }) => {
          return await withModeratorAccess(async (sub) => {
            return await readActionLog(sub, input?.limit);
          });
        }),
      undo: publicProcedure.input(z.string()).mutation(async ({ input }) => {
        return await withModeratorAccess(async (sub) => {
          const detail = await undoAction(sub, input);
          return { id: input, detail };
        });
      }),
    }),
    metrics: t.router({
      summary: publicProcedure.query(async () => {
        return await withModeratorAccess(async () => {
          return await getMetricsSummary();
        });
      }),
    }),
    settings: t.router({
      get: publicProcedure.query(async () => {
        return await withModeratorAccess(async (sub) => {
          return await getSettings(sub);
        });
      }),
      update: publicProcedure
        .input(
          z.object({
            shadowMode: z.boolean().optional(),
            autoAction: z.boolean().optional(),
            reviewThreshold: z.number().min(0).max(100).optional(),
            flagThreshold: z.number().min(0).max(100).optional(),
          }),
        )
        .mutation(async ({ input }) => {
          return await withModeratorAccess(async (sub) => {
            const current = await getSettings(sub);
            const next: DashboardSettings = { ...current, ...input };
            if (next.reviewThreshold > next.flagThreshold) {
              throw new Error('Review threshold must be lower than flag threshold');
            }

            const saved = await saveSettings(sub, next);
            await appendAction(sub, {
              type: 'system',
              title: 'Updated dashboard settings',
              detail: `Review ${saved.reviewThreshold}, flag ${saved.flagThreshold}, shadow mode ${saved.shadowMode ? 'on' : 'off'}.`,
              tone: 'neutral',
            });

            return saved;
          });
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
