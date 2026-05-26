import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../../components/Caption';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';
import { ClickPulse } from '../components/ClickPulse';
import { usePressFeedback } from '../components/usePressFeedback';
import { MOCK_SUB } from '../mockData';

// Scene-local frame the "Open dashboard" CTA is clicked.
const CTA_CLICK = 192;

const StatTile: React.FC<{ label: string; value: string; loading: boolean }> = ({
  label,
  value,
  loading,
}) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      borderRadius: 14,
      border: `2px solid ${tokens.border.warm}`,
      background: tokens.bg.creamBright,
      padding: '14px 20px',
      minHeight: 70,
    }}
  >
    {loading ? (
      <>
        <div
          style={{
            width: 60,
            height: 16,
            borderRadius: 8,
            background: 'oklch(0.9 0.02 70)',
          }}
        />
        <div
          style={{
            width: 80,
            height: 10,
            borderRadius: 6,
            background: 'oklch(0.9 0.02 70)',
          }}
        />
      </>
    ) : (
      <>
        <div
          style={{
            fontFamily: fontFamily.inter,
            fontWeight: 900,
            fontSize: 22,
            color: tokens.text.ink,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontFamily: fontFamily.inter,
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: tokens.text.softMuted,
          }}
        >
          {label}
        </div>
      </>
    )}
  </div>
);

export const SplashOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const loading = frame < 120;
  const ctaPress = usePressFeedback(CTA_CLICK);

  // Wordmark drop-in
  const wordOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordTy = interpolate(frame, [0, 30], [-30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // CTA visible from frame 100
  const btnOpacity = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const btnPress = interpolate(frame, [192, 196, 200], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Final crossfade to black
  const sceneExit = interpolate(frame, [225, 240], [1, 0.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: tokens.bg.cream,
        opacity: sceneExit,
      }}
    >
      {/* Centred splash content */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 320,
          transform: 'translateX(-50%)',
          width: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}
      >
        <div
          style={{
            opacity: wordOpacity,
            transform: `translateY(${wordTy}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              fontFamily: fontFamily.inter,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: tokens.accent.kraft,
            }}
          >
            r/{MOCK_SUB}
          </div>
          <div
            style={{
              fontFamily: fontFamily.anton,
              fontSize: 140,
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
              color: tokens.text.ink,
              display: 'flex',
              gap: 24,
            }}
          >
            <span>Hive</span>
            <span style={{ color: tokens.accent.amber }}>Restored</span>
          </div>
          <div
            style={{
              fontFamily: fontFamily.inter,
              fontWeight: 700,
              fontSize: 24,
              color: tokens.text.muted,
              letterSpacing: '-0.02em',
            }}
          >
            federated bad-actor detection for moderators.
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'flex', gap: 16, width: 680, marginTop: 24 }}>
          <StatTile label="Trusted peers" value="0" loading={loading} />
          <StatTile label="Last poll" value="never" loading={loading} />
          <StatTile label="Threats indexed" value="0" loading={loading} />
        </div>

        {/* CTA */}
        <div
          style={{
            marginTop: 28,
            opacity: btnOpacity,
            transform: `scale(${(1 - btnPress * 0.04) * ctaPress.scale})`,
            borderRadius: 28,
            background: tokens.accent.amber,
            color: tokens.text.onDark,
            padding: '20px 44px',
            fontFamily: fontFamily.inter,
            fontWeight: 900,
            fontSize: 24,
            letterSpacing: '-0.01em',
            boxShadow:
              ctaPress.glow > 0.01
                ? `0 18px 40px rgba(65,45,25,0.22), 0 0 0 ${ctaPress.glow * 14}px oklch(0.58 0.17 39 / ${ctaPress.glow * 0.22})`
                : '0 18px 40px rgba(65,45,25,0.22)',
            position: 'relative',
          }}
        >
          Open dashboard
        </div>
      </div>

      {/* Captions */}
      <Caption
        text="fresh install on r/yoursub."
        fontSize={84}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[12, 30]}
        hold={75}
        fadeOut={[90, 105]}
      />
      <Caption
        text="open the mod dashboard."
        fontSize={84}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[120, 138]}
        hold={75}
        fadeOut={[210, 225]}
      />

      {/* Click pulse anchored on the "Open dashboard" CTA. */}
      <ClickPulse at={{ x: 960, y: 720 }} clickAt={CTA_CLICK} targetRadius={68} />
    </div>
  );
};
