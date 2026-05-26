import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';
import { usePressFeedback } from './usePressFeedback';

/**
 * MockActionLogEntry — mirrors src/client/game.tsx ActionRow. Optional
 * confirming-mode morphs the Undo button into a Confirm/Cancel cluster.
 */
export const MockActionLogEntry: React.FC<{
  title: string;
  detail: string;
  relativeTime: string;
  type: 'Mod' | 'Peer' | 'System';
  showUndo?: boolean;
  /** Frame at which the row first appears (fade-in). */
  enterFrame?: number;
  /** Frame at which Undo morphs into Confirm/Cancel. */
  confirmFrame?: number;
  /** Frame at which the entire row collapses out. */
  collapseFrame?: number;
  /** Optional press-feedback anchor for the Undo button. */
  undoClickFrame?: number;
  /** Optional press-feedback anchor for the Confirm button. */
  confirmClickFrame?: number;
}> = ({
  title,
  detail,
  relativeTime,
  type,
  showUndo = false,
  enterFrame = 0,
  confirmFrame,
  collapseFrame,
  undoClickFrame,
  confirmClickFrame,
}) => {
  const frame = useCurrentFrame();
  const undoPress = usePressFeedback(undoClickFrame);
  const confirmPress = usePressFeedback(confirmClickFrame);

  const enterOpacity = interpolate(
    frame,
    [enterFrame, enterFrame + 12],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  const collapse =
    typeof collapseFrame === 'number'
      ? interpolate(
          frame,
          [collapseFrame, collapseFrame + 18],
          [1, 0],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          },
        )
      : 1;

  const opacity = enterOpacity * collapse;
  const scaleY = collapse;

  // Morph between Undo (opacity 1→0) and Confirm/Cancel (0→1) over 12f.
  const confirmProgress =
    typeof confirmFrame === 'number'
      ? interpolate(
          frame,
          [confirmFrame, confirmFrame + 12],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )
      : 0;

  return (
    <article
      style={{
        borderRadius: 24,
        background: tokens.bg.creamAlt,
        padding: '16px 20px',
        opacity,
        transform: `scaleY(${scaleY})`,
        transformOrigin: 'top center',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            borderRadius: 999,
            background: 'oklch(0.88 0.04 68)',
            color: 'oklch(0.36 0.055 55)',
            padding: '4px 12px',
            fontFamily: fontFamily.inter,
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: '0.04em',
          }}
        >
          {type}
        </div>
        <div
          style={{
            fontFamily: fontFamily.inter,
            fontWeight: 700,
            fontSize: 12,
            color: tokens.text.softMuted,
          }}
        >
          {relativeTime}
        </div>
      </div>
      <h3
        style={{
          margin: 0,
          fontFamily: fontFamily.inter,
          fontWeight: 900,
          fontSize: 19,
          letterSpacing: '-0.03em',
          color: tokens.text.ink,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          fontFamily: fontFamily.inter,
          fontSize: 14,
          lineHeight: 1.4,
          color: 'oklch(0.4 0.03 62)',
        }}
      >
        {detail}
      </p>

      {showUndo ? (
        <div
          style={{
            position: 'relative',
            marginTop: 6,
            height: 32,
            width: 230,
          }}
        >
          {/* Undo button */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              opacity: 1 - confirmProgress,
              borderRadius: 999,
              border: '2px solid oklch(0.78 0.035 62)',
              padding: '6px 16px',
              fontFamily: fontFamily.inter,
              fontWeight: 900,
              fontSize: 12,
              color: 'oklch(0.42 0.04 52)',
              transform: `scale(${undoPress.scale})`,
              transformOrigin: 'center center',
              boxShadow:
                undoPress.glow > 0.01
                  ? `0 0 0 ${undoPress.glow * 6}px oklch(0.58 0.17 39 / ${undoPress.glow * 0.22})`
                  : undefined,
            }}
          >
            Undo
          </div>

          {/* Confirm/Cancel cluster */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              opacity: confirmProgress,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: fontFamily.inter,
                fontWeight: 700,
                fontSize: 12,
                color: 'oklch(0.42 0.04 52)',
              }}
            >
              Remove?
            </span>
            <div
              style={{
                borderRadius: 999,
                background: tokens.accent.amber,
                color: tokens.text.onDark,
                padding: '6px 14px',
                fontFamily: fontFamily.inter,
                fontWeight: 900,
                fontSize: 12,
                transform: `scale(${confirmPress.scale})`,
                transformOrigin: 'center center',
                boxShadow:
                  confirmPress.glow > 0.01
                    ? `0 0 0 ${confirmPress.glow * 6}px oklch(0.58 0.17 39 / ${confirmPress.glow * 0.28})`
                    : undefined,
              }}
            >
              Confirm
            </div>
            <div
              style={{
                borderRadius: 999,
                border: '2px solid oklch(0.78 0.035 62)',
                padding: '6px 14px',
                fontFamily: fontFamily.inter,
                fontWeight: 900,
                fontSize: 12,
                color: 'oklch(0.42 0.04 52)',
              }}
            >
              Cancel
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
};
