import React from 'react';
import { useCurrentFrame } from 'remotion';
import { SceneBackground } from '../components/SceneBackground';
import { Wordmark } from '../components/Wordmark';
import { tokens } from '../theme';

export const CloseWordmark: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <SceneBackground color={tokens.bg.walnutDeep}>
      <Wordmark
        primaryText="Hive"
        accentText="Restored"
        accentColor={tokens.accent.amber}
        tagline="shared defense, mod-controlled."
        subcreditA="no usernames · no comment text · built on Devvit"
        subcreditB="open source · r/hive_restored"
        frame={frame}
      />
    </SceneBackground>
  );
};
