/**
 * src/server/routes/forms.ts
 *
 * Hono router for Devvit form-submit callbacks. Forms are declared in
 * devvit.json under the top-level `"forms"` key; Devvit POSTs the user's
 * field values to the registered endpoint when the mod submits the form.
 *
 * Submission body shape (from @devvit/shared-types/shared/form.d.ts):
 *   The body is a plain JSON object whose keys match the `name` attributes
 *   of the form fields. For a StringField named "peer" the body will be:
 *   { "peer": "somevalue" }
 */

import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';

import { addTrustedPeer } from '../storage/trustGraph';
import { appendActionLog } from '../storage/actionLog';
import { getPreset } from '../install/presets';
import type { PresetName } from '../install/presets';
import { assertCurrentUserIsModerator, requireSubredditName } from '../moderator';

export const forms = new Hono();

/**
 * Resolves the active sub + asserts the caller is a moderator there.
 * Returns a friendly UiResponse toast on failure so handlers can early-return
 * cleanly instead of throwing a generic 400.
 */
async function resolveModSub(): Promise<
  { ok: true; sub: string } | { ok: false; response: UiResponse }
> {
  let sub: string;
  try {
    sub = requireSubredditName();
  } catch {
    return {
      ok: false,
      response: {
        showToast: {
          text: 'Hive: could not resolve subreddit context',
          appearance: 'neutral',
        },
      },
    };
  }
  try {
    await assertCurrentUserIsModerator(sub);
  } catch {
    return {
      ok: false,
      response: {
        showToast: {
          text: 'Hive: moderator access required to use this form',
          appearance: 'neutral',
        },
      },
    };
  }
  return { ok: true, sub };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate and normalise a raw peer subreddit name supplied by a mod.
 *
 * Rules:
 * - Strip a leading `r/` prefix (case-insensitive).
 * - Strip surrounding whitespace.
 * - Lowercase the result.
 * - Reject if length < 3 or > 21 characters.
 * - Reject if it contains characters other than letters, digits, or underscores.
 *
 * @param raw - The raw string the mod typed into the form field.
 * @returns `{ ok: true; peer: string }` on success, or `{ ok: false; error: string }`.
 */
export function validatePeerName(
  raw: unknown,
): { ok: true; peer: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: 'Peer subreddit name is required' };
  }

  const stripped = raw.trim().replace(/^r\//i, '').toLowerCase();

  if (/\s/.test(stripped)) {
    return { ok: false, error: 'Peer name must not contain spaces' };
  }

  if (!/^[a-z0-9_]+$/.test(stripped)) {
    return {
      ok: false,
      error: 'Peer name may only contain letters, digits, and underscores',
    };
  }

  if (stripped.length < 3) {
    return { ok: false, error: 'Peer name must be at least 3 characters' };
  }

  if (stripped.length > 21) {
    return { ok: false, error: 'Peer name must be 21 characters or fewer' };
  }

  return { ok: true, peer: stripped };
}

export function normalisePresetName(raw: unknown): PresetName | null {
  if (Array.isArray(raw)) {
    if (raw.length !== 1) return null;
    return normalisePresetName(raw[0]);
  }

  if (raw === 'starter' || raw === 'midsize' || raw === 'large') return raw;
  return null;
}

// ---------------------------------------------------------------------------
// Form submit endpoint — "addPeer" form
// ---------------------------------------------------------------------------

/**
 * Handle submission of the "addPeer" form (registered as
 * `forms.addPeer = "/internal/forms/add-peer"` in devvit.json).
 *
 * Devvit POSTs a JSON body whose top-level keys are the form field names.
 * For the addPeer form this is `{ peer: string }`.
 */
forms.post('/add-peer', async (c) => {
  try {
    const access = await resolveModSub();
    if (!access.ok) return c.json<UiResponse>(access.response, 200);
    const currentSub = access.sub;

    // Parse the form submission body
    let body: Record<string, unknown>;
    try {
      body = await c.req.json<Record<string, unknown>>();
    } catch {
      return c.json<UiResponse>(
        {
          showToast: {
            text: 'Hive: could not read form submission — please try again',
            appearance: 'neutral',
          },
        },
        200,
      );
    }

    const validation = validatePeerName(body['peer']);
    if (!validation.ok) {
      return c.json<UiResponse>(
        { showToast: { text: `Hive: ${validation.error}`, appearance: 'neutral' } },
        200,
      );
    }

    const peer = validation.peer;

    const changed = await addTrustedPeer(currentSub, peer);
    if (changed) {
      await appendActionLog(currentSub, {
        type: 'peer',
        title: `Trusted r/${peer}`,
        detail: 'Added to the federation trust graph from the mod menu form.',
        tone: 'success',
        undo: { kind: 'removePeer', peer },
      });
    }

    return c.json<UiResponse>(
      {
        showToast: {
          text: `Added r/${peer} as trusted peer`,
          appearance: 'success',
        },
      },
      200,
    );
  } catch (error) {
    console.error(`[hive] forms/add-peer error: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: {
          text: `Hive: add-peer failed — ${String(error)}`,
          appearance: 'neutral',
        },
      },
      400,
    );
  }
});

// ---------------------------------------------------------------------------
// Form submit endpoint — "applyPreset" form
// ---------------------------------------------------------------------------

/**
 * Handle submission of the "applyPreset" form (registered as
 * `forms.applyPreset = "/internal/forms/apply-preset"` in devvit.json).
 *
 * Expected body: `{ preset: PresetName }`.
 *
 * Iterates all peers in the chosen preset, calls `addTrustedPeer` for each
 * (idempotent — returns false when already present), counts added vs skipped,
 * logs the apply to the action log, and toasts a summary.
 */
forms.post('/apply-preset', async (c) => {
  try {
    const access = await resolveModSub();
    if (!access.ok) return c.json<UiResponse>(access.response, 200);
    const currentSub = access.sub;

    // Parse form body
    let body: Record<string, unknown>;
    try {
      body = await c.req.json<Record<string, unknown>>();
    } catch {
      return c.json<UiResponse>(
        {
          showToast: {
            text: 'Hive: could not read form submission — please try again',
            appearance: 'neutral',
          },
        },
        200,
      );
    }

    // Validate preset name. Devvit select fields can submit either a string
    // or a one-item string[] depending on surface/version.
    const presetName = normalisePresetName(body['preset']);
    if (!presetName) {
      return c.json<UiResponse>(
        {
          showToast: {
            text: 'Hive: invalid preset — choose starter, midsize, or large',
            appearance: 'neutral',
          },
        },
        200,
      );
    }

    const preset = getPreset(presetName);

    let added = 0;
    let skipped = 0;

    for (const peer of preset.peers) {
      try {
        const changed = await addTrustedPeer(currentSub, peer);
        if (changed) {
          added++;
        } else {
          skipped++;
        }
      } catch (peerErr) {
        // addTrustedPeer can throw if the sub tries to add itself or if the
        // cap is hit.  Count as skipped so the loop continues.
        console.warn(`[hive] apply-preset: skipping peer r/${peer}: ${peerErr}`);
        skipped++;
      }
    }

    await appendActionLog(currentSub, {
      type: 'peer',
      title: `Applied preset "${preset.label}"`,
      detail:
        `Applied the "${preset.name}" trust circle preset to r/${currentSub}. ` +
        `${added} peer${added === 1 ? '' : 's'} added, ` +
        `${skipped} already present or skipped.`,
      tone: added > 0 ? 'success' : 'neutral',
    });

    return c.json<UiResponse>(
      {
        showToast: {
          text: `Applied ${preset.label}: ${added} added, ${skipped} already present`,
          appearance: added > 0 ? 'success' : 'neutral',
        },
      },
      200,
    );
  } catch (error) {
    console.error(`[hive] forms/apply-preset error: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: {
          text: `Hive: apply-preset failed — ${String(error)}`,
          appearance: 'neutral',
        },
      },
      400,
    );
  }
});
