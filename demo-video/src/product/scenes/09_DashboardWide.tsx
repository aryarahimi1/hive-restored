import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../../components/Caption';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';
import { ImpactStat } from '../components/ImpactStat';
import { MockDashboardChrome } from '../components/MockDashboardChrome';
import { MockMetricTile } from '../components/MockMetricTile';
import { MockTabPanel } from '../components/MockTabPanel';
import { MOCK_IMPACT_TARGETS, MOCK_SUB } from '../mockData';

export const DashboardWide: React.FC = () => {
  const frame = useCurrentFrame();

  const entry = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Zoom out from 1.0 → 0.78 over 90 frames, ease out cubic.
  const scale = interpolate(frame, [0, 90], [1, 0.78], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const ty = interpolate(frame, [0, 90], [0, -24], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const shadowAmt = interpolate(frame, [0, 90], [12, 36], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Exit fade — dashboard fades to 0.4 opacity by frame 240
  const exitOpacity = interpolate(frame, [225, 240], [1, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: entry,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateY(${ty}px) scale(${scale})`,
          transformOrigin: 'center center',
          filter: `drop-shadow(0 ${shadowAmt}px ${shadowAmt * 2}px rgba(65,45,25,0.16))`,
          opacity: exitOpacity,
        }}
      >
        <MockDashboardChrome
          subName={MOCK_SUB}
          activeTab="overview"
          status="polling"
        >
          <MockTabPanel
            title="Overview"
            detail="Demo-session counters for the walkthrough."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <MockMetricTile label="Trusted peers" value={9} />
                <MockMetricTile label="Active threats" value={1} />
                <MockMetricTile label="Indexed total" value={1} />
                <MockMetricTile label="Last poll" value="just now (1 new)" compact />
              </div>
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
                    color: tokens.text.ink,
                    letterSpacing: '-0.04em',
                  }}
                >
                  Impact
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 20 }}>
                  <ImpactStat
                    label="Flags raised"
                    detail="Posts surfaced for review."
                    targetValue={MOCK_IMPACT_TARGETS.flagsRaised}
                    startFrame={-60}
                  />
                  <ImpactStat
                    label="Mod actions"
                    detail={MOCK_IMPACT_TARGETS.modActionsBreakdown}
                    targetValue={MOCK_IMPACT_TARGETS.modActionsTotal}
                    startFrame={-60}
                  />
                  <ImpactStat
                    label="False positives"
                    detail="Alerts dismissed."
                    targetValue={MOCK_IMPACT_TARGETS.falsePositives}
                    startFrame={-60}
                  />
                  <ImpactStat
                    label="Federation alerts"
                    detail="Fingerprints from peers."
                    targetValue={MOCK_IMPACT_TARGETS.federationAlerts}
                    startFrame={-60}
                  />
                </div>
              </div>
            </div>
          </MockTabPanel>
        </MockDashboardChrome>
      </div>

      <Caption
        text="trust graph. alerts. actions. metrics."
        fontSize={84}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[30, 45]}
        hold={75}
        fadeOut={[180, 195]}
      />

      {/* No interactive clicks here — this scene zooms out for the wide
          "shared defense" beat. Cursor previously held + faded; with the
          cursor removed there's nothing to render. */}
    </div>
  );
};
