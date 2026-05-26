/**
 * Modqueue threat badge — shared server context for fingerprint, peer matches,
 * and mod-facing form copy. Used by the modqueue menu/form surface (Devvit Web
 * today; structured so a future Blocks popover can call the same helpers).
 */

import { redis } from '@devvit/web/server';

import { bandGlyph } from '../fingerprint/composite';
import type { ThreatMatch } from '../federation/threatMatcher';
import { getThreatRecord } from '../federation/wikiSubscriber';

export type ModqueueBadgeLocation = 'post' | 'comment';

export type StoredFingerprint = {
  username: string;
  computedAt: string;
  sampleSize: number;
  corpusChars: number;
  timeEntropy?: { kl: number; anomaly: number };
  cadence?: { simHash: string; sampleSize: number; anomaly: number };
  domain?: { minHash: string; domainCount: number; anomaly: number };
  composite?: {
    score: number;
    band: 'clean' | 'watch' | 'review' | 'flag';
    presentSignals: number;
  };
};

export type DashboardSettings = {
  shadowMode: boolean;
  autoAction: boolean;
  reviewThreshold: number;
  flagThreshold: number;
};

const DEFAULT_SETTINGS: DashboardSettings = {
  shadowMode: true,
  autoAction: false,
  reviewThreshold: 55,
  flagThreshold: 75,
};

export type ModqueueBadgeContext = {
  username: string;
  targetId: string;
  location: ModqueueBadgeLocation;
  fingerprint: StoredFingerprint | null;
  matches: ThreatMatch[];
  settings: DashboardSettings;
  scoreLine: string;
  signalsLine: string;
  evidenceSummary: string;
  evidenceDetail: string;
  shadowHint: string;
  canRemove: boolean;
  canBan: boolean;
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

export async function getDashboardSettings(sub: string): Promise<DashboardSettings> {
  const raw = await redis.get(settingsKey(sub));
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isDashboardSettings(parsed) ? parsed : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function loadFingerprint(username: string): Promise<StoredFingerprint | null> {
  const raw = await redis.get(`fp:${username}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredFingerprint;
  } catch {
    return null;
  }
}

export async function loadPeerMatches(username: string): Promise<ThreatMatch[]> {
  const raw = await redis.get(`match:${username}`);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ThreatMatch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatSignals(fp: StoredFingerprint | null): string {
  if (!fp) return 'No fingerprint cached yet — Hive will compute on the next post/comment.';

  const parts: string[] = [];
  if (fp.timeEntropy) {
    parts.push(`Time entropy: anomaly ${fp.timeEntropy.anomaly.toFixed(2)} (KL ${fp.timeEntropy.kl.toFixed(2)})`);
  }
  if (fp.cadence) {
    parts.push(
      `Cadence: anomaly ${fp.cadence.anomaly.toFixed(2)} · simHash ${fp.cadence.simHash.slice(0, 8)}… · n=${fp.cadence.sampleSize}`,
    );
  }
  if (fp.domain) {
    parts.push(
      `Domain history: anomaly ${fp.domain.anomaly.toFixed(2)} · ${fp.domain.domainCount} domains`,
    );
  }
  if (parts.length === 0) {
    return `Insufficient history (n=${fp.sampleSize}, ${fp.corpusChars} chars).`;
  }
  return parts.join('\n');
}

async function formatEvidence(matches: ThreatMatch[]): Promise<{ summary: string; detail: string }> {
  if (matches.length === 0) {
    return {
      summary: 'No peer federation matches for this author.',
      detail: 'When a trusted peer publishes a matching threat hash, evidence will appear here.',
    };
  }

  const top = matches[0];
  const summary =
    `${matches.length} peer match${matches.length === 1 ? '' : 'es'} · top: r/${top?.publisherSub ?? '?'} ` +
    `(${top ? Math.round(top.similarity * 100) : 0}% via ${top?.matchedSignal ?? '?'})`;

  const lines: string[] = [];
  for (const m of matches) {
    const record = await getThreatRecord(m.alertId);
    const composite =
      record?.fingerprint.composite !== undefined
        ? ` · publisher composite ${record.fingerprint.composite}/100`
        : '';
    lines.push(
      `• r/${m.publisherSub} · ${m.category} · ${Math.round(m.similarity * 100)}% ${m.matchedSignal}${composite}`,
    );
    if (record) {
      lines.push(`  alert ${m.alertId} · published ${record.publishedAt} · TTL ${record.ttlAt}`);
    }
  }

  return { summary, detail: lines.join('\n') };
}

export async function buildModqueueBadgeContext(input: {
  sub: string;
  username: string;
  targetId: string;
  location: ModqueueBadgeLocation;
}): Promise<ModqueueBadgeContext> {
  const [fingerprint, matches, settings] = await Promise.all([
    loadFingerprint(input.username),
    loadPeerMatches(input.username),
    getDashboardSettings(input.sub),
  ]);

  const score = fingerprint?.composite;
  const scoreLine = score
    ? `${bandGlyph(score.band)} ${score.score}/100 · ${score.band} · ${score.presentSignals} signal(s) · u/${input.username}`
    : `u/${input.username} · no composite score yet`;

  const { summary: evidenceSummary, detail: evidenceDetail } = await formatEvidence(matches);

  const meetsFlagThreshold =
    score !== undefined && score.score >= settings.flagThreshold;
  const hasRisk = meetsFlagThreshold || matches.length > 0;

  const actionsAllowed = !settings.shadowMode && settings.autoAction;
  const canRemove = actionsAllowed && hasRisk;
  const canBan = actionsAllowed && meetsFlagThreshold;

  const shadowHint = settings.shadowMode
    ? 'Shadow mode is on — Hive surfaces this badge only; remove/ban actions stay disabled until you turn off shadow mode and enable auto-action in the dashboard.'
    : settings.autoAction
      ? 'Auto-action is enabled — checked actions below will run as the moderating user.'
      : 'Auto-action is off — use the dashboard settings to allow one-click remove/ban from this badge.';

  return {
    username: input.username,
    targetId: input.targetId,
    location: input.location,
    fingerprint,
    matches,
    settings,
    scoreLine,
    signalsLine: formatSignals(fingerprint),
    evidenceSummary,
    evidenceDetail,
    shadowHint,
    canRemove,
    canBan,
  };
}
