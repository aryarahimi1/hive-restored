import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { fontFamily } from '../fonts';

type CaptionPosition =
  | { kind: 'bottom'; bottom: number }
  | { kind: 'top'; top: number }
  | { kind: 'center' };

/**
 * `pill`  → dark semi-transparent rounded background behind the text. The
 *           default. Always legible, no matter what's behind.
 * `solid` → fully-opaque dark background (use for hero overlays).
 * `naked` → no background. Use ONLY when the scene background is already
 *           guaranteed high-contrast for this color.
 */
export type CaptionVariant = 'pill' | 'solid' | 'naked';

export type CaptionProps = {
  text: string;
  fontSize: number;
  fontWeight: number | string;
  color: string;
  position: CaptionPosition;
  /**
   * All frames are SCENE-LOCAL (frame 0 = scene start). The parent scene
   * subtracts the Sequence's `from` before passing the current frame.
   */
  fadeIn: [number, number];
  hold: number;
  fadeOut: [number, number];
  maxWidth?: number;
  fontStack?: 'inter' | 'anton';
  uppercase?: boolean;
  tracking?: string;
  lineHeight?: number;
  /** Default `pill`. */
  variant?: CaptionVariant;
  /** Override pill background. Defaults to a dark walnut at 85% opacity. */
  pillBackground?: string;
};

export const Caption: React.FC<CaptionProps> = ({
  text,
  fontSize,
  fontWeight,
  color,
  position,
  fadeIn,
  hold,
  fadeOut,
  maxWidth,
  fontStack = 'inter',
  uppercase = false,
  tracking,
  lineHeight = 1.1,
  variant = 'pill',
  pillBackground,
}) => {
  const frame = useCurrentFrame();

  // Opacity envelope: fadeIn[0] → fadeIn[1] climbs 0→1, holds until fadeOut[0],
  // then drops to 0 by fadeOut[1].
  const opacity = interpolate(
    frame,
    [fadeIn[0], fadeIn[1], fadeOut[0], fadeOut[1]],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    },
  );

  // Suppress hold linter-only param.
  void hold;

  const positionStyle: React.CSSProperties =
    position.kind === 'bottom'
      ? {
          position: 'absolute',
          bottom: position.bottom,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }
      : position.kind === 'top'
      ? {
          position: 'absolute',
          top: position.top,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }
      : {
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        };

  // Pill chrome — only present for `pill`/`solid`. Defaults to walnut at 85%.
  const isNaked = variant === 'naked';
  const pillStyle: React.CSSProperties = isNaked
    ? {}
    : {
        background:
          pillBackground ??
          (variant === 'solid'
            ? 'oklch(0.2 0.04 58 / 0.96)'
            : 'oklch(0.2 0.04 58 / 0.85)'),
        backdropFilter: variant === 'pill' ? 'blur(14px)' : undefined,
        WebkitBackdropFilter: variant === 'pill' ? 'blur(14px)' : undefined,
        padding: '18px 40px',
        borderRadius: 999,
        boxShadow: '0 18px 48px rgba(20, 12, 6, 0.35)',
        border: '1px solid oklch(0.32 0.04 58 / 0.55)',
      };

  return (
    <AbsoluteFill style={{ zIndex: 10, pointerEvents: 'none' }}>
      <div style={{ ...positionStyle, opacity }}>
        <div style={{ ...pillStyle, maxWidth: maxWidth ?? 1500 }}>
          <div
            style={{
              fontFamily:
                fontStack === 'anton' ? fontFamily.anton : fontFamily.inter,
              fontWeight,
              fontSize,
              color,
              lineHeight,
              letterSpacing: tracking ?? '-0.02em',
              textTransform: uppercase ? 'uppercase' : 'none',
              textAlign: 'center',
              textShadow: isNaked
                ? undefined
                : '0 2px 16px rgba(0, 0, 0, 0.45)',
            }}
          >
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
