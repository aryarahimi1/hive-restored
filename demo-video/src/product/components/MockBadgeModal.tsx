import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';

type Signal = { name: string; ok: boolean };

/**
 * MockBadgeModal — the modqueue badge popover lifted into a centred
 * modal. Composite donut on the left, signal rows on the right, three
 * action buttons stacked at the bottom.
 */
export const MockBadgeModal: React.FC<{
  username: string;
  composite: number;
  signals: Signal[];
  publisher: string;
  ttl: string;
  /** Frame at which the backdrop + modal enter. */
  enterFrame: number;
  /** Frame at which the modal exits. */
  exitFrame: number;
  /** Frame at which the checkmark draws over the primary CTA. */
  checkmarkFrame?: number;
  /** Frame at which the CTA "presses" (4f compression). */
  pressFrame?: number;
}> = ({
  username,
  composite,
  signals,
  publisher,
  ttl,
  enterFrame,
  exitFrame,
  checkmarkFrame,
  pressFrame,
}) => {
  const frame = useCurrentFrame();

  // Backdrop fade
  const backdropOpacity =
    interpolate(
      frame,
      [enterFrame, enterFrame + 12],
      [0, 0.55],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      },
    ) *
    interpolate(
      frame,
      [exitFrame, exitFrame + 20],
      [1, 0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      },
    );

  // Modal scale+fade
  const inScale = interpolate(
    frame,
    [enterFrame + 2, enterFrame + 16],
    [0.96, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  const outScale = interpolate(
    frame,
    [exitFrame, exitFrame + 20],
    [1, 0.96],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  const inOpacity = interpolate(
    frame,
    [enterFrame + 2, enterFrame + 16],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const outOpacity = interpolate(
    frame,
    [exitFrame, exitFrame + 20],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const modalOpacity = Math.min(inOpacity, outOpacity);

  // Composite ticker 0 → composite over 36 frames starting enterFrame + 20.
  const compositeStart = enterFrame + 20;
  const compositeNow = Math.round(
    interpolate(
      frame,
      [compositeStart, compositeStart + 36],
      [0, composite],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      },
    ),
  );
  // Donut arc length
  const donutFrac = compositeNow / 100;
  const donutCircumference = 2 * Math.PI * 70; // radius 70

  // Signal row stagger.
  const signalsStart = enterFrame + 40;

  // CTA press compression.
  const press =
    typeof pressFrame === 'number'
      ? interpolate(
          frame,
          [pressFrame, pressFrame + 2, pressFrame + 4],
          [0, 1, 0],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          },
        )
      : 0;
  const ctaScale = 1 - press * 0.04;

  // Checkmark draw.
  const checkProgress =
    typeof checkmarkFrame === 'number'
      ? interpolate(
          frame,
          [checkmarkFrame, checkmarkFrame + 24],
          [0, 1],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          },
        )
      : 0;
  const checkLen = 80;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(8, 5, 2, 1)',
          opacity: backdropOpacity,
          zIndex: 50,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 1100,
          height: 540,
          marginLeft: -550,
          marginTop: -270,
          background: tokens.bg.creamBright,
          border: `2px solid ${tokens.border.warm}`,
          borderRadius: 36,
          padding: 40,
          opacity: modalOpacity,
          transform: `scale(${inScale * outScale})`,
          boxShadow: '0 40px 120px rgba(20,12,6,0.55)',
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* Header */}
        <div>
          <div
            style={{
              fontFamily: fontFamily.inter,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: tokens.accent.kraft,
            }}
          >
            Modqueue · Hive
          </div>
          <h2
            style={{
              margin: '10px 0 0',
              fontFamily: fontFamily.inter,
              fontWeight: 900,
              fontSize: 40,
              letterSpacing: '-0.04em',
              color: tokens.text.ink,
            }}
          >
            u/{username}, matched threat
          </h2>
          <p
            style={{
              margin: '6px 0 0',
              fontFamily: fontFamily.inter,
              fontSize: 16,
              color: tokens.text.muted,
            }}
          >
            first seen by r/{publisher} · {ttl} TTL
          </p>
        </div>

        {/* Body grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            gap: 40,
            alignItems: 'center',
            flex: 1,
          }}
        >
          {/* Composite donut */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <svg width={200} height={200} viewBox="0 0 200 200">
              <circle
                cx={100}
                cy={100}
                r={70}
                fill="none"
                stroke={tokens.bg.creamAlt}
                strokeWidth={20}
              />
              <circle
                cx={100}
                cy={100}
                r={70}
                fill="none"
                stroke={tokens.accent.amber}
                strokeWidth={20}
                strokeLinecap="round"
                strokeDasharray={donutCircumference}
                strokeDashoffset={donutCircumference * (1 - donutFrac)}
                transform="rotate(-90 100 100)"
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: fontFamily.inter,
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: tokens.text.softMuted,
                }}
              >
                Composite
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: fontFamily.inter,
                  fontWeight: 900,
                  fontSize: 64,
                  letterSpacing: '-0.04em',
                  color: tokens.text.ink,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {compositeNow}
              </div>
            </div>
          </div>

          {/* Signals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {signals.map((sig, i) => {
              const t = signalsStart + i * 6;
              const sigOpacity = interpolate(
                frame,
                [t, t + 12],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              const sigTx = interpolate(
                frame,
                [t, t + 12],
                [-16, 0],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.out(Easing.cubic),
                },
              );
              return (
                <div
                  key={sig.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    opacity: sigOpacity,
                    transform: `translateX(${sigTx}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: sig.ok ? tokens.ok.green : tokens.text.softMuted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: tokens.text.onDark,
                      fontWeight: 900,
                      fontSize: 18,
                    }}
                  >
                    ✓
                  </div>
                  <div
                    style={{
                      fontFamily: fontFamily.inter,
                      fontWeight: 800,
                      fontSize: 22,
                      letterSpacing: '-0.02em',
                      color: tokens.text.ink,
                    }}
                  >
                    {sig.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA row */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
          <div
            style={{
              borderRadius: 22,
              border: `2px solid ${tokens.border.warm}`,
              padding: '14px 22px',
              fontFamily: fontFamily.inter,
              fontWeight: 900,
              fontSize: 16,
              color: 'oklch(0.42 0.04 52)',
            }}
          >
            Add mod note
          </div>
          <div
            style={{
              borderRadius: 22,
              border: `2px solid ${tokens.border.warm}`,
              padding: '14px 22px',
              fontFamily: fontFamily.inter,
              fontWeight: 900,
              fontSize: 16,
              color: 'oklch(0.42 0.04 52)',
            }}
          >
            Remove
          </div>
          <div
            style={{
              position: 'relative',
              borderRadius: 22,
              background: tokens.accent.amber,
              padding: '14px 28px',
              fontFamily: fontFamily.inter,
              fontWeight: 900,
              fontSize: 16,
              color: tokens.text.onDark,
              transform: `scale(${ctaScale})`,
              boxShadow: '0 12px 32px rgba(65,45,25,0.18)',
              overflow: 'hidden',
              minWidth: 200,
              textAlign: 'center',
            }}
          >
            <span style={{ opacity: 1 - checkProgress }}>Ban + publish</span>
            {checkProgress > 0 ? (
              <svg
                width={48}
                height={48}
                viewBox="0 0 80 80"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  opacity: checkProgress,
                }}
              >
                <path
                  d="M 22 42 L 36 56 L 60 24"
                  stroke={tokens.text.onDark}
                  strokeWidth={9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray={checkLen}
                  strokeDashoffset={checkLen * (1 - checkProgress)}
                />
              </svg>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
