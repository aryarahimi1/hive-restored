import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';

export type StatusKey = 'setup_needed' | 'ready' | 'polling';

const COPY: Record<StatusKey, { label: string; detail: string }> = {
  setup_needed: {
    label: 'Setup needed',
    detail:
      'Add at least one trusted peer subreddit to start federation polling.',
  },
  ready: {
    label: 'Ready to poll',
    detail:
      'Trusted peers are configured. Scheduled polling can index threats.',
  },
  polling: {
    label: 'Federation active',
    detail:
      'Hive is polling trusted peers and indexing incoming threat records.',
  },
};

/**
 * MockStatusPill — the dark panel on the right side of the dashboard
 * header. A status timeline drives label changes: at each transition
 * frame, the label crossfades to the next status over 12f centred on
 * that frame. The first entry is the initial state at scene frame 0.
 */
export const MockStatusPill: React.FC<{
  /** Single status, no transitions. */
  state?: StatusKey;
  /** OR a timeline: [{at: 0, state: 'setup_needed'}, {at: 210, state: 'ready'}, ...]. */
  timeline?: Array<{ at: number; state: StatusKey }>;
  width?: number;
}> = ({ state, timeline, width = 380 }) => {
  const frame = useCurrentFrame();

  // Build effective timeline.
  const tl = timeline ?? (state ? [{ at: 0, state }] : []);
  if (tl.length === 0) return null;

  // Find the segment we're in.
  // For each adjacent pair (a -> b at b.at), crossfade over [b.at - 6, b.at + 6].
  let leftKey: StatusKey | undefined;
  let rightKey: StatusKey = tl[0]!.state;
  let progress = 1;

  for (let i = 1; i < tl.length; i++) {
    const next = tl[i]!;
    if (frame < next.at - 6) {
      break;
    }
    if (frame <= next.at + 6) {
      leftKey = tl[i - 1]!.state;
      rightKey = next.state;
      progress = interpolate(
        frame,
        [next.at - 6, next.at + 6],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );
      break;
    }
    // We've passed this transition fully.
    rightKey = next.state;
    progress = 1;
    leftKey = undefined;
  }

  // Ambient pulse when fully in 'polling' state.
  const pulse =
    rightKey === 'polling' && !leftKey
      ? 0.94 + 0.06 * (0.5 + 0.5 * Math.sin((frame / 60) * Math.PI * 2))
      : 1;

  const right = COPY[rightKey];
  const left = leftKey ? COPY[leftKey] : null;

  return (
    <div
      style={{
        width,
        borderRadius: 28,
        background: tokens.bg.walnut,
        color: tokens.text.onDark,
        padding: '20px 22px',
        opacity: pulse,
        boxShadow: '0 14px 38px rgba(20,12,6,0.35)',
        position: 'relative',
      }}
    >
      <div
        style={{
          fontFamily: fontFamily.inter,
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: tokens.text.onDarkLabel,
        }}
      >
        Status
      </div>

      <div style={{ position: 'relative', marginTop: 10, minHeight: 40 }}>
        {left ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              fontFamily: fontFamily.inter,
              fontWeight: 900,
              fontSize: 32,
              letterSpacing: '-0.03em',
              opacity: 1 - progress,
            }}
          >
            {left.label}
          </div>
        ) : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            fontFamily: fontFamily.inter,
            fontWeight: 900,
            fontSize: 32,
            letterSpacing: '-0.03em',
            opacity: progress,
          }}
        >
          {right.label}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 14, minHeight: 48 }}>
        {left ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              fontFamily: fontFamily.inter,
              fontSize: 15,
              lineHeight: 1.35,
              color: tokens.text.onDarkDim,
              opacity: 1 - progress,
            }}
          >
            {left.detail}
          </div>
        ) : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            fontFamily: fontFamily.inter,
            fontSize: 15,
            lineHeight: 1.35,
            color: tokens.text.onDarkDim,
            opacity: progress,
          }}
        >
          {right.detail}
        </div>
      </div>
    </div>
  );
};
