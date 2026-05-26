import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type Pt = { x: number; y: number };

/**
 * Waypoint definition. The cursor sits at `at` from the previous waypoint's
 * arrival frame until `arriveAt`, then tweens to the new position. The first
 * waypoint in the list is the starting position (its `arriveAt` is the
 * scene-local frame at which the cursor "exists" at that position).
 */
export type CursorWaypoint = {
  at: Pt;
  arriveAt: number;
  /** Optional click-ripple frame anchored at this waypoint. */
  click?: number;
  /** Optional hover-wobble starting frame at this waypoint. */
  hover?: number;
  hoverFrames?: number;
};

export type CursorProps = {
  /** Path of waypoints. Length ≥ 1. */
  path: CursorWaypoint[];
  /** Override opacity (0–1) — used by scene 9 to fade the cursor out. */
  opacity?: number;
  /** Optional fade-out window: cursor opacity drops to 0 over these frames. */
  fadeOut?: [number, number];
  /** Optional explicit z-index. Defaults very high. */
  zIndex?: number;
};

/** Deterministic hash → [-1, 1] for stable per-segment "randomness". */
function segSign(i: number): number {
  // simple integer hash, alternating sign-ish behaviour
  const h = Math.sin(i * 12.9898) * 43758.5453;
  const f = h - Math.floor(h);
  return f < 0.5 ? -1 : 1;
}

/** Quadratic bezier evaluator. */
function qbezier(t: number, p0: number, c: number, p1: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * c + t * t * p1;
}

/**
 * Cursor — macOS-style arrow tweens between an arbitrary number of waypoints.
 *
 * Realism touches:
 *   - canonical macOS arrow shape (tip at SVG 0,0)
 *   - bezier curved path between waypoints (not straight)
 *   - ease-out timing with a tiny spring overshoot near the target
 *   - automatic 7-frame settle/hover before any click event
 *   - subtle two-ring click ripple + a 3-frame "press" scale
 *   - micro-jitter when idle for >30 frames
 */
export const Cursor: React.FC<CursorProps> = ({
  path,
  opacity = 1,
  fadeOut,
  zIndex = 9999,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Snappy ease-out: accelerate from rest, decelerate hard into target.
  const easeOut = Easing.bezier(0.16, 0.84, 0.4, 1);

  if (path.length === 0) return null;

  // Determine current segment and progress.
  let x = path[0]!.at.x;
  let y = path[0]!.at.y;
  let lastArriveAt = path[0]!.arriveAt;
  let inMotion = false;

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const cur = path[i]!;
    if (frame >= cur.arriveAt) {
      x = cur.at.x;
      y = cur.at.y;
      lastArriveAt = cur.arriveAt;
    } else if (frame >= prev.arriveAt) {
      inMotion = true;
      const segLen = Math.max(1, cur.arriveAt - prev.arriveAt);
      const tRaw = (frame - prev.arriveAt) / segLen;
      const t = easeOut(Math.min(1, Math.max(0, tRaw)));

      // Quadratic bezier with a perpendicular offset on the midpoint.
      const dx = cur.at.x - prev.at.x;
      const dy = cur.at.y - prev.at.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // perpendicular unit vector
      const px = dist > 0.001 ? -dy / dist : 0;
      const py = dist > 0.001 ? dx / dist : 0;
      // 18% of segment length, sign varies deterministically per segment
      const curve = dist * 0.18 * segSign(i);
      const cx = (prev.at.x + cur.at.x) / 2 + px * curve;
      const cy = (prev.at.y + cur.at.y) / 2 + py * curve;

      x = qbezier(t, prev.at.x, cx, cur.at.x);
      y = qbezier(t, prev.at.y, cy, cur.at.y);

      // Subtle overshoot + settle on the final ~10 frames of the segment.
      // Push 3px past the target in motion direction, then spring back.
      const settleFrames = 10;
      const settleStart = cur.arriveAt - settleFrames;
      if (frame >= settleStart && dist > 2) {
        const s = spring({
          frame: frame - settleStart,
          fps,
          config: { damping: 14, stiffness: 180, mass: 0.5 },
        });
        // direction unit vector toward target
        const ux = dx / dist;
        const uy = dy / dist;
        // overshoot magnitude: peaks at ~3px then settles to 0
        // s rises 0 → 1; we want a small bump that decays. Use s*(1-s)*4 as a 0→peak→0 envelope.
        const env = s * (1 - s) * 4;
        const overshoot = 3 * env;
        x += ux * overshoot;
        y += uy * overshoot;
      }
      lastArriveAt = prev.arriveAt;
      break;
    }
  }

  // Idle micro-jitter when stationary for >30 frames.
  const idleFrames = frame - lastArriveAt;
  const jitterX = !inMotion && idleFrames > 30 ? Math.sin(frame * 0.13) * 0.8 : 0;
  const jitterY = !inMotion && idleFrames > 30 ? Math.cos(frame * 0.11) * 0.6 : 0;

  // Hover wobble at any waypoint whose hover window covers current frame.
  let wobbleY = 0;
  for (const wp of path) {
    if (typeof wp.hover === 'number') {
      const dur = wp.hoverFrames ?? 8;
      if (frame >= wp.hover && frame <= wp.hover + dur) {
        const t = (frame - wp.hover) / Math.max(1, dur);
        wobbleY = Math.sin(t * Math.PI * 2) * 1.4;
      }
    }
  }

  // ---- Click handling ----
  // Auto-shift each click to be at least arriveAt + 7 frames (3-frame settle
  // + 4-frame hover pause) so the cursor is visibly STILL on target first.
  type EffClick = { frame: number; at: Pt };
  const effClicks: EffClick[] = [];
  for (const wp of path) {
    if (typeof wp.click === 'number') {
      const effFrame = Math.max(wp.click, wp.arriveAt + 7);
      effClicks.push({ frame: effFrame, at: wp.at });
    }
  }

  // Build ripple state: two concentric rings + a cursor press scale.
  let innerRipple: { opacity: number; size: number; at: Pt } | null = null;
  let outerRipple: { opacity: number; size: number; at: Pt } | null = null;
  let pressScale = 1;
  for (const c of effClicks) {
    // Cursor "press" — scale 0.92 for 3 frames starting at click.
    if (frame >= c.frame && frame <= c.frame + 3) {
      pressScale = 0.92;
    }
    // Inner ring: 8 → 28 px, opacity 0.5 → 0 over 12 frames.
    if (frame >= c.frame && frame <= c.frame + 12) {
      const o = interpolate(frame, [c.frame, c.frame + 12], [0.5, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const s = interpolate(frame, [c.frame, c.frame + 12], [8, 28], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
      innerRipple = { opacity: o, size: s, at: c.at };
    }
    // Outer ring: 12 → 40 px, opacity 0.25 → 0 over 18 frames.
    if (frame >= c.frame && frame <= c.frame + 18) {
      const o = interpolate(frame, [c.frame, c.frame + 18], [0.25, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const s = interpolate(frame, [c.frame, c.frame + 18], [12, 40], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
      outerRipple = { opacity: o, size: s, at: c.at };
    }
  }

  // Optional fade-out
  const fadeOpacity = fadeOut
    ? interpolate(frame, fadeOut, [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const ringColor = 'oklch(0.2 0.04 58)'; // dark walnut, ~50% opacity via ring opacity values

  // Rendered cursor size. Tip lives at SVG (0,0).
  const CURSOR_W = 28;
  const CURSOR_H = 34;

  return (
    <>
      {/* Outer ripple ring */}
      {outerRipple ? (
        <div
          style={{
            position: 'absolute',
            left: outerRipple.at.x - outerRipple.size / 2,
            top: outerRipple.at.y - outerRipple.size / 2,
            width: outerRipple.size,
            height: outerRipple.size,
            borderRadius: '50%',
            border: `1.5px solid ${ringColor}`,
            opacity: outerRipple.opacity,
            zIndex: zIndex - 1,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* Inner ripple ring */}
      {innerRipple ? (
        <div
          style={{
            position: 'absolute',
            left: innerRipple.at.x - innerRipple.size / 2,
            top: innerRipple.at.y - innerRipple.size / 2,
            width: innerRipple.size,
            height: innerRipple.size,
            borderRadius: '50%',
            border: `1.5px solid ${ringColor}`,
            opacity: innerRipple.opacity,
            zIndex: zIndex - 1,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          transform: `translate(${x + jitterX}px, ${y + wobbleY + jitterY}px)`,
          opacity: opacity * fadeOpacity,
          zIndex,
          pointerEvents: 'none',
        }}
      >
        <svg
          width={CURSOR_W}
          height={CURSOR_H}
          viewBox="0 0 24 31"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `scale(${pressScale})`,
            transformOrigin: '0 0',
            filter:
              'drop-shadow(0 1px 2px rgba(0,0,0,0.5)) drop-shadow(0 2px 6px rgba(0,0,0,0.25))',
          }}
        >
          {/* Canonical macOS arrow — tip at (0,0), tall asymmetric tail. */}
          <path
            d="M 0 0 L 0 22 L 5.6 17.2 L 9.2 26.4 L 12.4 25.1 L 8.9 16 L 16.2 16 Z"
            fill="white"
            stroke="black"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </>
  );
};
