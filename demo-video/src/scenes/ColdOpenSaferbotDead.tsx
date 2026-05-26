import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../components/Caption';
import { SceneBackground } from '../components/SceneBackground';
import { fontFamily } from '../fonts';
import { tokens } from '../theme';

// Scene 1 — Cold Open. 135 frames @ 30fps = 4.5s.
// Tightened from the original 240-frame version so the cold open lands
// hard instead of dragging.
export const ColdOpenSaferbotDead: React.FC = () => {
  const frame = useCurrentFrame();

  // Hero word fade-in fast (4→22).
  const heroOpacity = interpolate(frame, [4, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  // Hero word dims to 0.35 between 56 and 78 (visually "killed")
  const heroDimOpacity = interpolate(frame, [56, 78], [1, 0.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const effectiveHeroOpacity = heroOpacity * heroDimOpacity;

  // Strike-through line grows in width 44→74 — pulled earlier and snappier.
  const strikeWidth = interpolate(frame, [44, 74], [0, 840], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <SceneBackground color={tokens.bg.walnutDeep}>
      {/* Hero word "Saferbot" */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'translateY(-40px)',
        }}
      >
        <div
          style={{
            position: 'relative',
            fontFamily: fontFamily.anton,
            fontWeight: 400,
            fontSize: 220,
            color: tokens.text.onDark,
            opacity: effectiveHeroOpacity,
            letterSpacing: '-0.02em',
            lineHeight: 0.95,
          }}
        >
          Saferbot
          {/* Strike-through line, sits in front of the text */}
          <div
            style={{
              position: 'absolute',
              top: '52%',
              left: '50%',
              transform:
                'translate(-50%, -50%) rotate(-1.5deg) skewX(-3deg)',
              width: strikeWidth,
              height: 14,
              borderRadius: 7,
              background: tokens.danger.red,
              boxShadow: `0 0 24px ${tokens.danger.red}55`,
            }}
          />
        </div>
      </div>

      {/* Caption: names the breakage immediately. */}
      <Caption
        text="march 6: old mod bots broke."
        fontSize={88}
        fontWeight={900}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 160 }}
        fadeIn={[78, 98]}
        hold={115}
        fadeOut={[115, 135]}
        variant="pill"
      />
    </SceneBackground>
  );
};
