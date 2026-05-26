import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';

/**
 * ImpactStat — Impact card tile. Number ticks from 0 → targetValue over
 * `durationInFrames` starting `startFrame`, using a soft cubic ease.
 */
export const ImpactStat: React.FC<{
  label: string;
  detail?: string;
  targetValue: number;
  startFrame: number;
  durationInFrames?: number;
  width?: number;
}> = ({
  label,
  detail,
  targetValue,
  startFrame,
  durationInFrames = 48,
  width,
}) => {
  const frame = useCurrentFrame();

  const v = Math.round(
    interpolate(
      frame,
      [startFrame, startFrame + durationInFrames],
      [0, targetValue],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      },
    ),
  );

  return (
    <div
      style={{
        width,
        flex: width ? undefined : 1,
        borderRadius: 22,
        background: tokens.bg.creamBright,
        border: `2px solid ${tokens.border.warm}`,
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          fontFamily: fontFamily.inter,
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'oklch(0.5 0.05 58)',
        }}
      >
        {label}
      </div>
      {detail ? (
        <div
          style={{
            fontFamily: fontFamily.inter,
            fontWeight: 500,
            fontSize: 12,
            lineHeight: 1.4,
            color: tokens.text.muted,
            minHeight: 16,
          }}
        >
          {detail}
        </div>
      ) : null}
      <div
        style={{
          marginTop: 6,
          fontFamily: fontFamily.anton,
          fontWeight: 400,
          fontSize: 64,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          color: tokens.text.ink,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {v}
      </div>
    </div>
  );
};
