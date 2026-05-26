import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { ActionButton } from '../components/ActionButton';
import { Caption } from '../components/Caption';
import { SceneBackground } from '../components/SceneBackground';
import { fontFamily } from '../fonts';
import { tokens } from '../theme';

export const ModAction: React.FC = () => {
  const frame = useCurrentFrame();

  // Eyebrow "pick your move"
  const eyebrowOpacity = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Success toast
  const toastOpacity = interpolate(frame, [185, 215], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toastTy = interpolate(frame, [185, 215], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const toastFadeOut = interpolate(frame, [400, 430], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <SceneBackground color={tokens.bg.creamBright}>
      {/* Eyebrow */}
      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: eyebrowOpacity,
          fontFamily: fontFamily.inter,
          fontWeight: 800,
          fontSize: 24,
          color: tokens.accent.kraft,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        pick your move
      </div>

      {/* Buttons */}
      <ActionButton
        label="REVIEW"
        variant="walnut"
        top={380}
        left={372}
        width={360}
        height={140}
        frame={frame}
        startFrame={18}
        endFrame={42}
      />
      <ActionButton
        label="BAN + PUBLISH"
        variant="amber"
        top={380}
        left={780}
        width={360}
        height={140}
        frame={frame}
        startFrame={30}
        endFrame={54}
        selectionFrames={[120, 140]}
        pressFrames={[140, 155]}
        checkmarkFrames={[155, 185]}
      />
      <ActionButton
        label="FALSE POSITIVE"
        variant="outline"
        top={380}
        left={1188}
        width={360}
        height={140}
        frame={frame}
        startFrame={42}
        endFrame={66}
      />

      {/* Success toast */}
      <div
        style={{
          position: 'absolute',
          top: 580,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: toastOpacity * toastFadeOut,
          transform: `translateY(${toastTy}px)`,
        }}
      >
        <div
          style={{
            width: 720,
            height: 88,
            borderRadius: 24,
            background: tokens.bg.walnut,
            color: tokens.text.onDark,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            fontFamily: fontFamily.inter,
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: '-0.01em',
            boxShadow: '0 16px 36px rgba(60, 35, 20, 0.28)',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: tokens.ok.green,
              boxShadow: `0 0 0 4px ${tokens.ok.green}44`,
            }}
          />
          ban published · logged for the team
        </div>
      </div>

      {/* Captions — pill variant for consistency with the rest of the video. */}
      <Caption
        text="review, ban, or dismiss"
        fontSize={96}
        fontWeight={900}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 162 }}
        fadeIn={[240, 270]}
        hold={405}
        fadeOut={[405, 435]}
        maxWidth={1400}
        variant="pill"
      />
      <Caption
        text="actions stay logged"
        fontSize={36}
        fontWeight={700}
        color={tokens.text.onDarkDim}
        position={{ kind: 'bottom', bottom: 70 }}
        fadeIn={[285, 315]}
        hold={405}
        fadeOut={[405, 435]}
        maxWidth={1200}
        variant="pill"
      />
    </SceneBackground>
  );
};
