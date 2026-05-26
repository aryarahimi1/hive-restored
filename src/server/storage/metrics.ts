/**
 * Lifetime impact counters for the Devpost submission dashboard.
 *
 * Hackathon scope: lifetime totals only — no time bucketing, no sorted sets,
 * no percentiles. Keys live under `metrics:` and are bumped via redis.incrBy.
 */

import { redis } from '@devvit/web/server';

const FLAGS_KEY = 'metrics:flags';
const ACTION_BAN_KEY = 'metrics:action:ban';
const ACTION_REMOVE_KEY = 'metrics:action:remove';
const ACTION_MODNOTE_KEY = 'metrics:action:modnote';
const FP_KEY = 'metrics:fp';
const FED_ALERTS_KEY = 'metrics:fed:alerts';

export type ModActionKind = 'ban' | 'remove' | 'modnote';

function actionKey(kind: ModActionKind): string {
  if (kind === 'ban') return ACTION_BAN_KEY;
  if (kind === 'remove') return ACTION_REMOVE_KEY;
  return ACTION_MODNOTE_KEY;
}

export async function incFlagRaised(): Promise<void> {
  await redis.incrBy(FLAGS_KEY, 1);
}

export async function incModAction(kind: ModActionKind): Promise<void> {
  await redis.incrBy(actionKey(kind), 1);
}

// TODO: wire from the dashboard "mark as false positive" flow once that
// UI lands (see src/server/trpc.ts dashboard.threats.markFalsePositive
// for the existing FP-marking entry point on peer alerts).
export async function incFalsePositive(): Promise<void> {
  await redis.incrBy(FP_KEY, 1);
}

export async function incFederationAlert(): Promise<void> {
  await redis.incrBy(FED_ALERTS_KEY, 1);
}

export type MetricsSummary = {
  flagsRaised: number;
  modActions: {
    ban: number;
    remove: number;
    modnote: number;
    total: number;
  };
  falsePositives: number;
  federationAlerts: number;
};

async function readCount(key: string): Promise<number> {
  const raw = await redis.get(key);
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : n;
}

export async function getMetricsSummary(): Promise<MetricsSummary> {
  const [flagsRaised, ban, remove, modnote, falsePositives, federationAlerts] =
    await Promise.all([
      readCount(FLAGS_KEY),
      readCount(ACTION_BAN_KEY),
      readCount(ACTION_REMOVE_KEY),
      readCount(ACTION_MODNOTE_KEY),
      readCount(FP_KEY),
      readCount(FED_ALERTS_KEY),
    ]);

  return {
    flagsRaised,
    modActions: {
      ban,
      remove,
      modnote,
      total: ban + remove + modnote,
    },
    falsePositives,
    federationAlerts,
  };
}
