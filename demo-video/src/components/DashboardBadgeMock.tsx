import React from 'react';
import { fontFamily } from '../fonts';
import { tokens } from '../theme';

/**
 * Small modqueue chip used inside scene 3.
 * For the large scene 4 card we render the badge contents inline rather than
 * via this mock (the layout is too specific to bake in). This component
 * therefore only renders the 'small' pill form.
 */
export const DashboardBadgeMock: React.FC<{
  score: number;
  similarity?: number;
  matchedSub?: string;
  size?: 'small' | 'large';
  /** opacity from parent (for fade-in control) */
  opacity?: number;
  /** y translation (for slideUp) */
  translateY?: number;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
}> = ({
  score,
  size = 'small',
  opacity = 1,
  translateY = 0,
  top,
  left,
  width,
  height,
}) => {
  const isLarge = size === 'large';
  const w = width ?? (isLarge ? 280 : 170);
  const h = height ?? (isLarge ? 64 : 46);

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width: w,
        height: h,
        borderRadius: 999,
        background: tokens.bg.walnut,
        color: tokens.text.onDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity,
        transform: `translateY(${translateY}px)`,
        boxShadow: '0 6px 18px rgba(65,45,25,0.18)',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: tokens.accent.amber,
          boxShadow: `0 0 0 4px ${tokens.accent.amber}26`,
        }}
      />
      <div
        style={{
          fontFamily: fontFamily.inter,
          fontWeight: 900,
          fontSize: isLarge ? 26 : 20,
          letterSpacing: '-0.02em',
        }}
      >
        Hive · {score}%
      </div>
    </div>
  );
};
