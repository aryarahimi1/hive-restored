import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

export type ClickPulseProps = {
  /** The element's centre on the 1920×1080 canvas. */
  at: { x: number; y: number };
  /** Scene-local frame at which the click happens. */
  clickAt: number;
  /** Approximate radius of the target element. Default 40 (most buttons). */
  targetRadius?: number;
  /** Accent colour. Defaults to project amber but is rarely overridden. */
  color?: string;
};

/**
 * ClickPulse — replaces the macOS cursor with two cues:
 *
 *   1. A faint downward chevron above the target on frames `clickAt-4 →
 *      clickAt+4`, so the eye is steered to the right spot.
 *   2. An inner ring fades in at 50% scale during the lead-in
 *      (clickAt-4 → clickAt), then two concentric rings expand outward
 *      from `targetRadius` over frames `clickAt → clickAt+10`.
 *
 * The ring colour is a dark walnut at moderate opacity — reads cleanly
 * on both the cream dashboard and the dark backdrops behind it. Lives
 * in an AbsoluteFill with `pointerEvents: 'none'` and zIndex 9000 so
 * it overlays content but stays below captions (zIndex 10000).
 */
export const ClickPulse: React.FC<ClickPulseProps> = ({
  at,
  clickAt,
  targetRadius = 40,
  color = 'oklch(0.2 0.04 58 / 0.6)',
}) => {
  const frame = useCurrentFrame();

  // ---- Lead-in inner ring (clickAt-4 → clickAt) ----
  // Sits at 50% scale, fades in to give a tiny "about to happen" tell.
  const leadInOpacity = interpolate(
    frame,
    [clickAt - 4, clickAt],
    [0, 0.45],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  // After the click fires, fade the lead-in ring out quickly.
  const leadInFade = interpolate(
    frame,
    [clickAt, clickAt + 4],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  const leadInRadius = targetRadius * 0.5;
  const leadInOp = leadInOpacity * leadInFade;

  // ---- Outward concentric rings (clickAt → clickAt+10) ----
  const innerRadius = interpolate(
    frame,
    [clickAt, clickAt + 10],
    [targetRadius, targetRadius * 1.8],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  const innerOpacity = interpolate(
    frame,
    [clickAt, clickAt + 10],
    [0.55, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  const outerRadius = interpolate(
    frame,
    [clickAt, clickAt + 10],
    [targetRadius, targetRadius * 2.4],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  const outerOpacity = interpolate(
    frame,
    [clickAt, clickAt + 10],
    [0.28, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  // ---- "Look here" chevron above the target ----
  // Visible only on the lead-in frames + 2 settle frames after the click.
  const chevronOpacity = interpolate(
    frame,
    [clickAt - 6, clickAt - 4, clickAt, clickAt + 4],
    [0, 0.85, 0.6, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  // Tiny downward bob so it reads as motion, not a static glyph.
  const chevronBob = interpolate(
    frame,
    [clickAt - 6, clickAt],
    [-4, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    },
  );

  const CHEVRON_SIZE = 14;
  // Place the chevron above the target, with breathing room of
  // ~targetRadius + 10px.
  const chevronTop = at.y - targetRadius - 10 - CHEVRON_SIZE + chevronBob;
  const chevronLeft = at.x - CHEVRON_SIZE / 2;

  // Outside the active window? Render nothing (lets React skip work).
  const visible = frame >= clickAt - 6 && frame <= clickAt + 12;
  if (!visible) return null;

  // Use border-based circles. Drawing with borders keeps the rings
  // crisp at any size and avoids needing inline SVG just for shapes.
  const ringStyle = (
    r: number,
    op: number,
    borderPx: number,
  ): React.CSSProperties => ({
    position: 'absolute',
    left: at.x - r,
    top: at.y - r,
    width: r * 2,
    height: r * 2,
    borderRadius: '50%',
    border: `${borderPx}px solid ${color}`,
    opacity: op,
    pointerEvents: 'none',
    boxSizing: 'border-box',
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 9000 }}>
      {/* Lead-in inner ring (sits before the click fires) */}
      {leadInOp > 0.001 ? <div style={ringStyle(leadInRadius, leadInOp, 2)} /> : null}

      {/* Outward concentric rings */}
      {outerOpacity > 0.001 ? <div style={ringStyle(outerRadius, outerOpacity, 1.75)} /> : null}
      {innerOpacity > 0.001 ? <div style={ringStyle(innerRadius, innerOpacity, 2)} /> : null}

      {/* Look-here chevron */}
      {chevronOpacity > 0.001 ? (
        <svg
          width={CHEVRON_SIZE}
          height={CHEVRON_SIZE}
          viewBox="0 0 14 14"
          style={{
            position: 'absolute',
            left: chevronLeft,
            top: chevronTop,
            opacity: chevronOpacity,
            pointerEvents: 'none',
          }}
        >
          <path
            d="M 2 4 L 7 10 L 12 4"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
