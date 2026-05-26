import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';

/**
 * MockPeerRow — mirrors src/client/game.tsx PeerRow visually. Springs in
 * from opacity 0 + translateY 8px starting at enterFrame.
 */
export const MockPeerRow: React.FC<{
  name: string;
  addedAt?: string;
  reputation?: string;
  enterFrame: number;
}> = ({
  name,
  addedAt = 'Added just now',
  reputation = '—',
  enterFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 18, mass: 0.7, stiffness: 150 },
    durationInFrames: 18,
  });

  const opacity = interpolate(enterProgress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ty = interpolate(enterProgress, [0, 1], [8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        borderRadius: 22,
        background: tokens.bg.creamAlt,
        padding: '14px 20px',
        opacity,
        transform: `translateY(${ty}px)`,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: fontFamily.inter,
            fontWeight: 900,
            fontSize: 20,
            letterSpacing: '-0.02em',
            color: tokens.text.ink,
          }}
        >
          r/{name}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: fontFamily.inter,
            fontWeight: 500,
            fontSize: 13,
            color: tokens.text.softMuted,
          }}
        >
          {addedAt}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: fontFamily.inter,
            fontWeight: 500,
            fontSize: 13,
            color: 'oklch(0.6 0.02 62)',
          }}
        >
          {reputation}
        </div>
      </div>
      <div
        style={{
          borderRadius: 999,
          border: `2px solid oklch(0.78 0.035 62)`,
          padding: '8px 16px',
          fontFamily: fontFamily.inter,
          fontWeight: 900,
          fontSize: 13,
          color: 'oklch(0.42 0.04 52)',
        }}
      >
        Remove
      </div>
    </div>
  );
};
