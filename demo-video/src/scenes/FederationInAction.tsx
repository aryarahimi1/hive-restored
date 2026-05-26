import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../components/Caption';
import { Connector } from '../components/Connector';
import { DashboardBadgeMock } from '../components/DashboardBadgeMock';
import { DashboardPanel } from '../components/DashboardPanel';
import { SceneBackground } from '../components/SceneBackground';
import { fontFamily } from '../fonts';
import { tokens } from '../theme';

// One row inside a modqueue panel — username pill + content bar.
const FakeRow: React.FC<{
  top: number;
  highlightOpacity?: number;
  showBanPill?: boolean;
  banPillOpacity?: number;
  banPillScale?: number;
  showBadge?: boolean;
  badgeOpacity?: number;
  badgeTranslateY?: number;
}> = ({
  top,
  highlightOpacity = 0,
  showBanPill = false,
  banPillOpacity = 0,
  banPillScale = 1,
  showBadge = false,
  badgeOpacity = 0,
  badgeTranslateY = 0,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 30,
        width: 770,
        height: 110,
        background: tokens.bg.creamAlt,
        border: `1.5px solid ${tokens.border.warm}`,
        borderRadius: 18,
        padding: 30,
        overflow: 'hidden',
      }}
    >
      {/* username pill */}
      <div
        style={{
          width: 180,
          height: 16,
          borderRadius: 8,
          background: tokens.border.warmAlt,
        }}
      />
      {/* content bar */}
      <div
        style={{
          marginTop: 18,
          width: 600,
          height: 12,
          borderRadius: 6,
          background: tokens.border.warmAlt,
          opacity: 0.85,
        }}
      />

      {/* highlight overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: tokens.danger.red,
          opacity: highlightOpacity,
          borderRadius: 18,
        }}
      />

      {/* BAN pill */}
      {showBanPill ? (
        <div
          style={{
            position: 'absolute',
            top: 32,
            right: 30,
            width: 110,
            height: 46,
            borderRadius: 14,
            background: tokens.danger.red,
            color: tokens.text.onDark,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: fontFamily.inter,
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: '0.08em',
            opacity: banPillOpacity,
            transform: `scale(${banPillScale})`,
            boxShadow: '0 6px 18px rgba(120, 30, 20, 0.25)',
          }}
        >
          BAN
        </div>
      ) : null}

      {/* Right-side Hive badge chip */}
      {showBadge ? (
        <DashboardBadgeMock
          score={87}
          top={32}
          left={770 - 30 - 200}
          width={200}
          height={46}
          opacity={badgeOpacity}
          translateY={badgeTranslateY}
        />
      ) : null}
    </div>
  );
};

const PanelHeader: React.FC<{ label: string; frame: number }> = ({
  label,
  frame,
}) => {
  const opacity = interpolate(frame, [12, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        top: 30,
        left: 30,
        opacity,
        fontFamily: fontFamily.inter,
        fontWeight: 800,
        fontSize: 28,
        color: tokens.accent.kraft,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
      }}
    >
      {label}
    </div>
  );
};

export const FederationInAction: React.FC = () => {
  const frame = useCurrentFrame();

  // ===== highlight + BAN pill on left panel row 2 =====
  const highlightOpacity = (() => {
    const ramp = interpolate(frame, [84, 96], [0, 0.22], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const fade = interpolate(frame, [120, 140], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return ramp * fade;
  })();

  const banPillOpacity = interpolate(frame, [96, 114], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const banPillScale = interpolate(frame, [96, 114], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // ===== Hive badge chip on right panel row 2 =====
  const badgeOpacity = interpolate(frame, [210, 240], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const badgeTranslateY = interpolate(frame, [210, 240], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // ===== Scene-out: zoom right panel toward camera (frames 570→600) =====
  // Right panel ends at left:1000, width:870, top:80, height:920 → center
  // (1435, 540). Badge center on right row 2 (row top 354, height 110, badge
  // at top 32 inside the row → 386 absolute, height 46 → center 409).
  // Badge x: row left 1030, row width 770, badge width 200 with 30 px right
  // padding → badge left 1570, center 1670.
  const outProgress = interpolate(frame, [570, 600], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const rightPanelScale = 1 + outProgress * 1.4; // 1.0 → 2.4
  const leftPanelOpacityOut = 1 - outProgress;

  // Right panel scale origin: percent of its OWN box. The panel is at
  // left:1000 top:80 width:870 height:920. Badge center is at (1670, 409)
  // in stage coords → inside the panel that's (670, 329) → percent
  // (77%, 35.7%).
  const rightScaleOrigin = '77% 36%';

  return (
    <SceneBackground color={tokens.bg.cream}>
      {/* LEFT panel — r/hive_demo_a · modqueue */}
      <DashboardPanel
        top={80}
        left={50}
        width={870}
        height={920}
        frame={frame}
        fadeFrom={0}
        fadeTo={24}
        opacityOverride={
          frame >= 570 ? leftPanelOpacityOut : undefined
        }
      >
        <PanelHeader label="r/hive_demo_a · modqueue" frame={frame} />
        <div style={{ position: 'absolute', top: 220, left: 0, right: 0 }}>
          <FakeRow top={0} />
          <FakeRow
            top={134}
            highlightOpacity={highlightOpacity}
            showBanPill
            banPillOpacity={banPillOpacity}
            banPillScale={banPillScale}
          />
          <FakeRow top={268} />
        </div>
      </DashboardPanel>

      {/* RIGHT panel — r/hive_demo_b · modqueue */}
      <DashboardPanel
        top={80}
        left={1000}
        width={870}
        height={920}
        frame={frame}
        fadeFrom={0}
        fadeTo={24}
        scale={rightPanelScale}
        scaleOrigin={rightScaleOrigin}
      >
        <PanelHeader label="r/hive_demo_b · modqueue" frame={frame} />
        <div style={{ position: 'absolute', top: 220, left: 0, right: 0 }}>
          <FakeRow top={0} />
          <FakeRow
            top={134}
            showBadge
            badgeOpacity={badgeOpacity}
            badgeTranslateY={badgeTranslateY}
          />
          <FakeRow top={268} />
        </div>
      </DashboardPanel>

      {/* Publish arc connector — left panel right edge to right panel left edge */}
      <Connector
        start={{ x: 920, y: 410 }}
        end={{ x: 1000, y: 410 }}
        curve={{ control: { x: 960, y: 270 } }}
        strokeColor={tokens.accent.amber}
        strokeWidth={6}
        drawFrom={140}
        drawTo={200}
        frame={frame}
        arrowhead
        fadeOut={[240, 260]}
      />

      {/* "wiki publish" floating label */}
      <div
        style={{
          position: 'absolute',
          top: 230,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity:
            interpolate(frame, [175, 200], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }) *
            interpolate(frame, [240, 260], [1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          fontFamily: fontFamily.inter,
          fontWeight: 800,
          fontSize: 28,
          color: tokens.accent.kraft,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
        }}
      >
        wiki publish
      </div>

      {/* Captions — pill variant for legibility over the busy dashboard. */}
      <Caption
        text="one ban publishes an opaque hash"
        fontSize={84}
        fontWeight={900}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 162 }}
        fadeIn={[300, 330]}
        hold={540}
        fadeOut={[540, 570]}
        maxWidth={1600}
        variant="pill"
      />
      <Caption
        text="the next queue gets warned"
        fontSize={36}
        fontWeight={700}
        color={tokens.text.onDarkDim}
        position={{ kind: 'bottom', bottom: 70 }}
        fadeIn={[360, 390]}
        hold={540}
        fadeOut={[540, 570]}
        maxWidth={1400}
        variant="pill"
      />
    </SceneBackground>
  );
};
