import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { Caption } from '../components/Caption';
import { DashboardPanel } from '../components/DashboardPanel';
import { SceneBackground } from '../components/SceneBackground';
import { SignalRow } from '../components/SignalRow';
import { fontFamily } from '../fonts';
import { tokens } from '../theme';

// Card is 1100 × 720 centered at (960, 540): left 410, top 180.
const CARD_LEFT = 410;
const CARD_TOP = 180;
const CARD_WIDTH = 1100;

export const TheBadge: React.FC = () => {
  const frame = useCurrentFrame();

  // Eyebrow + title fade-in
  const eyebrowOpacity = interpolate(frame, [18, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleOpacity = interpolate(frame, [24, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Score chip fade-in
  const chipOpacity = interpolate(frame, [18, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Divider grow
  const dividerWidth = interpolate(frame, [48, 78], [0, 1000], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Footer pills
  const pill = (from: number, to: number) =>
    interpolate(frame, [from, to], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  return (
    <SceneBackground color={tokens.bg.creamBright}>
      {/* The badge card */}
      <DashboardPanel
        top={CARD_TOP}
        left={CARD_LEFT}
        width={CARD_WIDTH}
        height={720}
        frame={frame}
        fadeFrom={0}
        fadeTo={18}
        slideDistance={40}
      >
        {/* Eyebrow */}
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 50,
            opacity: eyebrowOpacity,
            fontFamily: fontFamily.inter,
            fontWeight: 800,
            fontSize: 22,
            color: tokens.accent.kraft,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          MODQUEUE BADGE
        </div>
        {/* Title */}
        <div
          style={{
            position: 'absolute',
            top: 100,
            left: 50,
            opacity: titleOpacity,
            fontFamily: fontFamily.inter,
            fontWeight: 900,
            fontSize: 56,
            color: tokens.text.ink,
            letterSpacing: '-0.04em',
            lineHeight: 1.0,
          }}
        >
          composite score
        </div>

        {/* Score chip */}
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: CARD_WIDTH - 50 - 220,
            width: 220,
            height: 130,
            borderRadius: 24,
            background: tokens.bg.walnutWarm,
            opacity: chipOpacity,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(60, 35, 20, 0.25)',
          }}
        >
          <AnimatedCounter
            fromValue={0}
            toValue={87}
            startFrame={60}
            endFrame={150}
            frame={frame}
            suffix="%"
            fontSize={100}
            color={tokens.text.onDark}
          />
        </div>

        {/* Divider */}
        <div
          style={{
            position: 'absolute',
            top: 230,
            left: 50,
            width: dividerWidth,
            height: 2,
            background: tokens.border.warm,
          }}
        />

        {/* Signal rows — coords are relative to the card's inner box */}
        <SignalRow
          label="posting-time entropy"
          hashLabel="t:9f3a…d12"
          top={280}
          left={50}
          width={1000}
          frame={frame}
          startFrame={90}
          endFrame={120}
        />
        <SignalRow
          label="n-gram cadence"
          hashLabel="n:4c11…7be"
          top={370}
          left={50}
          width={1000}
          frame={frame}
          startFrame={135}
          endFrame={165}
        />
        <SignalRow
          label="link-domain history"
          hashLabel="d:a07e…5f2"
          top={460}
          left={50}
          width={1000}
          frame={frame}
          startFrame={180}
          endFrame={210}
        />

        {/* Footer pills */}
        <div
          style={{
            position: 'absolute',
            top: 560,
            left: 50,
            display: 'flex',
            gap: 12,
          }}
        >
          <FooterPill
            text="matched · r/hive_demo_a"
            opacity={pill(225, 255)}
          />
          <FooterPill text="no username" opacity={pill(240, 270)} />
          <FooterPill
            text="no comment text"
            opacity={pill(255, 285)}
            tone="ok"
          />
        </div>
      </DashboardPanel>

      {/* Caption — pill variant for legibility against the cream background. */}
      <Caption
        text="signals before action"
        fontSize={84}
        fontWeight={900}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 70 }}
        fadeIn={[330, 360]}
        hold={555}
        fadeOut={[555, 585]}
        maxWidth={1500}
        variant="pill"
      />
    </SceneBackground>
  );
};

const FooterPill: React.FC<{
  text: string;
  opacity: number;
  tone?: 'default' | 'ok';
}> = ({ text, opacity, tone = 'default' }) => {
  const isOk = tone === 'ok';
  return (
    <div
      style={{
        opacity,
        padding: '10px 20px',
        borderRadius: 999,
        background: isOk ? `${tokens.ok.green}26` : tokens.bg.creamAlt,
        border: `1.5px solid ${isOk ? tokens.ok.green : tokens.border.warm}`,
        color: isOk ? tokens.ok.green : tokens.text.ink,
        fontFamily: fontFamily.inter,
        fontWeight: 800,
        fontSize: 20,
        letterSpacing: '-0.01em',
      }}
    >
      {text}
    </div>
  );
};
