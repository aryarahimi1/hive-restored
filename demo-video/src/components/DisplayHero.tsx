import React from 'react';
import { fontFamily } from '../fonts';

export const DisplayHero: React.FC<{
  text: string;
  color: string;
  fontSize: number;
  opacity?: number;
  yOffset?: number;
  children?: React.ReactNode;
}> = ({ text, color, fontSize, opacity = 1, yOffset = 0, children }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        transform: `translateY(${yOffset}px)`,
      }}
    >
      <div
        style={{
          position: 'relative',
          fontFamily: fontFamily.anton,
          fontWeight: 400,
          fontSize,
          color,
          opacity,
          letterSpacing: '-0.02em',
          lineHeight: 0.95,
          textTransform: 'none',
        }}
      >
        {text}
        {children}
      </div>
    </div>
  );
};
