import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fontFamily } from '../fonts';

export const TrustGraphNode: React.FC<{
  cx: number;
  cy: number;
  radius: number;
  label: string;
  sublabel?: string;
  fillColor: string;
  strokeColor: string;
  labelColor: string;
  /** scene-local frame where the fade/scale begins */
  startFrame: number;
  /** scene-local frame where the fade/scale completes */
  endFrame: number;
  /** target scale at endFrame (default 1) — node 2.4 settles past 1.0 */
  toScale?: number;
  /** scene-local "current" frame from the parent (so timing is composable) */
  frame: number;
}> = ({
  cx,
  cy,
  radius,
  label,
  sublabel,
  fillColor,
  strokeColor,
  labelColor,
  startFrame,
  endFrame,
  toScale = 1,
  frame,
}) => {
  const opacity = interpolate(
    frame,
    [startFrame, endFrame],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const scale = interpolate(
    frame,
    [startFrame, endFrame],
    [0.7, toScale],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const size = radius * 2;

  return (
    <div
      style={{
        position: 'absolute',
        left: cx - radius,
        top: cy - radius,
        width: size,
        height: size + 80,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center top',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: fillColor,
          border: `3px solid ${strokeColor}`,
          boxShadow: '0 8px 24px rgba(65, 45, 25, 0.10)',
        }}
      />
      <div
        style={{
          marginTop: 12,
          fontFamily: fontFamily.inter,
          fontWeight: 800,
          fontSize: sublabel ? 24 : 22,
          color: labelColor,
          textAlign: 'center',
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      {sublabel ? (
        <div
          style={{
            marginTop: 4,
            fontFamily: fontFamily.inter,
            fontWeight: 700,
            fontSize: 18,
            color: labelColor,
            opacity: 0.65,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
          }}
        >
          {sublabel}
        </div>
      ) : null}
    </div>
  );
};

// helper exports for the parent to compute connector endpoints
export const useSpringScale = (
  startFrame: number,
  fromScale: number,
  toScale: number,
) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - startFrame,
    fps,
    from: fromScale,
    to: toScale,
    config: { damping: 200 },
  });
};
