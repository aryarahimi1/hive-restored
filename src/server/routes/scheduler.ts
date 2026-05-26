/**
 * src/server/routes/scheduler.ts
 *
 * Hono router for scheduler job callbacks. The `poll-peers` job fires every
 * 2 minutes (configured in devvit.json under `scheduler.tasks.pollPeers`) and
 * polls all trusted peer subreddits for new threat records.
 */

import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type { TriggerResponse } from '@devvit/web/shared';

import { pollPeer } from '../federation/wikiSubscriber';
import { getTrustedPeers } from '../storage/trustGraph';
import { saveLastPoll } from './menu';
import { appendActionLog } from '../storage/actionLog';

export const schedulerRouter = new Hono();

schedulerRouter.post('/poll-peers', async (c) => {
  try {
    const currentSub = context.subredditName ?? '<unknown>';
    const peers = await getTrustedPeers(currentSub);

    // Poll each peer and accumulate totals so we can persist a last_poll record.
    let totalAdded = 0;
    let totalSkipped = 0;
    for (const entry of peers) {
      try {
        const result = await pollPeer(entry.peer);
        totalAdded += result.added;
        totalSkipped += result.skipped;
      } catch (pollErr) {
        console.error(`[hive] scheduler poll r/${entry.peer} error: ${pollErr}`);
      }
    }

    // Persist the poll result for the federation-status menu action.
    await saveLastPoll(currentSub, {
      ts: Date.now(),
      peers: peers.length,
      added: totalAdded,
      skipped: totalSkipped,
    });
    await appendActionLog(currentSub, {
      type: 'poll',
      title: 'Scheduled peer poll completed',
      detail: `Polled ${peers.length} peer${peers.length === 1 ? '' : 's'}: ${totalAdded} added, ${totalSkipped} skipped.`,
      tone: totalAdded > 0 ? 'warning' : 'neutral',
    });

    console.log(
      `[hive] poll: peers=${peers.length} added=${totalAdded} skipped=${totalSkipped} sub=${currentSub}`,
    );

    return c.json<TriggerResponse>({ status: 'success' }, 200);
  } catch (error) {
    console.error(`[hive] scheduler poll-peers error: ${error}`);
    return c.json<TriggerResponse>(
      { status: 'error', message: 'poll-peers failed' },
      400,
    );
  }
});
