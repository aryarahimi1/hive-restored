import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Caption } from '../components/Caption';
import { Connector } from '../components/Connector';
import { SceneBackground } from '../components/SceneBackground';
import { TrustGraphNode } from '../components/TrustGraphNode';
import { tokens } from '../theme';

// 8-frame stagger between peer node entrances (per Remotion best-practice
// guidance — children should arrive offset, not all at once).
const nodes = [
  {
    cx: 560,
    cy: 380,
    label: 'r/mechanicalkeyboards',
    start: 0,
    end: 18,
  },
  {
    cx: 1360,
    cy: 380,
    label: 'r/buildapcsales',
    start: 8,
    end: 26,
  },
  {
    cx: 1560,
    cy: 720,
    label: 'r/coffee',
    start: 16,
    end: 34,
  },
  {
    cx: 360,
    cy: 720,
    label: 'r/cscareerquestions',
    start: 24,
    end: 42,
  },
];

export const TrustGraphBuild: React.FC = () => {
  const frame = useCurrentFrame();

  // Connector endpoints: from center node (960, 820) outward, but stop 80 px
  // short of each peer so the line doesn't pierce the circle.
  const center = { x: 960, y: 820 };
  const stopShort = (peer: { x: number; y: number }, radius: number) => {
    const dx = peer.x - center.x;
    const dy = peer.y - center.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      x: peer.x - (dx / len) * radius,
      y: peer.y - (dy / len) * radius,
    };
  };

  // Connectors stagger 6 frames apart so they appear "one after another".
  const peers = [
    { x: 560, y: 380, draw: [80, 100] as const },
    { x: 1360, y: 380, draw: [88, 108] as const },
    { x: 1560, y: 720, draw: [96, 116] as const },
    { x: 360, y: 720, draw: [104, 124] as const },
  ];

  // Slightly inset start point so the line emerges from the rim of the center
  // node rather than its center.
  const centerInset = (peer: { x: number; y: number }) => {
    const dx = peer.x - center.x;
    const dy = peer.y - center.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      x: center.x + (dx / len) * 80,
      y: center.y + (dy / len) * 80,
    };
  };

  return (
    <SceneBackground color={tokens.bg.cream}>
      {/* connectors first so they sit behind the nodes */}
      {peers.map((p, i) => (
        <Connector
          key={i}
          start={centerInset(p)}
          end={stopShort(p, 64)}
          strokeColor={tokens.accent.amberSoft}
          strokeWidth={4}
          drawFrom={p.draw[0]}
          drawTo={p.draw[1]}
          frame={frame}
        />
      ))}

      {/* peer nodes */}
      {nodes.map((n) => (
        <TrustGraphNode
          key={n.label}
          cx={n.cx}
          cy={n.cy}
          radius={64}
          label={n.label}
          fillColor={tokens.bg.creamBright}
          strokeColor={tokens.accent.kraft}
          labelColor={tokens.text.ink}
          startFrame={n.start}
          endFrame={n.end}
          frame={frame}
        />
      ))}

      {/* center "you" node — appears mid-sequence */}
      <TrustGraphNode
        cx={960}
        cy={820}
        radius={80}
        label="r/hive_demo_a"
        sublabel="you"
        fillColor={tokens.bg.walnut}
        strokeColor={tokens.bg.walnutDeep}
        labelColor={tokens.text.ink}
        startFrame={48}
        endFrame={68}
        toScale={1.05}
        frame={frame}
      />

      {/* Captions — pill variant, bottom 15% of 1080 frame ~= 162px from bottom.
          Main caption: 84px, weight 900, 90+ frames dwell, on dark pill.
          Sub-caption: smaller, also on pill for consistency. */}
      <Caption
        text="your team chooses who to trust"
        fontSize={84}
        fontWeight={900}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 162 }}
        fadeIn={[140, 165]}
        hold={335}
        fadeOut={[335, 360]}
        maxWidth={1500}
        variant="pill"
      />
      <Caption
        text="opt-in, peer by peer"
        fontSize={38}
        fontWeight={700}
        color={tokens.text.onDarkDim}
        position={{ kind: 'bottom', bottom: 70 }}
        fadeIn={[185, 210]}
        hold={335}
        fadeOut={[335, 360]}
        maxWidth={1200}
        variant="pill"
      />
    </SceneBackground>
  );
};
