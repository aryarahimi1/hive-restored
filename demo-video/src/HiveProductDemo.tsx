import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { SceneBackground } from './components/SceneBackground';
import { SplashOpen } from './product/scenes/01_SplashOpen';
import { OverviewEmpty } from './product/scenes/02_OverviewEmpty';
import { TrustEmpty } from './product/scenes/03_TrustEmpty';
import { ApplyPreset } from './product/scenes/04_ApplyPreset';
import { ThreatFeedNew } from './product/scenes/05_ThreatFeedNew';
import { ModqueueBadge } from './product/scenes/06_ModqueueBadge';
import { ActionLogUndo } from './product/scenes/07_ActionLogUndo';
import { OverviewImpact } from './product/scenes/08_OverviewImpact';
import { DashboardWide } from './product/scenes/09_DashboardWide';
import { WordmarkClose } from './product/scenes/10_WordmarkClose';
import { tokens } from './theme';

import './fonts';

/**
 * HiveProductDemo — the 110s "programmatic screen-recording" composition.
 * Ten scenes, each owning its local timeline. SceneBackground sits at the
 * bottom so cross-fades between scenes never flash through to black.
 *
 * Scene ranges include 15-frame overlaps for crossfades; each scene's
 * own `interpolate(frame, [0, 15], …)` handles the entry fade.
 */
export const HiveProductDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: tokens.bg.cream }}>
      <SceneBackground color={tokens.bg.cream} />

      <Sequence from={0} durationInFrames={240} name="01_SplashOpen">
        <SplashOpen />
      </Sequence>

      <Sequence from={225} durationInFrames={285} name="02_OverviewEmpty">
        <OverviewEmpty />
      </Sequence>

      <Sequence from={495} durationInFrames={195} name="03_TrustEmpty">
        <TrustEmpty />
      </Sequence>

      <Sequence from={675} durationInFrames={525} name="04_ApplyPreset">
        <ApplyPreset />
      </Sequence>

      <Sequence from={1185} durationInFrames={375} name="05_ThreatFeedNew">
        <ThreatFeedNew />
      </Sequence>

      <Sequence from={1545} durationInFrames={435} name="06_ModqueueBadge">
        <ModqueueBadge />
      </Sequence>

      <Sequence from={1965} durationInFrames={435} name="07_ActionLogUndo">
        <ActionLogUndo />
      </Sequence>

      <Sequence from={2385} durationInFrames={495} name="08_OverviewImpact">
        <OverviewImpact />
      </Sequence>

      <Sequence from={2865} durationInFrames={255} name="09_DashboardWide">
        <DashboardWide />
      </Sequence>

      <Sequence from={3105} durationInFrames={195} name="10_WordmarkClose">
        <WordmarkClose />
      </Sequence>
    </AbsoluteFill>
  );
};
