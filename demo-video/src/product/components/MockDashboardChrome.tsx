import React from 'react';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';
import { MockStatusPill, type StatusKey } from './MockStatusPill';

export type TabId = 'overview' | 'trust' | 'threats' | 'actions' | 'settings';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'trust', label: 'Trust Graph' },
  { id: 'threats', label: 'Threat Feed' },
  { id: 'actions', label: 'Action Log' },
  { id: 'settings', label: 'Settings' },
];

/**
 * MockDashboardChrome — header (eyebrow + h1 + status pill) + tab strip.
 * Sized for a 1920x1080 frame: the dashboard occupies the central 1600px
 * column, ~76px top margin.
 */
export const MockDashboardChrome: React.FC<{
  subName: string;
  activeTab: TabId;
  /** Static status (no transitions). */
  status?: StatusKey;
  /** OR a status timeline. */
  statusTimeline?: Array<{ at: number; state: StatusKey }>;
  /** content below the header */
  children?: React.ReactNode;
}> = ({
  subName,
  activeTab,
  status,
  statusTimeline,
  children,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 160,
        width: 1600,
        height: 960,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        color: tokens.text.ink,
      }}
    >
      {/* Header card */}
      <div
        style={{
          borderRadius: 32,
          background: tokens.bg.creamBright,
          border: `2px solid ${tokens.border.warm}`,
          padding: '28px 36px',
          boxShadow: '0 24px 80px rgba(65,45,25,0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 32,
          }}
        >
          <div style={{ maxWidth: 1000 }}>
            <div
              style={{
                fontFamily: fontFamily.inter,
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: tokens.accent.kraft,
              }}
            >
              Hive Restored
            </div>
            <h1
              style={{
                marginTop: 14,
                fontFamily: fontFamily.inter,
                fontWeight: 900,
                fontSize: 52,
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
                color: tokens.text.ink,
              }}
            >
              Federation control room for r/{subName}
            </h1>
            <p
              style={{
                marginTop: 14,
                maxWidth: 760,
                fontFamily: fontFamily.inter,
                fontSize: 18,
                lineHeight: 1.45,
                color: tokens.text.muted,
              }}
            >
              Trust the subs you know, review the signals they publish, and
              keep every moderator action visible before Hive recommends a
              move.
            </p>
          </div>

          <MockStatusPill state={status} timeline={statusTimeline} />
        </div>

        {/* Tab strip */}
        <div style={{ display: 'flex', gap: 10 }}>
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <div
                key={tab.id}
                style={{
                  borderRadius: 999,
                  background: isActive ? tokens.bg.walnut : tokens.bg.creamAlt,
                  color: isActive ? tokens.text.onDark : tokens.text.softMuted,
                  padding: '10px 22px',
                  fontFamily: fontFamily.inter,
                  fontWeight: 900,
                  fontSize: 16,
                  letterSpacing: '-0.01em',
                }}
              >
                {tab.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel slot */}
      <div style={{ flex: 1, position: 'relative' }}>{children}</div>
    </div>
  );
};
