import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';
import { usePressFeedback } from './usePressFeedback';

type Preset = {
  id: 'starter' | 'midsize' | 'large';
  label: string;
  description: string;
};

const PRESETS: Preset[] = [
  {
    id: 'starter',
    label: 'Starter (3 peers)',
    description:
      'A minimal trust circle for new installations. Best for small subs.',
  },
  {
    id: 'midsize',
    label: 'Midsize (10 peers)',
    description:
      'A balanced set of established subs with active mod teams.',
  },
  {
    id: 'large',
    label: 'Large (20 peers)',
    description:
      'A broad trust circle for max cross-community signal.',
  },
];

/**
 * MockPresetForm — right-side sheet with three radio rows. Slides in
 * from the right over `slideInFrame` → `slideInFrame + 18`. Slides out
 * over `slideOutFrame` → `slideOutFrame + 18`. The radio for `selected`
 * fills orange after `selectedAt`.
 */
export const MockPresetForm: React.FC<{
  selected: 'starter' | 'midsize' | 'large' | null;
  selectedAt?: number;
  slideInFrame: number;
  slideOutFrame: number;
  /** Optional press-feedback anchor for the currently-selected preset row. */
  selectClickFrame?: number;
  /** Optional press-feedback anchor for the bottom "Apply preset" CTA. */
  applyClickFrame?: number;
}> = ({
  selected,
  selectedAt = 0,
  slideInFrame,
  slideOutFrame,
  selectClickFrame,
  applyClickFrame,
}) => {
  const frame = useCurrentFrame();
  const selectPress = usePressFeedback(selectClickFrame);
  const applyPress = usePressFeedback(applyClickFrame);

  const slideIn = interpolate(
    frame,
    [slideInFrame, slideInFrame + 18],
    [600, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  const slideOut = interpolate(
    frame,
    [slideOutFrame, slideOutFrame + 18],
    [0, 600],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.in(Easing.cubic),
    },
  );

  const tx = slideIn + slideOut;

  return (
    <div
      style={{
        position: 'absolute',
        top: 90,
        right: 80,
        width: 560,
        height: 900,
        borderRadius: 36,
        background: tokens.bg.creamBright,
        border: `2px solid ${tokens.border.warm}`,
        padding: 36,
        boxShadow: '0 32px 96px rgba(20,12,6,0.32)',
        transform: `translateX(${tx}px)`,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
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
          Mod menu form
        </div>
        <h2
          style={{
            margin: '8px 0 0',
            fontFamily: fontFamily.inter,
            fontWeight: 900,
            fontSize: 34,
            letterSpacing: '-0.04em',
            color: tokens.text.ink,
          }}
        >
          Apply trust circle preset
        </h2>
        <p
          style={{
            margin: '6px 0 0',
            fontFamily: fontFamily.inter,
            fontSize: 15,
            lineHeight: 1.4,
            color: tokens.text.muted,
          }}
        >
          Add a curated peer list in one click. You can edit later.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {PRESETS.map((p) => {
          const isSelected = selected === p.id && frame >= selectedAt;
          // Press feedback applies only to the row that was actually clicked.
          const rowScale = p.id === selected ? selectPress.scale : 1;
          const rowGlow = p.id === selected ? selectPress.glow : 0;
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                padding: '16px 18px',
                borderRadius: 22,
                border: `2px solid ${
                  isSelected
                    ? tokens.accent.amber
                    : tokens.border.warm
                }`,
                background: isSelected ? 'oklch(0.97 0.03 60)' : tokens.bg.creamAlt,
                transform: `scale(${rowScale})`,
                transformOrigin: 'center center',
                boxShadow:
                  rowGlow > 0.01
                    ? `0 0 0 ${rowGlow * 8}px oklch(0.58 0.17 39 / ${rowGlow * 0.2})`
                    : undefined,
              }}
            >
              <div
                style={{
                  marginTop: 4,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: `3px solid ${
                    isSelected ? tokens.accent.amber : 'oklch(0.7 0.04 62)'
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isSelected ? (
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: tokens.accent.amber,
                    }}
                  />
                ) : null}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: fontFamily.inter,
                    fontWeight: 900,
                    fontSize: 20,
                    letterSpacing: '-0.02em',
                    color: tokens.text.ink,
                  }}
                >
                  {p.label}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: fontFamily.inter,
                    fontSize: 13,
                    lineHeight: 1.4,
                    color: tokens.text.muted,
                  }}
                >
                  {p.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          borderRadius: 22,
          background: tokens.accent.amber,
          color: tokens.text.onDark,
          padding: '16px 22px',
          fontFamily: fontFamily.inter,
          fontWeight: 900,
          fontSize: 18,
          textAlign: 'center',
          boxShadow:
            applyPress.glow > 0.01
              ? `0 12px 32px rgba(65,45,25,0.2), 0 0 0 ${applyPress.glow * 10}px oklch(0.58 0.17 39 / ${applyPress.glow * 0.24})`
              : '0 12px 32px rgba(65,45,25,0.2)',
          transform: `scale(${applyPress.scale})`,
          transformOrigin: 'center center',
        }}
      >
        Apply preset
      </div>
    </div>
  );
};
