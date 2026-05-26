import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../../components/Caption';
import { tokens } from '../../theme';
import { ClickPulse } from '../components/ClickPulse';
import { MockDashboardChrome } from '../components/MockDashboardChrome';
import { MockEmptyState } from '../components/MockEmptyState';
import { MockMetricTile } from '../components/MockMetricTile';
import { MockTabPanel } from '../components/MockTabPanel';
import { MOCK_SUB } from '../mockData';

export const OverviewEmpty: React.FC = () => {
  const frame = useCurrentFrame();

  // Tab switches at scene-local frame 127 (= global 367 = 240 + 127). Panel
  // cross-dissolves over 7 frames around that.
  const tabSwitchFrame = 127;

  // Cross-dissolve curves.
  const overviewOpacity = interpolate(
    frame,
    [tabSwitchFrame, tabSwitchFrame + 7],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Entry crossfade in from scene 1
  const entry = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: entry }}>
      <MockDashboardChrome
        subName={MOCK_SUB}
        activeTab={frame < tabSwitchFrame ? 'overview' : 'trust'}
        status="setup_needed"
      >
        {/* Overview panel content — fades out as we switch tabs */}
        {frame < tabSwitchFrame + 7 ? (
          <div style={{ opacity: overviewOpacity }}>
            <MockTabPanel
              title="Overview"
              detail="Fresh install. Add peers to start federation polling."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <MockMetricTile label="Trusted peers" value={0} />
                  <MockMetricTile label="Active threats" value={0} />
                  <MockMetricTile label="Indexed total" value={0} />
                  <MockMetricTile label="Last poll" value="Never" compact />
                </div>
                <MockEmptyState
                  title="Metrics warming up"
                  detail="Numbers will appear as mods take actions."
                />
                <div style={{ display: 'flex', gap: 18 }}>
                  <div style={{ flex: 1 }}>
                    <MockEmptyState
                      title="No peers yet"
                      detail="Open Trust Graph to add your first peer."
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <MockEmptyState
                      title="No alerts indexed"
                      detail="Open Threat Feed after a peer poll finds alerts."
                    />
                  </div>
                </div>
              </div>
            </MockTabPanel>
          </div>
        ) : null}
      </MockDashboardChrome>

      <Caption
        text="nothing happens until you opt in."
        fontSize={84}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[15, 30]}
        hold={75}
        fadeOut={[105, 120]}
      />
      <Caption
        text="start with trusted peers."
        fontSize={84}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[130, 145]}
        hold={75}
        fadeOut={[225, 240]}
      />

      {/* Click pulse on the "Trust Graph" tab pill (the tab the user
          switches to). Tab pills are short — use a flatter radius. */}
      <ClickPulse at={{ x: 530, y: 360 }} clickAt={tabSwitchFrame} targetRadius={36} />
    </div>
  );
};
