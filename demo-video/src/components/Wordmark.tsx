import React from 'react';
import { Easing, interpolate } from 'remotion';
import { fontFamily } from '../fonts';
import { tokens } from '../theme';

export const Wordmark: React.FC<{
  primaryText: string;
  accentText: string;
  accentColor: string;
  tagline: string;
  subcreditA: string;
  subcreditB: string;
  /** scene-local current frame */
  frame: number;
}> = ({
  primaryText,
  accentText,
  accentColor,
  tagline,
  subcreditA,
  subcreditB,
  frame,
}) => {
  const fade = (from: number, to: number) =>
    interpolate(frame, [from, to], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  const slide = (from: number, to: number, dist = 32) =>
    interpolate(frame, [from, to], [dist, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
      }}
    >
      {/* title line */}
      <div
        style={{
          fontFamily: fontFamily.anton,
          fontWeight: 400,
          fontSize: 200,
          lineHeight: 0.95,
          letterSpacing: '-0.02em',
          display: 'flex',
          gap: 30,
          marginBottom: 40,
          transform: `translateY(${-90 + slide(30, 75)}px)`,
        }}
      >
        <span
          style={{
            color: tokens.text.onDark,
            opacity: fade(30, 75),
          }}
        >
          {primaryText}
        </span>
        <span
          style={{
            color: accentColor,
            opacity: fade(60, 105),
            transform: `translateY(${slide(60, 105) - slide(30, 75)}px)`,
          }}
        >
          {accentText}
        </span>
      </div>

      {/* hex accent */}
      <svg
        width={36}
        height={42}
        viewBox="0 0 36 42"
        style={{
          opacity: fade(90, 120),
          marginTop: -10,
        }}
      >
        <polygon
          points="18,2 33,11 33,31 18,40 3,31 3,11"
          fill="none"
          stroke={accentColor}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </svg>

      {/* tagline */}
      <div
        style={{
          marginTop: 30,
          fontFamily: fontFamily.inter,
          fontWeight: 700,
          fontSize: 56,
          color: tokens.text.onDarkDim,
          letterSpacing: '-0.02em',
          opacity: fade(120, 150),
          textAlign: 'center',
        }}
      >
        {tagline}
      </div>

      {/* subcredits */}
      <div
        style={{
          marginTop: 80,
          fontFamily: fontFamily.inter,
          fontWeight: 700,
          fontSize: 36,
          color: tokens.text.onDarkLabel,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          opacity: fade(165, 195),
          textAlign: 'center',
        }}
      >
        {subcreditA}
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: fontFamily.inter,
          fontWeight: 800,
          fontSize: 32,
          color: tokens.text.onDarkDim,
          letterSpacing: '-0.01em',
          opacity: fade(195, 225),
          textAlign: 'center',
        }}
      >
        {subcreditB}
      </div>
    </div>
  );
};
