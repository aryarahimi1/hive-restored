import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../../components/Caption';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';
import { ClickPulse } from '../components/ClickPulse';
import { ImpactStat } from '../components/ImpactStat';
import { MockDashboardChrome } from '../components/MockDashboardChrome';
import { MockMetricTile } from '../components/MockMetricTile';
import { MockTabPanel } from '../components/MockTabPanel';
import { MOCK_IMPACT_TARGETS, MOCK_SUB } from '../mockData';

// scene-local
const TAB_CLICK = 87; // → overview
const FLAGS_START = 135;
const MOD_START = 155;
const FED_START = 195;

export const OverviewImpact: React.FC = () => {
  const frame = useCurrentFrame();

  const entry = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const actionsOpacity = interpolate(
    frame,
    [TAB_CLICK, TAB_CLICK + 7],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const overviewOpacity = interpolate(
    frame,
    [TAB_CLICK, TAB_CLICK + 7],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Detail line crossfade for "Mod actions" tile
  const detailCross = interpolate(
    frame,
    [MOD_START, MOD_START + 18],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: entry }}>
      <MockDashboardChrome
        subName={MOCK_SUB}
        activeTab={frame < TAB_CLICK ? 'actions' : 'overview'}
        status="polling"
      >
        {frame < TAB_CLICK + 7 ? (
          <div style={{ position: 'absolute', inset: 0, opacity: actionsOpacity }}>
            <MockTabPanel
              title="Action Log"
              detail="Recent setup and moderation events stored for auditability."
            />
          </div>
        ) : null}
        {frame >= TAB_CLICK ? (
          <div style={{ position: 'absolute', inset: 0, opacity: overviewOpacity }}>
            <MockTabPanel
              title="Overview"
              detail="Demo-session counters visible to moderators."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <MockMetricTile label="Trusted peers" value={9} />
                  <MockMetricTile label="Active threats" value={1} />
                  <MockMetricTile label="Indexed total" value={1} />
                  <MockMetricTile label="Last poll" value="just now (1 new)" compact />
                </div>

                {/* Impact card */}
                <div
                  style={{
                    borderRadius: 28,
                    border: `2px solid ${tokens.border.warm}`,
                    background: tokens.bg.creamBright,
                    padding: '22px 24px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: fontFamily.inter,
                      fontWeight: 900,
                      fontSize: 24,
                      letterSpacing: '-0.04em',
                      color: tokens.text.ink,
                    }}
                  >
                    Impact
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: fontFamily.inter,
                      fontSize: 14,
                      color: tokens.text.muted,
                    }}
                  >
                    Demo-session counters for the walkthrough.
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 20 }}>
                    <ImpactStat
                      label="Flags raised"
                      detail="Posts surfaced for review."
                      targetValue={MOCK_IMPACT_TARGETS.flagsRaised}
                      startFrame={FLAGS_START}
                    />
                    <ImpactStat
                      label="Mod actions"
                      detail={
                        detailCross < 0.5
                          ? '—'
                          : MOCK_IMPACT_TARGETS.modActionsBreakdown
                      }
                      targetValue={MOCK_IMPACT_TARGETS.modActionsTotal}
                      startFrame={MOD_START}
                    />
                    <ImpactStat
                      label="False positives"
                      detail="Alerts dismissed."
                      targetValue={MOCK_IMPACT_TARGETS.falsePositives}
                      startFrame={MOD_START}
                    />
                    <ImpactStat
                      label="Federation alerts"
                      detail="Fingerprints from peers."
                      targetValue={MOCK_IMPACT_TARGETS.federationAlerts}
                      startFrame={FED_START}
                    />
                  </div>
                </div>
              </div>
            </MockTabPanel>
          </div>
        ) : null}
      </MockDashboardChrome>

      <Caption
        text="back to overview."
        fontSize={84}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[30, 45]}
        hold={75}
        fadeOut={[140, 155]}
      />
      <Caption
        text="demo counters update."
        fontSize={76}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[160, 175]}
        hold={75}
        fadeOut={[300, 315]}
      />
      <Caption
        text="shadow mode can stay on."
        fontSize={76}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[320, 335]}
        hold={75}
        fadeOut={[460, 475]}
      />

      {/* Click pulse on the "Overview" tab pill at TAB_CLICK. */}
      <ClickPulse at={{ x: 290, y: 360 }} clickAt={TAB_CLICK} targetRadius={36} />
    </div>
  );
};
