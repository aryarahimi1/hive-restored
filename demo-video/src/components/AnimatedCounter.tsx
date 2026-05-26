import React from 'react';
import { Easing, interpolate } from 'remotion';
import { fontFamily } from '../fonts';
import { tokens } from '../theme';

export const AnimatedCounter: React.FC<{
  fromValue: number;
  toValue: number;
  startFrame: number;
  endFrame: number;
  /** scene-local current frame */
  frame: number;
  suffix?: string;
  fontSize?: number;
  color?: string;
}> = ({
  fromValue,
  toValue,
  startFrame,
  endFrame,
  frame,
  suffix = '',
  fontSize = 100,
  color = tokens.text.onDark,
}) => {
  const raw = interpolate(frame, [startFrame, endFrame], [fromValue, toValue], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const value = Math.round(raw);

  return (
    <div
      style={{
        fontFamily: fontFamily.inter,
        fontWeight: 900,
        fontSize,
        color,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.04em',
        lineHeight: 1,
      }}
    >
      {value}
      {suffix}
    </div>
  );
};
