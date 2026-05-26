import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';

/**
 * MockToast — top-right slide-in banner. Slides in over 12f starting
 * `enterFrame`, holds, then slides out over 12f starting `exitFrame`.
 */
export const MockToast: React.FC<{
  message: string;
  tone?: 'success' | 'info';
  enterFrame: number;
  exitFrame: number;
  /** override absolute right offset, default 60 */
  right?: number;
  /** override absolute top offset, default 60 */
  top?: number;
}> = ({
  message,
  tone = 'success',
  enterFrame,
  exitFrame,
  right = 60,
  top = 60,
}) => {
  const frame = useCurrentFrame();

  // Slide in
  const inTx = interpolate(
    frame,
    [enterFrame, enterFrame + 12],
    [400, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  // Slide out
  const outTx = interpolate(
    frame,
    [exitFrame, exitFrame + 12],
    [0, 400],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.in(Easing.cubic),
    },
  );

  const inOpacity = interpolate(
    frame,
    [enterFrame, enterFrame + 8],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const outOpacity = interpolate(
    frame,
    [exitFrame, exitFrame + 12],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const opacity = Math.min(inOpacity, outOpacity);

  const accent =
    tone === 'success' ? tokens.ok.green : tokens.accent.amber;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        right,
        background: tokens.bg.walnut,
        color: tokens.text.onDark,
        borderRadius: 22,
        padding: '14px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity,
        transform: `translateX(${inTx + outTx}px)`,
        boxShadow: '0 18px 48px rgba(20,12,6,0.4)',
        maxWidth: 480,
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 0 4px ${accent}33`,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          fontFamily: fontFamily.inter,
          fontWeight: 800,
          fontSize: 16,
          lineHeight: 1.3,
          letterSpacing: '-0.01em',
        }}
      >
        {message}
      </div>
    </div>
  );
};
