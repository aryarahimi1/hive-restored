import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

/**
 * TypingText — a typewriter effect. Renders a prefix of `text` whose length
 * is `floor((frame - startFrame) * cps / fps)` so it ticks at `cps` chars
 * per second. Default 8 cps ≈ 3.75 chars per frame at 30fps.
 */
export const TypingText: React.FC<{
  text: string;
  /** scene-local frame at which the first character appears */
  startFrame: number;
  /** characters per second, default 24 (≈ 0.8 cps at 30fps in the spec's units) */
  cps?: number;
  /** show a blinking caret at the tail */
  caret?: boolean;
  style?: React.CSSProperties;
}> = ({ text, startFrame, cps = 24, caret = true, style }) => {
  const frame = useCurrentFrame();

  const ratio = interpolate(
    frame,
    [startFrame, startFrame + (text.length / cps) * 30],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  const visibleCount = Math.floor(ratio * text.length);
  const sliced = text.slice(0, visibleCount);

  // Caret blinks every 24 frames (~0.8 Hz) while typing is in progress.
  const showCaret = caret && Math.floor((frame - startFrame) / 12) % 2 === 0;

  return (
    <span style={style}>
      {sliced}
      {showCaret ? (
        <span
          style={{
            display: 'inline-block',
            width: 2,
            height: '0.9em',
            marginLeft: 2,
            background: 'currentColor',
            verticalAlign: 'middle',
          }}
        />
      ) : null}
    </span>
  );
};
