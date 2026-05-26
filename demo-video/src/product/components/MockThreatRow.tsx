import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      borderRadius: 16,
      background: tokens.bg.creamBright,
      padding: '10px 14px',
    }}
  >
    <div
      style={{
        fontFamily: fontFamily.inter,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'oklch(0.52 0.045 62)',
      }}
    >
      {label}
    </div>
    <div
      style={{
        marginTop: 4,
        fontFamily: fontFamily.inter,
        fontWeight: 900,
        fontSize: 15,
        letterSpacing: '-0.02em',
        color: tokens.text.ink,
      }}
    >
      {value}
    </div>
  </div>
);

/**
 * MockThreatRow — mirrors src/client/game.tsx ThreatRow. Composite ticks
 * 0 → target from `enterFrame` to `enterFrame + 30`. Detail expansion
 * uses grid-template-rows 0fr → 1fr over 18 frames at `expandFrame`.
 */
export const MockThreatRow: React.FC<{
  publisherSub: string;
  alertId: string;
  category: string; // displayed title
  composite: number;
  matchedSignal: string;
  publishedAt: string; // "just now"
  ttlAt: string; // "14d"
  enterFrame: number;
  /** Frame at which the row expands to show detail (optional). */
  expandFrame?: number;
}> = ({
  publisherSub,
  alertId,
  category,
  composite,
  matchedSignal,
  publishedAt,
  ttlAt,
  enterFrame,
  expandFrame,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [enterFrame, enterFrame + 24],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  const ty = interpolate(
    frame,
    [enterFrame, enterFrame + 24],
    [10, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  const compositeNow = Math.round(
    interpolate(
      frame,
      [enterFrame, enterFrame + 30],
      [0, composite],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      },
    ),
  );

  // Expansion 0–1.
  const expandProgress =
    typeof expandFrame === 'number'
      ? interpolate(
          frame,
          [expandFrame, expandFrame + 18],
          [0, 1],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          },
        )
      : 0;

  return (
    <article
      style={{
        borderRadius: 28,
        border: `2px solid oklch(0.84 0.035 68)`,
        background: tokens.bg.cream,
        padding: '20px 24px',
        opacity,
        transform: `translateY(${ty}px)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: fontFamily.inter,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'oklch(0.52 0.06 42)',
            }}
          >
            r/{publisherSub} · {alertId.slice(0, 8)}
          </div>
          <h3
            style={{
              margin: '8px 0 0',
              fontFamily: fontFamily.inter,
              fontWeight: 900,
              fontSize: 28,
              letterSpacing: '-0.04em',
              color: tokens.text.ink,
            }}
          >
            {category}
          </h3>
        </div>
        <div
          style={{
            borderRadius: 22,
            background: tokens.bg.walnutWarm,
            color: tokens.text.onDark,
            padding: '12px 22px',
            textAlign: 'right',
            minWidth: 150,
          }}
        >
          <div
            style={{
              fontFamily: fontFamily.inter,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'oklch(0.8 0.04 72)',
            }}
          >
            Composite
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: fontFamily.inter,
              fontWeight: 900,
              fontSize: 36,
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {compositeNow}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        <Fact label="Signals" value={matchedSignal} />
        <Fact label="Published" value={publishedAt} />
        <Fact label="Expires in" value={ttlAt} />
      </div>

      <div
        style={{
          borderRadius: 18,
          background: tokens.bg.creamBright,
          padding: '10px 14px',
          fontFamily: fontFamily.inter,
          fontWeight: 900,
          fontSize: 12,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'oklch(0.42 0.04 52)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{expandProgress > 0.5 ? 'Hide detail' : 'Show detail'}</span>
        <span style={{ fontSize: 16 }}>{expandProgress > 0.5 ? '▲' : '▼'}</span>
      </div>

      {expandProgress > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateRows: '1fr',
            overflow: 'hidden',
            maxHeight: expandProgress * 220,
            opacity: expandProgress,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}
          >
            <Fact label="Matched signal" value={matchedSignal} />
            <Fact label="Similarity" value={`${composite}%`} />
            <Fact label="Publisher" value={`r/${publisherSub}`} />
            <Fact label="Alert ID" value={alertId} />
            <Fact label="TTL" value={`${ttlAt} (federation expires)`} />
          </div>
        </div>
      ) : null}
    </article>
  );
};
