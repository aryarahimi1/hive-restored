import React from 'react';
import { Easing, interpolate } from 'remotion';

type Point = { x: number; y: number };

export const Connector: React.FC<{
  start: Point;
  end: Point;
  /** when true, render a quadratic Bezier with a control point */
  curve?: { control: Point };
  strokeColor: string;
  strokeWidth: number;
  /** scene-local frames between which the line draws */
  drawFrom: number;
  drawTo: number;
  /** parent passes its current scene-local frame */
  frame: number;
  arrowhead?: boolean;
  /** optional fade-out window (scene-local) */
  fadeOut?: [number, number];
}> = ({
  start,
  end,
  curve,
  strokeColor,
  strokeWidth,
  drawFrom,
  drawTo,
  frame,
  arrowhead = false,
  fadeOut,
}) => {
  // Path string
  const d = curve
    ? `M ${start.x} ${start.y} Q ${curve.control.x} ${curve.control.y} ${end.x} ${end.y}`
    : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

  // Approximate path length for the dashoffset animation.
  // For a straight line we can compute exactly; for a quadratic we approximate
  // by sampling.
  const pathLength = (() => {
    if (!curve) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    let len = 0;
    let prev = start;
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const px =
        mt * mt * start.x +
        2 * mt * t * curve.control.x +
        t * t * end.x;
      const py =
        mt * mt * start.y +
        2 * mt * t * curve.control.y +
        t * t * end.y;
      const dx = px - prev.x;
      const dy = py - prev.y;
      len += Math.sqrt(dx * dx + dy * dy);
      prev = { x: px, y: py };
    }
    return len;
  })();

  const progress = interpolate(frame, [drawFrom, drawTo], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const dashOffset = pathLength * (1 - progress);

  const opacity = fadeOut
    ? interpolate(frame, [fadeOut[0], fadeOut[1]], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  // Arrowhead at the path endpoint — compute tangent for orientation.
  let arrow: React.ReactNode = null;
  if (arrowhead && progress > 0.9) {
    const tangent = (() => {
      if (!curve) {
        return Math.atan2(end.y - start.y, end.x - start.x);
      }
      // derivative of quadratic Bezier at t=1
      const dx = 2 * (end.x - curve.control.x);
      const dy = 2 * (end.y - curve.control.y);
      return Math.atan2(dy, dx);
    })();
    const arrowSize = 22;
    const ax = end.x;
    const ay = end.y;
    const deg = (tangent * 180) / Math.PI;
    arrow = (
      <g transform={`translate(${ax}, ${ay}) rotate(${deg})`}>
        <polygon
          points={`0,0 -${arrowSize},-${arrowSize / 2} -${arrowSize},${arrowSize / 2}`}
          fill={strokeColor}
          opacity={interpolate(frame, [drawTo - 10, drawTo], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}
        />
      </g>
    );
  }

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity,
        pointerEvents: 'none',
      }}
      viewBox="0 0 1920 1080"
      preserveAspectRatio="none"
    >
      <path
        d={d}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
      />
      {arrow}
    </svg>
  );
};
