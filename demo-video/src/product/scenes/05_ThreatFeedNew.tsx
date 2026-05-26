import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../../components/Caption';
import { tokens } from '../../theme';
import { ClickPulse } from '../components/ClickPulse';
import { MockDashboardChrome } from '../components/MockDashboardChrome';
import { MockTabPanel } from '../components/MockTabPanel';
import { MockThreatRow } from '../components/MockThreatRow';
import { MOCK_SUB, MOCK_THREAT } from '../mockData';

// scene-local frames
const TAB_CLICK = 67; // → threats
const THREAT_ENTER = 80;
const EXPAND_CLICK = 232;

export const ThreatFeedNew: React.FC = () => {
  const frame = useCurrentFrame();

  const entry = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Panel crossfade — trust panel fading out while threats panel fades in.
  const trustOpacity = interpolate(
    frame,
    [TAB_CLICK, TAB_CLICK + 7],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const threatsOpacity = interpolate(
    frame,
    [TAB_CLICK, TAB_CLICK + 7],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: entry }}>
      <MockDashboardChrome
        subName={MOCK_SUB}
        activeTab={frame < TAB_CLICK ? 'trust' : 'threats'}
        status="polling"
      >
        {frame < TAB_CLICK + 7 ? (
          <div style={{ position: 'absolute', inset: 0, opacity: trustOpacity }}>
            <MockTabPanel
              title="Trust Graph"
              detail="Add peer subs whose moderation signals should reach this install."
            />
          </div>
        ) : null}

        {frame >= TAB_CLICK ? (
          <div style={{ position: 'absolute', inset: 0, opacity: threatsOpacity }}>
            <MockTabPanel
              title="Threat Feed"
              detail="Incoming peer alerts indexed from trusted subreddit wiki feeds."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <MockThreatRow
                  publisherSub={MOCK_THREAT.publisherSub}
                  alertId={MOCK_THREAT.alertId}
                  category="Cadence"
                  composite={MOCK_THREAT.composite}
                  matchedSignal="Cadence"
                  publishedAt={MOCK_THREAT.publishedAt}
                  ttlAt={MOCK_THREAT.ttlAt}
                  enterFrame={THREAT_ENTER}
                  expandFrame={EXPAND_CLICK}
                />
              </div>
            </MockTabPanel>
          </div>
        ) : null}
      </MockDashboardChrome>

      <Caption
        text="a peer alert arrives."
        fontSize={80}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[20, 35]}
        hold={75}
        fadeOut={[130, 145]}
      />
      <Caption
        text="composite score: 87."
        fontSize={80}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[140, 155]}
        hold={75}
        fadeOut={[230, 245]}
      />
      <Caption
        text="evidence before action."
        fontSize={80}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[250, 265]}
        hold={75}
        fadeOut={[345, 360]}
      />

      {/* Click pulses: first on the "Threat Feed" tab pill (TAB_CLICK),
          then on the "Show detail" expander row inside the threat card. */}
      <ClickPulse at={{ x: 570, y: 360 }} clickAt={TAB_CLICK} targetRadius={36} />
      <ClickPulse at={{ x: 1150, y: 700 }} clickAt={EXPAND_CLICK} targetRadius={44} />
    </div>
  );
};
