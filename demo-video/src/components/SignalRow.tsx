import React from 'react';
import { interpolate } from 'remotion';
import { fontFamily } from '../fonts';
import { tokens } from '../theme';

export const SignalRow: React.FC<{
  label: string;
  hashLabel: string;
  iconColor?: string;
  top: number;
  left: number;
  width: number;
  /** scene-local frame */
  frame: number;
  startFrame: number;
  endFrame: number;
}> = ({
  label,
  hashLabel,
  iconColor = tokens.accent.amber,
  top,
  left,
  width,
  frame,
  startFrame,
  endFrame,
}) => {
  const opacity = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tx = interpolate(frame, [startFrame, endFrame], [-24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        opacity,
        transform: `translateX(${tx}px)`,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: iconColor,
          flexShrink: 0,
          boxShadow: `0 0 0 4px ${iconColor}26`,
        }}
      />
      <div
        style={{
          fontFamily: fontFamily.inter,
          fontWeight: 800,
          fontSize: 32,
          color: tokens.text.ink,
          letterSpacing: '-0.02em',
          flex: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontWeight: 700,
          fontSize: 22,
          color: tokens.text.muted,
          background: tokens.bg.creamAlt,
          border: `1px solid ${tokens.border.warm}`,
          borderRadius: 999,
          padding: '8px 18px',
          letterSpacing: '0.02em',
        }}
      >
        {hashLabel}
      </div>
    </div>
  );
};
