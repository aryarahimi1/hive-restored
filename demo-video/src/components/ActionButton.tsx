import React from 'react';
import { interpolate, Easing } from 'remotion';
import { fontFamily } from '../fonts';
import { tokens } from '../theme';

type Variant = 'walnut' | 'amber' | 'outline';

export const ActionButton: React.FC<{
  label: string;
  variant: Variant;
  top: number;
  left: number;
  width: number;
  height: number;
  /** scene-local current frame */
  frame: number;
  startFrame: number;
  endFrame: number;
  /** when set, overlay a darker fill from this frame range */
  pressFrames?: [number, number];
  /** when set, draw a glowing selection ring */
  selectionFrames?: [number, number];
  /** when set, animate a check stroke between these scene-local frames */
  checkmarkFrames?: [number, number];
}> = ({
  label,
  variant,
  top,
  left,
  width,
  height,
  frame,
  startFrame,
  endFrame,
  pressFrames,
  selectionFrames,
  checkmarkFrames,
}) => {
  const bg =
    variant === 'walnut'
      ? tokens.bg.walnut
      : variant === 'amber'
      ? tokens.accent.amber
      : tokens.bg.creamAlt;
  const fg =
    variant === 'outline' ? tokens.text.ink : tokens.text.onDark;
  const border =
    variant === 'outline' ? `2px solid ${tokens.border.warm}` : 'none';

  const opacity = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ty = interpolate(frame, [startFrame, endFrame], [32, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const pressOpacity = pressFrames
    ? interpolate(frame, pressFrames, [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  const selectionOpacity = selectionFrames
    ? interpolate(frame, selectionFrames, [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  // Check path: stroke-dashoffset draw.
  const checkProgress = checkmarkFrames
    ? interpolate(frame, checkmarkFrames, [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
    : 0;
  const checkPathLength = 80;

  return (
    <>
      {selectionFrames ? (
        <div
          style={{
            position: 'absolute',
            top: top - 8,
            left: left - 8,
            width: width + 16,
            height: height + 16,
            borderRadius: 36,
            border: `4px solid ${tokens.accent.amberHot}`,
            opacity: selectionOpacity,
            pointerEvents: 'none',
            boxShadow: `0 0 24px ${tokens.accent.amberHot}55`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          top,
          left,
          width,
          height,
          borderRadius: 32,
          background: bg,
          border,
          color: fg,
          opacity,
          transform: `translateY(${ty}px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: fontFamily.inter,
          fontWeight: 900,
          fontSize: 28,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          boxShadow:
            variant === 'outline'
              ? 'none'
              : '0 12px 32px rgba(65,45,25,0.18)',
        }}
      >
        {/* press-darken overlay */}
        {pressFrames ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 32,
              background: tokens.accent.amberHot,
              opacity: pressOpacity,
            }}
          />
        ) : null}
        <span style={{ position: 'relative', zIndex: 2 }}>{label}</span>
        {checkmarkFrames ? (
          <svg
            width={80}
            height={80}
            viewBox="0 0 80 80"
            style={{
              position: 'absolute',
              top: (height - 80) / 2,
              left: (width - 80) / 2,
              zIndex: 3,
              opacity: checkProgress > 0 ? 1 : 0,
            }}
          >
            <path
              d="M 25 42 L 38 55 L 60 28"
              stroke={tokens.text.onDark}
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={checkPathLength}
              strokeDashoffset={checkPathLength * (1 - checkProgress)}
            />
          </svg>
        ) : null}
      </div>
    </>
  );
};
