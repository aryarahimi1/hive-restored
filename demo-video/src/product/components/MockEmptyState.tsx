import React from 'react';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';

/**
 * MockEmptyState — dashed-border cream card with a title + detail line.
 * Mirrors src/client/game.tsx EmptyState.
 */
export const MockEmptyState: React.FC<{
  title: string;
  detail: string;
}> = ({ title, detail }) => {
  return (
    <div
      style={{
        borderRadius: 28,
        border: `2px dashed oklch(0.78 0.035 68)`,
        background: 'oklch(0.965 0.012 72)',
        padding: '24px 28px',
      }}
    >
      <div
        style={{
          fontFamily: fontFamily.inter,
          fontWeight: 900,
          fontSize: 20,
          letterSpacing: '-0.03em',
          color: tokens.text.ink,
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: fontFamily.inter,
          fontSize: 14,
          lineHeight: 1.4,
          color: tokens.text.muted,
        }}
      >
        {detail}
      </div>
    </div>
  );
};
