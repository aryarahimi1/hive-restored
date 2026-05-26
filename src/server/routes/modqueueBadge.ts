/**
 * Modqueue threat badge — moderator menu opens a structured form (the in-modqueue
 * popover surface on Devvit Web). Separate from comment-explain's compact toast.
 */

import { Hono } from 'hono';
import type { FormField, MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';

import { appendActionLog } from '../storage/actionLog';
import { incModAction } from '../storage/metrics';
import {
  buildModqueueBadgeContext,
  type ModqueueBadgeLocation,
} from '../modqueue/badgeContext';

export const modqueueBadgeMenu = new Hono();
export const modqueueBadgeForms = new Hono();

type FormBoolean = boolean | string | string[];

type ModqueueBadgeFormBody = {
  targetId?: string;
  location?: string;
  username?: string;
  showEvidence?: FormBoolean;
  actionModNote?: FormBoolean;
  actionRemove?: FormBoolean;
  actionBan?: FormBoolean;
};

function isChecked(value: FormBoolean | undefined): boolean {
  if (Array.isArray(value)) return value.includes('true') || value.includes('on');
  return value === true || value === 'true' || value === 'on';
}

/**
 * Strip markdown / link / HTML control characters before interpolating
 * peer-supplied strings into a mod note. `parseRawThreat` already
 * allowlists `category`, so this is defence-in-depth against future
 * fields that get added without the same care.
 */
function sanitiseForModNote(value: string): string {
  return value.replace(/[[\]()<>]/g, '');
}

async function resolveAuthor(
  location: ModqueueBadgeLocation,
  targetId: string,
): Promise<string | null> {
  if (location === 'comment') {
    const comment = await reddit.getCommentById(targetId as `t1_${string}`);
    return comment?.authorName ?? null;
  }

  const post = await reddit.getPostById(targetId as `t3_${string}`);
  return post?.authorName ?? null;
}

function badgeFormFields(
  ctx: Awaited<ReturnType<typeof buildModqueueBadgeContext>>,
  showEvidence: boolean,
): FormField[] {
  const evidenceFields: FormField[] = [
    {
      type: 'paragraph',
      name: 'evidenceSummary',
      label: 'Summary',
      defaultValue: ctx.evidenceSummary,
      disabled: true,
    },
  ];

  if (showEvidence) {
    evidenceFields.push({
      type: 'paragraph',
      name: 'evidenceDetail',
      label: 'Peer match detail',
      defaultValue: ctx.evidenceDetail,
      disabled: true,
    });
  } else {
    evidenceFields.push({
      type: 'boolean',
      name: 'showEvidence',
      label: 'Show peer match evidence',
      helpText: 'Expand to see federation receipts (publisher sub, similarity, alert ids).',
      defaultValue: false,
    });
  }

  return [
    {
      type: 'string',
      name: 'targetId',
      label: 'Target',
      defaultValue: ctx.targetId,
      disabled: true,
    },
    {
      type: 'string',
      name: 'location',
      label: 'Location',
      defaultValue: ctx.location,
      disabled: true,
    },
    {
      type: 'string',
      name: 'username',
      label: 'Author',
      defaultValue: ctx.username,
      disabled: true,
    },
    {
      type: 'paragraph',
      name: 'score',
      label: 'Composite score',
      defaultValue: ctx.scoreLine,
      disabled: true,
    },
    {
      type: 'paragraph',
      name: 'signals',
      label: 'Signals',
      defaultValue: ctx.signalsLine,
      disabled: true,
    },
    {
      type: 'group',
      label: 'Evidence',
      helpText: 'Expandable peer federation receipts for this author.',
      fields: evidenceFields,
    },
    {
      type: 'paragraph',
      name: 'policy',
      label: 'Mode',
      defaultValue: ctx.shadowHint,
      disabled: true,
    },
    {
      type: 'group',
      label: 'Actions',
      fields: [
        {
          type: 'boolean',
          name: 'actionModNote',
          label: 'Add Hive mod note on author',
          defaultValue: false,
        },
        {
          type: 'boolean',
          name: 'actionRemove',
          label: `Remove this ${ctx.location}`,
          defaultValue: false,
          disabled: !ctx.canRemove,
          helpText: ctx.canRemove
            ? 'Removes the modqueue item as spam.'
            : 'Requires shadow mode off, auto-action on, and elevated risk.',
        },
        {
          type: 'boolean',
          name: 'actionBan',
          label: 'Ban author (subreddit)',
          defaultValue: false,
          disabled: !ctx.canBan,
          helpText: ctx.canBan
            ? `Runs when composite ≥ ${ctx.settings.flagThreshold}.`
            : 'Requires shadow mode off, auto-action on, and flag-level score.',
        },
      ],
    },
  ];
}

modqueueBadgeMenu.post('/open', async (c) => {
  try {
    const req = await c.req.json<MenuItemRequest>();
    if (req.location !== 'post' && req.location !== 'comment') {
      return c.json<UiResponse>(
        { showToast: 'Hive badge: open from a post or comment in modqueue' },
        200,
      );
    }

    const location = req.location;
    const author = await resolveAuthor(location, req.targetId);
    if (!author) {
      return c.json<UiResponse>(
        { showToast: 'Hive badge: could not resolve author' },
        200,
      );
    }

    const sub = context.subredditName ?? '<unknown>';
    const badge = await buildModqueueBadgeContext({
      sub,
      username: author,
      targetId: req.targetId,
      location,
    });

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'modqueueBadge',
          form: {
            title: `Hive threat badge · u/${author}`,
            description: 'Score, signals, and peer evidence for this modqueue item.',
            acceptLabel: 'Apply actions',
            cancelLabel: 'Close',
            fields: badgeFormFields(badge, false),
          },
        },
      },
      200,
    );
  } catch (error) {
    console.error(`[hive] modqueue-badge open error: ${error}`);
    return c.json<UiResponse>({ showToast: 'Hive badge: failed to open' }, 400);
  }
});

modqueueBadgeForms.post('/submit', async (c) => {
  try {
    const sub = context.subredditName ?? '<unknown>';
    let body: ModqueueBadgeFormBody;
    try {
      body = await c.req.json<ModqueueBadgeFormBody>();
    } catch {
      return c.json<UiResponse>(
        { showToast: { text: 'Hive badge: invalid form submission', appearance: 'neutral' } },
        200,
      );
    }

    const targetId = body.targetId;
    const location = body.location;
    const username = body.username;

    if (
      typeof targetId !== 'string' ||
      (location !== 'post' && location !== 'comment') ||
      typeof username !== 'string'
    ) {
      return c.json<UiResponse>(
        { showToast: { text: 'Hive badge: missing target context', appearance: 'neutral' } },
        200,
      );
    }

    const resolvedAuthor = await resolveAuthor(location, targetId);
    if (!resolvedAuthor || resolvedAuthor !== username) {
      return c.json<UiResponse>(
        { showToast: { text: 'Hive badge: author mismatch — reopen badge', appearance: 'neutral' } },
        200,
      );
    }

    const badge = await buildModqueueBadgeContext({
      sub,
      username,
      targetId,
      location,
    });

    const wantsEvidence = isChecked(body.showEvidence);
    const wantsModNote = isChecked(body.actionModNote);
    const wantsRemove = isChecked(body.actionRemove);
    const wantsBan = isChecked(body.actionBan);

    if (wantsEvidence) {
      return c.json<UiResponse>(
        {
          showForm: {
            name: 'modqueueBadge',
            form: {
              title: `Hive threat badge · u/${username}`,
              description: 'Peer evidence expanded.',
              acceptLabel: 'Apply actions',
              cancelLabel: 'Close',
              fields: badgeFormFields(badge, true),
            },
          },
        },
        200,
      );
    }

    const actions: string[] = [];

    if (wantsModNote) {
      const score = badge.fingerprint?.composite?.score;
      const localScore =
        typeof score === 'number' ? ` local score ${score}/100,` : '';
      const top = badge.matches[0];
      // Belt-and-suspenders sanitisation. parseRawThreat already allowlists
      // `category` and a peer sub name is bounded by Reddit's own rules, but
      // every field that crosses the federation boundary still goes through
      // a quick scrub before landing in the mod-note body. The mod-note UI
      // does not render markdown today but this keeps that future-proof.
      const peerLine = top
        ? ` top peer r/${sanitiseForModNote(top.publisherSub)} (${Math.round(top.similarity * 100)}% ${sanitiseForModNote(top.matchedSignal)}).`
        : '';
      const note =
        `Hive Restored modqueue badge:${localScore}${peerLine} ` +
        `Signals: ${sanitiseForModNote(badge.signalsLine.replace(/\n/g, ' · ')).slice(0, 240)}`;

      try {
        await reddit.addModNote({
          subreddit: sub,
          user: username,
          label: 'SPAM_WATCH',
          note,
        });
        await incModAction('modnote');
        actions.push('mod note');
      } catch (err) {
        console.warn(`[hive] badge modnote failed for u/${username}: ${err}`);
      }
    }

    if (wantsRemove && badge.canRemove) {
      try {
        await reddit.remove(
          targetId as `t1_${string}` | `t3_${string}`,
          true,
        );
        await incModAction('remove');
        actions.push(`removed ${location}`);
      } catch (err) {
        console.warn(`[hive] badge remove failed for ${targetId}: ${err}`);
      }
    }

    if (wantsBan && badge.canBan) {
      try {
        await reddit.banUser({
          subredditName: sub,
          username,
          reason: 'Hive Restored — federated threat match',
          message: 'Banned via Hive Restored modqueue badge (auto-action).',
        });
        await incModAction('ban');
        actions.push('ban');
      } catch (err) {
        console.warn(`[hive] badge ban failed for u/${username}: ${err}`);
      }
    }

    if (actions.length > 0) {
      await appendActionLog(sub, {
        type: 'system',
        title: `Modqueue badge · u/${username}`,
        detail: `Actions: ${actions.join(', ')} on ${location} ${targetId}.`,
        tone: 'warning',
      });
    }

    const text =
      actions.length > 0
        ? `Hive badge: ${actions.join(', ')}`
        : 'Hive badge: closed (no actions selected)';

    return c.json<UiResponse>(
      { showToast: { text, appearance: actions.length > 0 ? 'success' : 'neutral' } },
      200,
    );
  } catch (error) {
    console.error(`[hive] modqueue-badge submit error: ${error}`);
    return c.json<UiResponse>(
      { showToast: { text: 'Hive badge: action failed', appearance: 'neutral' } },
      400,
    );
  }
});
