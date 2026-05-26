import { interpolate, useCurrentFrame } from 'remotion';

/**
 * usePressFeedback — physical "press" feedback for any clickable mock
 * element. Drives a tight scale wobble (1 → 0.97 → 1.02 → 1) and a glow
 * intensity envelope (0 → 1 → 0) anchored at `clickAt` (scene-local
 * frame).
 *
 * Pass the returned `scale` into a `transform: scale(...)` and use
 * `glow` to drive a box-shadow ring intensity (multiply through a base
 * ring spread / colour-alpha).
 *
 * Returns `{ scale: 1, glow: 0 }` when `clickAt` is `undefined` so it
 * is safe to wire optionally on any component.
 */
export function usePressFeedback(clickAt: number | undefined): {
  scale: number;
  glow: number;
} {
  const frame = useCurrentFrame();

  if (typeof clickAt !== 'number') {
    return { scale: 1, glow: 0 };
  }

  // Tight press-and-release. Pre-frame settles inward (0.97), then a
  // small overshoot (1.02), then settle back to 1.0 over ~7 frames.
  const scale = interpolate(
    frame,
    [clickAt - 1, clickAt + 1, clickAt + 3, clickAt + 6],
    [1, 0.97, 1.02, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  // Glow envelope: starts ramping 3f before click, peaks just after,
  // and fully releases by frame +10.
  const glow = interpolate(
    frame,
    [clickAt - 3, clickAt + 1, clickAt + 10],
    [0, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  return { scale, glow };
}
