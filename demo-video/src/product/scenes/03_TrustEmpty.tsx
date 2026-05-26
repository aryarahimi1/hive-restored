import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../../components/Caption';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';
import { ClickPulse } from '../components/ClickPulse';
import { MockDashboardChrome } from '../components/MockDashboardChrome';
import { MockEmptyState } from '../components/MockEmptyState';
import { MockTabPanel } from '../components/MockTabPanel';
import { usePressFeedback } from '../components/usePressFeedback';
import { MOCK_SUB } from '../mockData';

// Scene-local frame at which "Apply preset" is clicked.
const APPLY_CLICK = 132;

export const TrustEmpty: React.FC = () => {
  const frame = useCurrentFrame();
  const applyPress = usePressFeedback(APPLY_CLICK);

  const entry = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: entry }}>
      <MockDashboardChrome
        subName={MOCK_SUB}
        activeTab="trust"
        status="setup_needed"
      >
        <MockTabPanel
          title="Trust Graph"
          detail="Add peer subs whose moderation signals should reach this install."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Input row + Add peer + Apply preset */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              <div
                style={{
                  flex: 1,
                  borderRadius: 22,
                  border: `2px solid oklch(0.82 0.035 68)`,
                  background: 'oklch(0.99 0.006 72)',
                  padding: '14px 18px',
                  fontFamily: fontFamily.inter,
                  fontWeight: 700,
                  fontSize: 16,
                  color: 'oklch(0.6 0.02 62)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                modsupport
              </div>
              <div
                style={{
                  borderRadius: 22,
                  background: tokens.accent.amber,
                  color: tokens.text.onDark,
                  padding: '14px 24px',
                  fontFamily: fontFamily.inter,
                  fontWeight: 900,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 12px 28px rgba(65,45,25,0.18)',
                }}
              >
                Add peer
              </div>
              <div
                style={{
                  borderRadius: 22,
                  background: tokens.bg.walnut,
                  color: tokens.text.onDark,
                  padding: '14px 24px',
                  fontFamily: fontFamily.inter,
                  fontWeight: 900,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow:
                    applyPress.glow > 0.01
                      ? `0 12px 28px rgba(20,12,6,0.22), 0 0 0 ${applyPress.glow * 10}px oklch(0.58 0.17 39 / ${applyPress.glow * 0.26})`
                      : '0 12px 28px rgba(20,12,6,0.22)',
                  transform: `scale(${applyPress.scale})`,
                  transformOrigin: 'center center',
                }}
              >
                Apply preset
              </div>
            </div>

            <MockEmptyState
              title="No peers yet"
              detail="Start with one friendly test subreddit, then poll peers from the mod menu."
            />
          </div>
        </MockTabPanel>
      </MockDashboardChrome>

      <Caption
        text="add subs your team already trusts."
        fontSize={80}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[30, 45]}
        hold={75}
        fadeOut={[150, 165]}
      />

      {/* Click pulse on the "Apply preset" button (dark walnut CTA, right
          side of the input row). */}
      <ClickPulse at={{ x: 1450, y: 460 }} clickAt={APPLY_CLICK} targetRadius={56} />
    </div>
  );
};
