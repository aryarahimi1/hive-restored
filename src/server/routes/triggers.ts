import { context, redis, reddit } from '@devvit/web/server';
import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnCommentSubmitRequest,
  OnPostSubmitRequest,
  OnModActionRequest,
  TriggerResponse,
} from '@devvit/web/shared';

import { createPost } from '../core/post';
import {
  computeTimeEntropySignal,
  timeEntropyAnomaly,
} from '../fingerprint/timeEntropy';
import {
  computeNgramCadenceSignal,
  ngramCadenceAnomaly,
} from '../fingerprint/ngramCadence';
import {
  computeDomainHistorySignal,
  domainHistoryAnomaly,
} from '../fingerprint/domainHistory';
import {
  computeComposite,
  bandGlyph,
} from '../fingerprint/composite';
import { publishBanToWiki } from '../federation/wikiPublisher';
import { matchAgainstThreats } from '../federation/threatMatcher';
import {
  getOrCreatePublisherSalt,
  weekOf,
} from '../federation/publisherSalt';
import type { ThreatMatch } from '../federation/threatMatcher';
import { appendAction } from '../storage/actionLog';
import { getSettings, initSettings } from '../storage/settings';
import { incFlagRaised, incModAction } from '../storage/metrics';

export const triggers = new Hono();

const SEEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const FP_TTL_SECONDS = 60 * 60 * 24 * 30;
const MATCH_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTO_ACT_TTL_SECONDS = 60 * 60 * 24 * 30;
const FLAG_COUNTED_TTL_SECONDS = 60 * 60 * 24 * 7;
const HISTORY_FETCH_LIMIT = 100;

/**
 * Pure gate for auto-remove. Exported for unit testing — the trigger
 * handler is otherwise hard to test because of Devvit SDK imports.
 */
export function shouldAutoRemove(
  settings: { shadowMode: boolean; autoAction: boolean; flagThreshold: number },
  score: number,
): boolean {
  if (settings.shadowMode) return false;
  if (!settings.autoAction) return false;
  return score >= settings.flagThreshold;
}

export function shouldAutoWritePeerMatchModNote(settings: {
  shadowMode: boolean;
  autoAction: boolean;
}): boolean {
  if (settings.shadowMode) return false;
  return settings.autoAction;
}

/**
 * Runtime safety net: confirm the target ID carries the prefix we expect
 * for its kind, in case a future SDK delivers bare/differently-prefixed IDs.
 */
export function isExpectedTargetPrefix(target: {
  id: string;
  kind: 'comment' | 'post';
}): boolean {
  const expected = target.kind === 'comment' ? 't1_' : 't3_';
  return target.id.startsWith(expected);
}

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();
    const sub = context.subredditName ?? '<unknown>';

    // Seed conservative defaults only when the sub has no settings record yet.
    const conservativeDefaults = {
      shadowMode: true,
      autoAction: false,
      reviewThreshold: 50,
      flagThreshold: 80,
    };
    await initSettings(sub, conservativeDefaults);

    await appendAction(sub, {
      type: 'system',
      title: 'Hive Restored installed',
      detail:
        `App installed in r/${sub}. Safe defaults seeded: shadow mode on, ` +
        `auto-action off, review threshold 50, flag threshold 80. ` +
        `Federation trust graph is empty — use "Hive: add trusted peer sub" or ` +
        `"Hive: apply trust circle preset" to connect with peer subreddits.`,
      tone: 'neutral',
    });

    console.log(
      `[hive] r/${sub} installed — post ${post.id}, trigger: ${input.type}, defaults seeded`
    );

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Installed in r/${sub} (post ${post.id}, trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`[hive] on-app-install error: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'install failed' }, 400);
  }
});

async function fetchUserActivity(username: string): Promise<{
  timestamps: Date[];
  corpus: string;
}> {
  try {
    const listing = reddit.getCommentsAndPostsByUser({
      username,
      limit: HISTORY_FETCH_LIMIT,
      sort: 'new',
    });
    const items = await listing.all();
    const timestamps: Date[] = [];
    const textParts: string[] = [];
    for (const it of items) {
      if (it.createdAt instanceof Date) timestamps.push(it.createdAt);
      const anyIt = it as unknown as { body?: string; title?: string; url?: string };
      if (anyIt.body) textParts.push(anyIt.body);
      if (anyIt.title) textParts.push(anyIt.title);
      if (anyIt.url) textParts.push(anyIt.url);
    }
    return { timestamps, corpus: textParts.join('\n') };
  } catch (err) {
    console.warn(`[hive] history fetch failed for u/${username}: ${err}`);
    return { timestamps: [], corpus: '' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cachedFingerprintHasMatchableV1(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) && parsed.matchableVersion === 1;
  } catch {
    return false;
  }
}

async function fingerprintUser(
  username: string,
  sub: string,
  target?: { id: `t1_${string}` | `t3_${string}`; kind: 'comment' | 'post' },
): Promise<void> {
  const cacheKey = `fp:${username}`;
  const cached = await redis.get(cacheKey);
  if (cached && cachedFingerprintHasMatchableV1(cached)) {
    // Fingerprint already computed — still run match check in case index grew
    await runMatchCheck(username, cached, sub);
    return;
  }

  const { timestamps, corpus } = await fetchUserActivity(username);

  // Salt publisher-local audit hashes with the local sub's secret + current
  // ISO week. We also store an unsalted, content-free matchableV1 sketch so
  // trusted peers can recompute the same opaque behavior hash for matching.
  // See src/server/federation/publisherSalt.ts and SECURITY.md for the
  // privacy tradeoff and honest public copy.
  const salt = await getOrCreatePublisherSalt(sub);
  const epoch = weekOf(new Date());
  const hashOpts = { salt, epoch };

  const timeSig = computeTimeEntropySignal(timestamps);
  const cadenceSig = computeNgramCadenceSignal(corpus, hashOpts);
  const domainSig = computeDomainHistorySignal(corpus, hashOpts);
  const matchableCadenceSig = computeNgramCadenceSignal(corpus);
  const matchableDomainSig = computeDomainHistorySignal(corpus);

  const timeAnom = timeSig ? timeEntropyAnomaly(timeSig) : undefined;
  const cadenceAnom = cadenceSig ? ngramCadenceAnomaly(corpus) : undefined;
  const domainAnom = domainSig ? domainHistoryAnomaly(corpus) : undefined;

  const composite = computeComposite({
    timeAnomaly: timeAnom,
    cadenceAnomaly: cadenceAnom,
    domainAnomaly: domainAnom,
  });

  const fp: Record<string, unknown> = {
    username,
    computedAt: new Date().toISOString(),
    epoch, // ISO week the publisher-local hashes were salted with — published verbatim.
    matchableVersion: 1,
    sampleSize: timestamps.length,
    corpusChars: corpus.length,
  };

  if (timeSig && timeAnom !== undefined) {
    fp.timeEntropy = { kl: timeSig.klDivergence, anomaly: timeAnom };
  }
  if (cadenceSig && cadenceAnom !== undefined) {
    fp.cadence = {
      simHash: cadenceSig.simHash,
      sampleSize: cadenceSig.sampleSize,
      anomaly: cadenceAnom,
    };
  }
  if (domainSig && domainAnom !== undefined) {
    fp.domain = {
      minHash: domainSig.minHash,
      domainCount: domainSig.domainCount,
      anomaly: domainAnom,
    };
  }

  const matchableV1: Record<string, string> = {};
  if (matchableCadenceSig) matchableV1.cadenceHash = matchableCadenceSig.simHash;
  if (matchableDomainSig) matchableV1.domainHash = matchableDomainSig.minHash;
  if (Object.keys(matchableV1).length > 0) fp.matchableV1 = matchableV1;

  if (composite) {
    fp.composite = composite;
  }

  const fpJson = JSON.stringify(fp);
  await redis.set(cacheKey, fpJson, {
    expiration: new Date(Date.now() + FP_TTL_SECONDS * 1000),
  });

  const compositeStr = composite
    ? `${composite.score}/100 ${bandGlyph(composite.band)} (${composite.presentSignals} sig)`
    : 'no signals';
  console.log(
    `[hive] r/${sub} u/${username} — fp computed: n=${timestamps.length} ` +
      `composite=${compositeStr} ` +
      `time=${timeAnom?.toFixed(2) ?? '–'} ` +
      `cadence=${cadenceAnom?.toFixed(2) ?? '–'} ` +
      `domain=${domainAnom?.toFixed(2) ?? '–'}`
  );

  // Guarded auto-remove on flag-band score
  if (composite && target) {
    const settings = await getSettings(sub);
    if (composite.score >= settings.flagThreshold) {
      const flagCountedKey = `flag-counted:${target.id}`;
      const flagClaimed = await redis.set(flagCountedKey, '1', {
        nx: true,
        expiration: new Date(Date.now() + FLAG_COUNTED_TTL_SECONDS * 1000),
      });
      if (flagClaimed === 'OK') {
        await incFlagRaised();
      }
    }
    if (shouldAutoRemove(settings, composite.score)) {
      if (!isExpectedTargetPrefix(target)) {
        console.warn(
          `[hive] r/${sub} u/${username} auto-action skipped: ${target.kind} id ${target.id} missing expected prefix`,
        );
      } else {
      const actedKey = `auto-acted:${target.id}`;
      const claimed = await redis.set(actedKey, '1', {
        nx: true,
        expiration: new Date(Date.now() + AUTO_ACT_TTL_SECONDS * 1000),
      });
      if (claimed === 'OK') {
        try {
          await reddit.remove(target.id, true);
          await appendAction(sub, {
            type: 'system',
            title: `Auto-removed ${target.kind} from u/${username}`,
            detail:
              `Composite score ${composite.score}/100 (band ${composite.band}) ` +
              `meets flag threshold ${settings.flagThreshold}. Target ${target.id}.`,
            tone: 'warning',
          });
          console.log(
            `[hive] r/${sub} u/${username} auto-removed ${target.kind} ${target.id} ` +
              `composite=${composite.score}/100 band=${composite.band} ` +
              `flagThreshold=${settings.flagThreshold}`
          );
        } catch (err) {
          await redis.del(actedKey);
          console.warn(
            `[hive] auto-remove failed for ${target.id} (u/${username}): ${err}`
          );
        }
      }
      }
    }
  }

  // Run peer threat matching after computing fingerprint
  await runMatchCheck(username, fpJson, sub);
}

/**
 * Check a user's fingerprint against indexed peer threats and cache results.
 */
async function runMatchCheck(username: string, fpJson: string, sub: string): Promise<void> {
  try {
    const parsed: unknown = JSON.parse(fpJson);
    if (!isRecord(parsed)) return;

    const matchableV1 = isRecord(parsed.matchableV1) ? parsed.matchableV1 : undefined;
    const cadence = isRecord(parsed.cadence) ? parsed.cadence : undefined;
    const domain = isRecord(parsed.domain) ? parsed.domain : undefined;
    const composite = isRecord(parsed.composite) ? parsed.composite : undefined;

    const cadenceHash = typeof matchableV1?.cadenceHash === 'string'
      ? matchableV1.cadenceHash
      : typeof cadence?.simHash === 'string'
        ? cadence.simHash
        : undefined;
    const domainHash = typeof matchableV1?.domainHash === 'string'
      ? matchableV1.domainHash
      : typeof domain?.minHash === 'string'
        ? domain.minHash
        : undefined;
    const compositeScore = typeof composite?.score === 'number' ? composite.score : undefined;

    if (!cadenceHash && !domainHash) return;

    const matches = await matchAgainstThreats({ cadenceHash, domainHash });
    if (matches.length === 0) {
      // Cache TTL (MATCH_TTL_SECONDS) handles natural expiration. Earlier
      // versions cleared the cache here, which wiped every match in the
      // sub whenever a peer poll briefly returned an empty index.
      return;
    }

    // Cache the matches
    await redis.set(`match:${username}`, JSON.stringify(matches), {
      expiration: new Date(Date.now() + MATCH_TTL_SECONDS * 1000),
    });

    const topMatch = matches[0];
    if (!topMatch) return;

    const loggedKey = `match-logged:${username}`;
    const logged = await redis.set(loggedKey, topMatch.alertId, {
      nx: true,
      expiration: new Date(Date.now() + MATCH_TTL_SECONDS * 1000),
    });
    if (logged !== 'OK') return;

    await incFlagRaised();

    await appendAction(sub, {
      type: 'match',
      title: `Peer match cached for u/${username}`,
      detail:
        `Top match: r/${topMatch.publisherSub}, ` +
        `${Math.round(topMatch.similarity * 100)}% via ${topMatch.matchedSignal}.`,
      tone: 'warning',
    });
    await addPeerMatchModNote(username, sub, topMatch, compositeScore);

    for (const m of matches) {
      console.log(
        `[hive] r/${sub} u/${username} MATCH ` +
          `publisherSub=r/${m.publisherSub} ` +
          `category=${m.category} ` +
          `similarity=${m.similarity.toFixed(3)} ` +
          `signal=${m.matchedSignal}`
      );
    }
  } catch (err) {
    console.warn(`[hive] matchCheck failed for u/${username}: ${err}`);
  }
}

async function addPeerMatchModNote(
  username: string,
  sub: string,
  match: ThreatMatch,
  compositeScore: number | undefined,
): Promise<void> {
  const settings = await getSettings(sub);
  if (!shouldAutoWritePeerMatchModNote(settings)) return;

  const modnotedKey = `modnoted:${username}`;
  const claimed = await redis.set(modnotedKey, match.alertId, {
    nx: true,
    expiration: new Date(Date.now() + MATCH_TTL_SECONDS * 1000),
  });
  if (claimed !== 'OK') return;

  const peerScore = Math.round(match.similarity * 100);
  const localScore = typeof compositeScore === 'number'
    ? ` local score ${compositeScore}/100,`
    : '';
  const note =
    `Hive Restored peer match:${localScore} ${peerScore}% via ` +
    `${match.matchedSignal}, source r/${match.publisherSub}, category ${match.category}.`;

  try {
    await reddit.addModNote({
      subreddit: sub,
      user: username,
      label: 'SPAM_WATCH',
      note,
    });
    await appendAction(sub, {
      type: 'system',
      title: `Modnote added for u/${username}`,
      detail: note,
      tone: 'warning',
    });
  } catch (err) {
    await redis.del(modnotedKey);
    console.warn(`[hive] modnote failed for u/${username}: ${err}`);
  }
}

triggers.post('/on-comment-submit', async (c) => {
  try {
    const input = await c.req.json<OnCommentSubmitRequest>();
    const author = input.author?.name;
    const commentId = input.comment?.id;
    const sub = context.subredditName ?? '<unknown>';

    if (author && commentId) {
      await redis.set(`seen:${author}`, Date.now().toString(), {
        expiration: new Date(Date.now() + SEEN_TTL_SECONDS * 1000),
      });
      console.log(`[hive] r/${sub} comment ${commentId} from u/${author}`);
      await fingerprintUser(author, sub, {
        id: commentId as `t1_${string}`,
        kind: 'comment',
      });
    } else {
      console.log(`[hive] r/${sub} on-comment-submit fired without author/id`);
    }
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  } catch (error) {
    console.error(`[hive] on-comment-submit error: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'comment trigger failed' }, 400);
  }
});

triggers.post('/on-post-submit', async (c) => {
  try {
    const input = await c.req.json<OnPostSubmitRequest>();
    const author = input.author?.name;
    const postId = input.post?.id;
    const sub = context.subredditName ?? '<unknown>';

    if (author && postId) {
      await redis.set(`seen:${author}`, Date.now().toString(), {
        expiration: new Date(Date.now() + SEEN_TTL_SECONDS * 1000),
      });
      console.log(`[hive] r/${sub} post ${postId} from u/${author}`);
      await fingerprintUser(author, sub, {
        id: postId as `t3_${string}`,
        kind: 'post',
      });
    } else {
      console.log(`[hive] r/${sub} on-post-submit fired without author/id`);
    }
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  } catch (error) {
    console.error(`[hive] on-post-submit error: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'post trigger failed' }, 400);
  }
});

/**
 * Categorise a mod action into one of our federation categories.
 * Returns null for action types we don't want to broadcast.
 *
 * We restrict federated publishing to explicit bans only — removals are
 * far too noisy (off-topic, duplicate, low-effort cleanup all trigger
 * removelink/removecomment) and would erode peer trust in the feed.
 */
function categoriseModAction(action: string | undefined): string | null {
  if (!action) return null;
  const a = action.toLowerCase();
  if (a === 'banuser') return 'ban_evasion';
  return null;
}

triggers.post('/on-mod-action', async (c) => {
  try {
    const input = await c.req.json<OnModActionRequest>();
    const sub = context.subredditName ?? '<unknown>';
    const action = (input as unknown as { action?: string }).action;
    const targetUser =
      (input as unknown as { targetUser?: { name?: string } }).targetUser?.name ??
      (input as unknown as { targetUser?: string }).targetUser;
    const moderator =
      (input as unknown as { moderator?: { name?: string } }).moderator?.name ??
      'unknown';

    const category = categoriseModAction(action);
    console.log(
      `[hive] r/${sub} modaction action=${action} target=${targetUser ?? '?'} by=${moderator} category=${category ?? 'ignored'}`
    );

    if (category && typeof targetUser === 'string' && targetUser.length > 0) {
      await incModAction('ban');
      await fingerprintUser(targetUser, sub);
      await publishBanToWiki({
        sub,
        targetUser,
        category,
        moderator,
      });
    }

    return c.json<TriggerResponse>({ status: 'success' }, 200);
  } catch (error) {
    console.error(`[hive] on-mod-action error: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'modaction trigger failed' }, 400);
  }
});
