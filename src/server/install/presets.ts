/**
 * src/server/install/presets.ts
 *
 * Static trust-circle presets for the Hive Restored onboarding wizard.
 *
 * Presets are opt-in only — they are NEVER applied automatically at install.
 * A moderator must explicitly choose "Hive: apply trust circle preset" from
 * the mod menu and submit the form before any peers are added.
 *
 * Peer names:
 * - No `r/` prefix.
 * - Lowercase.
 * - Deduplicated within each preset.
 * - All match /^[a-z0-9_]{3,21}$/.
 *
 * Curated with generic, mod-tool-friendly subreddits that have established
 * moderation cultures.  Sensitive or controversial communities are excluded.
 */

export type PresetName = 'starter' | 'midsize' | 'large';

export interface TrustCirclePreset {
  name: PresetName;
  label: string;
  description: string;
  /** Subreddit names — no `r/` prefix, lowercase, deduped. */
  peers: string[];
}

export const PRESETS: readonly TrustCirclePreset[] = [
  {
    name: 'starter',
    label: 'Starter (3 peers)',
    description:
      'A minimal trust circle for new installations. Best for small subreddits that want ' +
      'federation signals without a broad peer footprint.',
    peers: [
      'modsupport',
      'modnews',
      'redditrequest',
    ],
  },
  {
    name: 'midsize',
    label: 'Midsize (10 peers)',
    description:
      'A balanced set of established subreddits with active mod teams. ' +
      'Suitable for mid-size communities.',
    peers: [
      'modsupport',
      'modnews',
      'redditrequest',
      'askhistorians',
      'science',
      'personalfinance',
      'explainlikeimfive',
      'todayilearned',
      'changemyview',
      'nostupidquestions',
    ],
  },
  {
    name: 'large',
    label: 'Large (20 peers)',
    description:
      'A broad trust circle for large subreddits that want maximum cross-community signal. ' +
      'Review each peer before applying.',
    peers: [
      'modsupport',
      'modnews',
      'redditrequest',
      'askhistorians',
      'science',
      'personalfinance',
      'explainlikeimfive',
      'todayilearned',
      'changemyview',
      'nostupidquestions',
      'apple',
      'android',
      'gaming',
      'books',
      'movies',
      'television',
      'techsupport',
      'asktechnology',
      'dataisbeautiful',
      'malefashionadvice',
    ],
  },
] as const;

/**
 * Look up a preset by name.
 *
 * @throws {Error} when `name` is not one of the three known preset names.
 */
export function getPreset(name: PresetName): TrustCirclePreset {
  const preset = PRESETS.find((p) => p.name === name);
  if (!preset) {
    throw new Error(`Unknown preset name: "${name}". Valid names are: starter, midsize, large.`);
  }
  return preset;
}
