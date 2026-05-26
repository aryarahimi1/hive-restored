import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';

export const WordmarkClose: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Wordmark spring 0.94 → 1.0 over ~30f.
  const wordSpring = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.6, stiffness: 140 },
    durationInFrames: 30,
  });
  const wordScale = interpolate(wordSpring, [0, 1], [0.94, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const sub1Opacity = interpolate(frame, [30, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const sub2Opacity = interpolate(frame, [42, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Final 30f fade to black.
  const blackoutOpacity = interpolate(frame, [150, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Wordmark */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <div
          style={{
            opacity: wordOpacity,
            transform: `scale(${wordScale})`,
            display: 'flex',
            gap: 28,
            fontFamily: fontFamily.anton,
            fontSize: 200,
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
            color: tokens.text.ink,
          }}
        >
          <span>Hive</span>
          <span style={{ color: tokens.accent.amber }}>Restored</span>
        </div>

        <div
          style={{
            marginTop: 30,
            opacity: sub1Opacity,
            fontFamily: fontFamily.inter,
            fontWeight: 700,
            fontSize: 42,
            letterSpacing: '-0.02em',
            color: tokens.text.muted,
            textAlign: 'center',
          }}
        >
          shared defense, mod-controlled.
        </div>
        <div
          style={{
            opacity: sub2Opacity,
            fontFamily: fontFamily.inter,
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: tokens.accent.kraft,
            textAlign: 'center',
          }}
        >
          built on devvit
        </div>
      </div>

      {/* Final blackout */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: tokens.bg.walnutDeep,
          opacity: blackoutOpacity,
        }}
      />
    </div>
  );
};
