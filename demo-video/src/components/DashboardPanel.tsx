import React from 'react';
import { interpolate } from 'remotion';
import { panelShadow, tokens } from '../theme';

export const DashboardPanel: React.FC<{
  top: number;
  left: number;
  width: number;
  height: number;
  fillColor?: string;
  strokeColor?: string;
  shadow?: string;
  /** scene-local frame */
  frame: number;
  fadeFrom: number;
  fadeTo: number;
  /** extra slide-up in px from below */
  slideDistance?: number;
  children?: React.ReactNode;
  /** optional zoom transform applied (used by scene 3 → 4 hand-off) */
  scale?: number;
  scaleOrigin?: string;
  opacityOverride?: number;
}> = ({
  top,
  left,
  width,
  height,
  fillColor = tokens.bg.creamBright,
  strokeColor = tokens.border.warm,
  shadow = panelShadow,
  frame,
  fadeFrom,
  fadeTo,
  slideDistance = 0,
  children,
  scale = 1,
  scaleOrigin = 'center center',
  opacityOverride,
}) => {
  const baseOpacity = interpolate(frame, [fadeFrom, fadeTo], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = opacityOverride ?? baseOpacity;
  const ty = interpolate(frame, [fadeFrom, fadeTo], [slideDistance, 0], {
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
        height,
        borderRadius: 32,
        background: fillColor,
        border: `2px solid ${strokeColor}`,
        boxShadow: shadow,
        opacity,
        transform: `translateY(${ty}px) scale(${scale})`,
        transformOrigin: scaleOrigin,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};
