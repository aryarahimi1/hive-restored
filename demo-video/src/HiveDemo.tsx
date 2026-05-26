import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { ColdOpenSaferbotDead } from './scenes/ColdOpenSaferbotDead';
import { TrustGraphBuild } from './scenes/TrustGraphBuild';
import { FederationInAction } from './scenes/FederationInAction';
import { TheBadge } from './scenes/TheBadge';
import { ModAction } from './scenes/ModAction';
import { CloseWordmark } from './scenes/CloseWordmark';
import { tokens } from './theme';

// Force-load fonts at module init.
import './fonts';

// Total: 2595 frames (86.5s @ 30fps). Scene 1 was tightened from 240→135 (cut
// 105 frames), and every downstream `from` offset shifted earlier by 105.
// 15-frame crossfade overlaps between scenes are preserved.
export const HiveDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: tokens.bg.cream }}>
      {/* Scene 1 — cold open: Saferbot is dead. Frames 0–135. */}
      <Sequence from={0} durationInFrames={135} name="ColdOpen">
        <ColdOpenSaferbotDead />
      </Sequence>

      {/* Scene 2 — trust graph build. Frames 120–495 (15-frame overlap). */}
      <Sequence from={120} durationInFrames={375} name="TrustGraph">
        <TrustGraphBuild />
      </Sequence>

      {/* Scene 3 — federation in action. Frames 480–1080 (15-frame overlap). */}
      <Sequence from={480} durationInFrames={600} name="Federation">
        <FederationInAction />
      </Sequence>

      {/* Scene 4 — the badge. Frames 1065–1680 (15-frame overlap). */}
      <Sequence from={1065} durationInFrames={615} name="TheBadge">
        <TheBadge />
      </Sequence>

      {/* Scene 5 — mod action. Frames 1665–2115 (15-frame overlap). */}
      <Sequence from={1665} durationInFrames={450} name="ModAction">
        <ModAction />
      </Sequence>

      {/* Scene 6 — close wordmark. Frames 2100–2595 (15-frame overlap). */}
      <Sequence from={2100} durationInFrames={495} name="Close">
        <CloseWordmark />
      </Sequence>
    </AbsoluteFill>
  );
};
