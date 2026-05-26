import React from 'react';
import { AbsoluteFill } from 'remotion';

export const SceneBackground: React.FC<{
  color: string;
  children?: React.ReactNode;
}> = ({ color, children }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: color }}>{children}</AbsoluteFill>
  );
};
