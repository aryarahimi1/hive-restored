import { redis } from '@devvit/web/server';

export type DashboardSettings = {
  shadowMode: boolean;
  autoAction: boolean;
  reviewThreshold: number;
  flagThreshold: number;
};

export const DEFAULT_SETTINGS: DashboardSettings = {
  shadowMode: true,
  autoAction: false,
  reviewThreshold: 55,
  flagThreshold: 75,
};

function settingsKey(sub: string): string {
  return `settings:${sub}`;
}

function isDashboardSettings(value: unknown): value is DashboardSettings {
  if (!value || typeof value !== 'object') return false;
  return (
    'shadowMode' in value &&
    'autoAction' in value &&
    'reviewThreshold' in value &&
    'flagThreshold' in value &&
    typeof value.shadowMode === 'boolean' &&
    typeof value.autoAction === 'boolean' &&
    typeof value.reviewThreshold === 'number' &&
    typeof value.flagThreshold === 'number'
  );
}

export async function getSettings(sub: string): Promise<DashboardSettings> {
  const raw = await redis.get(settingsKey(sub));
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isDashboardSettings(parsed) ? parsed : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(
  sub: string,
  next: DashboardSettings,
): Promise<DashboardSettings> {
  await redis.set(settingsKey(sub), JSON.stringify(next));
  return next;
}

/**
 * Seed settings for a subreddit only if no record has been written yet.
 *
 * Uses a Redis `NX` (set-if-not-exists) write so this is safe to call at
 * install time without overwriting settings a mod already customised.
 *
 * @returns `true` when the seed was written, `false` when settings already existed.
 */
export async function initSettings(
  sub: string,
  defaults: DashboardSettings,
): Promise<boolean> {
  const result = await redis.set(settingsKey(sub), JSON.stringify(defaults), {
    nx: true,
  });
  return result === 'OK';
}
