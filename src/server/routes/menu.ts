import { Hono } from 'hono';
import type { UiResponse, MenuItemRequest } from '@devvit/web/shared';
import { redis, reddit, context } from '@devvit/web/server';

import { createPost } from '../core/post';
import { getTrustedPeers, addTrustedPeer } from '../storage/trustGraph';
import { appendActionLog } from '../storage/actionLog';
import type { ThreatMatch } from '../federation/threatMatcher';
import { pollPeer } from '../federation/wikiSubscriber';
import { PRESETS } from '../install/presets';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();
    return c.json<UiResponse>(
      { navigateTo: `https://reddit.com/comments/${post.id}` },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});

interface StoredFingerprint {
  username: string;
  computedAt: string;
  sampleSize: number;
  corpusChars: number;
  timeEntropy?: { kl: number; anomaly: number };
  cadence?: { simHash: string; sampleSize: number; anomaly: number };
  domain?: { minHash: string; domainCount: number; anomaly: number };
  composite?: { score: number; band: 'clean' | 'watch' | 'review' | 'flag'; presentSignals: number };
}

function bandGlyph(band: 'clean' | 'watch' | 'review' | 'flag'): string {
  switch (band) {
    case 'clean': return '🟢';
    case 'watch': return '🟡';
    case 'review': return '🟠';
    case 'flag': return '🔴';
  }
}

function summarise(fp: StoredFingerprint): string {
  const parts: string[] = [];
  if (fp.composite) {
    parts.push(
      `Hive ${bandGlyph(fp.composite.band)} ${fp.composite.score}/100 · u/${fp.username} · n=${fp.sampleSize}`
    );
  } else {
    parts.push(`Hive · u/${fp.username} · n=${fp.sampleSize} · insufficient history`);
  }

  if (fp.timeEntropy) parts.push(`time ${fp.timeEntropy.anomaly.toFixed(2)}`);
  if (fp.cadence) parts.push(`cadence ${fp.cadence.anomaly.toFixed(2)}`);
  if (fp.domain) parts.push(`domain ${fp.domain.anomaly.toFixed(2)} (${fp.domain.domainCount} dom)`);

  return parts.join(' · ');
}

/**
 * "Hive: explain this user" — comment-level mod menu action. Reads the
 * cached fingerprint for the comment's author and surfaces it as a toast.
 * Also surfaces any peer-match warnings from the match cache.
 */
menu.post('/comment-explain', async (c) => {
  try {
    const req = await c.req.json<MenuItemRequest>();
    if (req.location !== 'comment') {
      return c.json<UiResponse>(
        { showToast: 'Hive: only available on comments' },
        200
      );
    }

    const comment = await reddit.getCommentById(req.targetId as `t1_${string}`);
    const author = comment?.authorName;
    if (!author) {
      return c.json<UiResponse>(
        { showToast: 'Hive: could not resolve comment author' },
        200
      );
    }

    const raw = await redis.get(`fp:${author}`);
    if (!raw) {
      return c.json<UiResponse>(
        {
          showToast: {
            text: `Hive · u/${author}: no fingerprint yet — try again in a few seconds`,
            appearance: 'neutral',
          },
        },
        200
      );
    }

    let fp: StoredFingerprint;
    try {
      fp = JSON.parse(raw) as StoredFingerprint;
    } catch {
      return c.json<UiResponse>(
        { showToast: 'Hive: fingerprint corrupted — will recompute on next event' },
        200
      );
    }

    const summary = summarise(fp);

    // Load any peer match info
    const matchRaw = await redis.get(`match:${author}`);
    const matchParts: string[] = [];
    if (matchRaw) {
      try {
        const matches = JSON.parse(matchRaw) as ThreatMatch[];
        for (const m of matches) {
          matchParts.push(
            `⚠ Matched in r/${m.publisherSub} (sim ${m.similarity.toFixed(2)} ${m.matchedSignal})`
          );
        }
      } catch {
        // ignore corrupt match cache
      }
    }

    const fullText = matchParts.length > 0
      ? `${summary} | ${matchParts.join(' | ')}`
      : summary;

    const appearance = (fp.composite && fp.composite.score >= 55) || matchParts.length > 0
      ? 'neutral'
      : 'success';

    return c.json<UiResponse>(
      { showToast: { text: fullText, appearance } },
      200
    );
  } catch (error) {
    console.error(`[hive] comment-explain error: ${error}`);
    return c.json<UiResponse>({ showToast: 'Hive: explain failed' }, 400);
  }
});

/**
 * "Hive: add trusted peer sub" — subreddit-level mod menu action.
 *
 * Primary path (normal menu click): returns a `showForm` UiResponse that
 * prompts the mod to type a peer subreddit name. The form submit POSTs to
 * `/internal/forms/add-peer` (registered in devvit.json under `forms.addPeer`).
 *
 * Fallback path (script / direct JSON body): if the request body already
 * contains a `peer` field the handler adds the peer directly and toasts the
 * result. This keeps the existing script-friendly behaviour intact.
 */
menu.post('/add-peer', async (c) => {
  try {
    const currentSub = context.subredditName ?? '<unknown>';

    // Try to read a peer name supplied directly in the body (script fallback).
    let peer: string | undefined;
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const raw = body['peer'] ?? body['formData.peer'] ?? body['value'];
      if (typeof raw === 'string' && raw.trim().length > 0) {
        peer = raw.trim().replace(/^r\//i, '');
      }
    } catch {
      // not JSON body — normal menu-click path, fall through to showForm
    }

    if (!peer) {
      // Normal menu-click: open the add-peer form registered in devvit.json.
      return c.json<UiResponse>(
        {
          showForm: {
            name: 'addPeer',
            form: {
              title: 'Add trusted peer subreddit',
              acceptLabel: 'Add peer',
              cancelLabel: 'Cancel',
              fields: [
                {
                  type: 'string',
                  name: 'peer',
                  label: 'Peer subreddit name (without r/)',
                  helpText: 'e.g. "ModSupport" or "modnews"',
                  required: true,
                },
              ],
            },
          },
        },
        200,
      );
    }

    // Script-supplied peer: validate + store directly.
    const normalised = peer.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (normalised.length < 3 || normalised.length > 21) {
      return c.json<UiResponse>(
        {
          showToast: {
            text: 'Hive: peer name must be 3–21 characters',
            appearance: 'neutral',
          },
        },
        200,
      );
    }

    const changed = await addTrustedPeer(currentSub, normalised);
    if (changed) {
      await appendActionLog(currentSub, {
        type: 'peer',
        title: `Trusted r/${normalised}`,
        detail: 'Added to the federation trust graph from the mod menu.',
        tone: 'success',
        undo: { kind: 'removePeer', peer: normalised },
      });
    }

    return c.json<UiResponse>(
      { showToast: { text: `Hive: added r/${normalised} as a trusted peer`, appearance: 'success' } },
      200,
    );
  } catch (error) {
    console.error(`[hive] add-peer error: ${error}`);
    return c.json<UiResponse>(
      { showToast: { text: `Hive: add-peer failed — ${String(error)}`, appearance: 'neutral' } },
      400,
    );
  }
});

/**
 * "Hive: list trusted peers" — subreddit-level mod menu action.
 * Shows a comma-joined list of all trusted peer subreddit names.
 */
menu.post('/list-peers', async (c) => {
  try {
    const currentSub = context.subredditName ?? '<unknown>';
    const peers = await getTrustedPeers(currentSub);

    const text = peers.length === 0
      ? 'Hive: no trusted peers configured'
      : `Hive trusted peers (${peers.length}): ${peers.map((p) => `r/${p.peer}`).join(', ')}`;

    return c.json<UiResponse>(
      { showToast: { text, appearance: 'neutral' } },
      200
    );
  } catch (error) {
    console.error(`[hive] list-peers error: ${error}`);
    return c.json<UiResponse>({ showToast: 'Hive: list-peers failed' }, 400);
  }
});

// ---------------------------------------------------------------------------
// Last-poll record helpers
// ---------------------------------------------------------------------------

/** Shape stored in Redis under `last_poll:<sub>`. */
export interface LastPollRecord {
  ts: number;
  peers: number;
  added: number;
  skipped: number;
}

function lastPollKey(sub: string): string {
  return `last_poll:${sub}`;
}

/** Persist a poll result to Redis so `federation-status` can display it. */
export async function saveLastPoll(
  sub: string,
  record: LastPollRecord,
): Promise<void> {
  await redis.set(lastPollKey(sub), JSON.stringify(record));
}

/** Load the last poll record for a sub. Returns null when never polled. */
export async function loadLastPoll(sub: string): Promise<LastPollRecord | null> {
  const raw = await redis.get(lastPollKey(sub));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastPollRecord;
  } catch {
    return null;
  }
}

/**
 * Format a millisecond duration into a human-readable relative time string.
 *
 * @param ms - Duration in milliseconds (>= 0).
 * @returns Formatted string, e.g. "5s ago", "3m ago", "2h ago", "1d ago".
 */
export function relativeTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ---------------------------------------------------------------------------
// "Hive: poll peers now" — on-demand poll trigger
// ---------------------------------------------------------------------------

/**
 * "Hive: poll peers now" — subreddit-level mod menu action.
 *
 * Triggers an immediate poll of all trusted peers (same logic as the 2-minute
 * cron). Stores the result in `last_poll:<sub>` so the status view can display
 * it. Toasts a summary: "Polled N peers: X added, Y skipped".
 */
menu.post('/poll-now', async (c) => {
  try {
    const currentSub = context.subredditName ?? '<unknown>';
    const peers = await getTrustedPeers(currentSub);

    let totalAdded = 0;
    let totalSkipped = 0;

    for (const entry of peers) {
      try {
        const result = await pollPeer(entry.peer);
        totalAdded += result.added;
        totalSkipped += result.skipped;
      } catch (pollErr) {
        console.error(`[hive] poll-now r/${entry.peer} error: ${pollErr}`);
      }
    }

    // Persist result for federation-status to read
    await saveLastPoll(currentSub, {
      ts: Date.now(),
      peers: peers.length,
      added: totalAdded,
      skipped: totalSkipped,
    });
    await appendActionLog(currentSub, {
      type: 'poll',
      title: 'Manual peer poll completed',
      detail: `Polled ${peers.length} peer${peers.length === 1 ? '' : 's'}: ${totalAdded} added, ${totalSkipped} skipped.`,
      tone: totalAdded > 0 ? 'warning' : 'neutral',
    });

    const text = `Polled ${peers.length} peer${peers.length === 1 ? '' : 's'}: ${totalAdded} added, ${totalSkipped} skipped`;

    return c.json<UiResponse>(
      { showToast: { text, appearance: 'success' } },
      200,
    );
  } catch (error) {
    console.error(`[hive] poll-now error: ${error}`);
    return c.json<UiResponse>(
      { showToast: { text: `Hive: poll-now failed — ${String(error)}`, appearance: 'neutral' } },
      400,
    );
  }
});

// ---------------------------------------------------------------------------
// "Hive: federation status" — summary dashboard via toast
// ---------------------------------------------------------------------------

/**
 * "Hive: federation status" — subreddit-level mod menu action.
 *
 * Reads Redis and toasts a multi-line summary:
 *   Hive · r/<sub>
 *   Trusted peers: <count> (<list, up to 5 + "...">)
 *   Last poll: <relative time or "never">
 *   Last result: <added> new, <skipped> skipped
 *   Threats indexed: <stats:threats_indexed counter>
 */
menu.post('/federation-status', async (c) => {
  try {
    const currentSub = context.subredditName ?? '<unknown>';

    const [peers, lastPoll, threatsRaw] = await Promise.all([
      getTrustedPeers(currentSub),
      loadLastPoll(currentSub),
      redis.get('stats:threats_indexed'),
    ]);

    // Peer list, truncated to 5
    const peerNames = peers.map((p) => `r/${p.peer}`);
    const peerList =
      peerNames.length === 0
        ? 'none'
        : peerNames.length <= 5
          ? peerNames.join(', ')
          : `${peerNames.slice(0, 5).join(', ')}, ...`;

    // Last poll line
    const lastPollText = lastPoll
      ? relativeTime(Date.now() - lastPoll.ts)
      : 'never';
    const lastResultText = lastPoll
      ? `${lastPoll.added} new, ${lastPoll.skipped} skipped`
      : '—';

    // Threats indexed counter
    const threatsCount = threatsRaw ? parseInt(threatsRaw, 10) : 0;
    const threatsText = isNaN(threatsCount) ? '?' : String(threatsCount);

    const lines = [
      `Hive · r/${currentSub}`,
      `Trusted peers: ${peers.length} (${peerList})`,
      `Last poll: ${lastPollText}`,
      `Last result: ${lastResultText}`,
      `Threats indexed: ${threatsText}`,
    ];

    return c.json<UiResponse>(
      { showToast: { text: lines.join('\n'), appearance: 'neutral' } },
      200,
    );
  } catch (error) {
    console.error(`[hive] federation-status error: ${error}`);
    return c.json<UiResponse>(
      { showToast: { text: `Hive: status failed — ${String(error)}`, appearance: 'neutral' } },
      400,
    );
  }
});

// ---------------------------------------------------------------------------
// "Hive: apply trust circle preset" — subreddit-level mod menu action
// ---------------------------------------------------------------------------

/**
 * Opens the `applyPreset` form (registered in devvit.json under
 * `forms.applyPreset`). The mod picks a preset name from a select field;
 * the actual peer additions happen in the `/internal/forms/apply-preset`
 * submit handler in forms.ts.
 *
 * Presets are NEVER applied automatically — this is the opt-in entry point.
 */
menu.post('/apply-preset', async (c) => {
  try {
    return c.json<UiResponse>(
      {
        showForm: {
          name: 'applyPreset',
          form: {
            title: 'Apply trust circle preset',
            acceptLabel: 'Apply preset',
            cancelLabel: 'Cancel',
            fields: [
              {
                type: 'select',
                name: 'preset',
                label: 'Choose a preset',
                helpText:
                  'Peers already in your trust graph will be skipped. ' +
                  'You can remove any peer later from the mod menu.',
                options: PRESETS.map((p) => ({
                  label: `${p.label} — ${p.description.split('.')[0]}`,
                  value: p.name,
                })),
                required: true,
              },
            ],
          },
        },
      },
      200,
    );
  } catch (error) {
    console.error(`[hive] apply-preset menu error: ${error}`);
    return c.json<UiResponse>(
      { showToast: { text: `Hive: apply-preset failed — ${String(error)}`, appearance: 'neutral' } },
      400,
    );
  }
});
